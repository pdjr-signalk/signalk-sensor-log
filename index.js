/*
 * Copyright 2018 Paul Reeve <paul@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const execSync = require('child_process').execSync;
const exec = require('child_process').exec;
const fs = require('fs');
const fspromises = require('fs').promises;
const bacon = require('baconjs');
const kellycolors = require('./lib/kellycolors');
const rrdtool = require('./lib/rrdtool');
const _ = require('./lib/config');
const schema = require('./lib/schema');
const { timeoutPromise } = require('./lib/mypromises');

module.exports = function(app) {
	var plugin = {};
	var unsubscribes = [];

	plugin.id = "sensor-log";
	plugin.name = "Sensor Log";
	plugin.description = "Log and chart sensor readings using a round-robin database.";
        
    var CHARTMANIFEST = __dirname + "/" + _.CHARTMANIFESTFILENAME;
    var GRAPH_INTERVALS = [ _.HOUR_GRAPH_INTERVAL, _.DAY_GRAPH_INTERVAL, _.WEEK_GRAPH_INTERVAL, _.MONTH_GRAPH_INTERVAL, _.YEAR_GRAPH_INTERVAL ];

	plugin.schema = schema.schema;

	plugin.uiSchema = schema.uiSchema;

	plugin.start = function(options) {

        //////////////////////////////////////////////////////////////////////
        // GET A SENSOR LIST AND UPDATE DISPLAY GROUPS ///////////////////////
        //////////////////////////////////////////////////////////////////////

		// If the user has changed the sensor selector regex or has explicitly
        // requested a re-scan of sensor paths, then we try to load a list of
        // sensors using the selector regex.  Note that this will always be
        // the situation after a clean install, so when the user opens the
        // plugin config there may be something to play with.
		//
		if ((options.sensor.rescan) || (options.sensor.selector != options.sensor.currentselector)) {
			logNN(undefined, "scanning server for sensor data streams");
            options.sensor.list = loadSensors(options.sensor.selector, options.sensor.list);
            options.sensor.rescan = false;
            options.sensor.currentselector = options.sensor.selector;
            logNN(undefined, "scan selected " + options.sensor.list.length + " streams");
        }

        // Update the displaygroup options from the sensor list, just in-case
        // the user has made any changes in plugin config.
        //
        options.displaygroup.list = generateDisplayGroups(options.sensor.list, options.displaygroup.list);

        //////////////////////////////////////////////////////////////////////
        // START SANITY CHECKS ///////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////

        // If no sensor streams are defined, then there is nothing for us to
        // do, so we should just die.
        //
        if (options.sensor.list.length == 0) {
			logEE("There are no accessible sensor data streams");
			return;
		}

        //////////////////////////////////////////////////////////////////////
        // HOUSEKEEPING //////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////

        // Warn the user if chart generation has been disabled.
        //
      	if (!options.chart.generatecharts) {
			logNN("chart generation is disabled in plugin config");
        }

        // If the user wants a new database, then make sure one will
        // subsequently be created by deleting the current list of database
        // paths.
        //
        if (options.rrddatabase.options.includes("createnow")) {
            logNN(undefined, "regenerating database at user request");
            options.sensor.dbpaths = [];
            options.rrddatabase.options = options.rrddatabase.options.filter(v => (v != "createnow"));
        }

        // If the sensor list doesn't match the current database structure
        // then we could create a new database, but only if the user allows it
        // with the 'autocreate' option.
        //
        if ((!compareArrays(options.sensor.dbpaths, options.sensor.list.map(v => v['path']))) && options.rrddatabase.options.includes("autocreate")) {
            logNN(undefined, "regenerating database to match sensor list");
            options.sensor.dbpaths = [];
        }

        //////////////////////////////////////////////////////////////////////
        // INITIALISE ////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////


        // If no database exists then we need to create one.  We check the
        // dbpaths option and if it is empty then we make the create call.
		//
		if ((options.sensor.dbpaths.length == 0) || (!fs.existsSync(_.RRDFILENAME))) {
			logNN("creating new database '" + _.RRDFILENAME + "' for " + options.sensor.list.length + " sensor streams");
            if (fs.existsSync(_.RRDFILENAME)) fs.unlinkSync(_.RRDFILENAME);
			try {
                var paths = options.sensor.list.map(v => v['path']);
                rrdtool.createDatabase(
                    _.RRDFILENAME,
                    options.rrddatabase.updateinterval,
                    0,
                    _.DATAMAX,
                    paths.map(v => makeIdFromPath(v)),
                    _.RRDUSER,
                    _.RRDGROUP
                );
                options.sensor.dbpaths = paths; 
			} catch(err) {
			    logEE("Error creating database '" + _.RRDFILENAME + "'"); 
			    return;
			}
		}


        // Update the chart manifest file.
        //
		if (options.chart.generatecharts) {
            writeManifest(CHARTMANIFEST, options.displaygroup.list, function(err) {
                if (err) logNN("error updating chart manifest");
            });
        }

        app.savePluginOptions(options, function(err) {
            if (err) logNN("error updating options " + err);
        });

        //////////////////////////////////////////////////////////////////////
        // ENTER SERVICE LOOP ////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////

        // Tell the rrdtool library that we will be using a remote server to
        // manage database operations and create a directory under the server
        // to hold generated charts.
        //
        
        Promise.all([
            rrdtool.openCacheD(options.rrdservices.rrdcachedsocket),
            rrdtool.openChartD(options.rrdservices.rrdchartdport)
        ]).then(function ([ cachedConnected, chartdConnected ]) {
            console.log("cachedConnected = " + cachedConnected);
            console.log("chartdConnected = " + chartdConnected);
            if (cachedConnected) {
                if ((chartdConnected !== undefined) && (!chartdConnected)) logNN("could not connect to chart generation service");
		        var streams = options.sensor.dbpaths.map(v => app.streambundle.getSelfBus(v));
                var multipliers = options.sensor.dbpaths.map(v => options.sensor.list.reduce((a,x) => ((x['path'] == v)?x['multiplier']:a),1));
    		    var tick = 0;
                logNN("Connected to " + streams.length  + " sensor streams");

                unsubscribes.push(bacon.interval((1000 * options.rrddatabase.updateinterval), 0).onValue(function(t) {
                    var seconds = Math.floor(new Date() / 1000);
    		        bacon.zipAsArray(streams).onValue(function(v) {
                        var val = v.map((a,i) => ((a['value'] == null)?'U':(Math.round(a['value'] * multipliers[i]))));
                        if (options.logging.console.includes('updates')) logN("Connected to " + streams.length + " sensor streams (" + val + ")");
                        rrdtool.updateDatabase(_.RRDFILENAME, seconds, val).then(err => { if (err == null) console.log(err) });

                        return(bacon.noMore);
                    });

                    if ((chartdConnected !== undefined) && (chartdConnected)) {
                        ['hour','day','week','month','year'].filter((v,i) => ((tick % GRAPH_INTERVALS[i]) == 0)).forEach(function(chart) {
                            options.displaygroup.list.map(g => g['id']).forEach(function(group) {
                                rrdtool.createChart(group, chart);
                            });
                        });
                    }
                    tick++;
                }));
            } else {
                logEE("could not connect to cache daemon");
            }
        });
	}

	plugin.stop = function() {
		unsubscribes.forEach(f => f());
		unsubscribes = [];
	}

    function writeManifest(filename, displaygroups, callback) {
        fs.writeFile(filename, JSON.stringify(displaygroups.map(dg => ({ id: dg['id'], title: dg['title'] }))), callback);
    }

    /**
     * Recovers the list of currently available data paths from the Signal K
     * server and filters them using the supplied regular expression.  The
     * result of this operation is cached to disk and returned to the
     * caller.
     */

	function loadSensors(regex, sensors) {
        //console.log(JSON.stringify(app.streambundle.getAvailablePaths()));
        var regexp = RegExp(regex);
        var retval = app.streambundle.getAvailablePaths()
            .filter(path => (regexp.test(path)))
		    .map(function(path) {  
                var existing = (sensors !== undefined)?sensors.reduce((a,s) => ((s['path'] == path)?s:a),undefined):undefined;
                return({
                    "path": path,
                    "name": (existing === undefined)?makeIdFromPath(path):existing['name'],
                    "displaycolor": (existing === undefined)?kellycolors.getNextColor():existing['displaycolor'],
		            "displaygroups": (existing === undefined)?_.DEFAULT_SENSOR_DISPLAYGROUPS:existing['displaygroups'],
                    "multiplier": (existing === undefined)?_.DEFAULT_SENSOR_MULTIPLIER:existing['multiplier'],
                    "options": (existing === undefined)?_.DEFAULT_SENSOR_OPTIONS:existing['options']
                });
            });
        console.log(JSON.stringify(retval));
        return(retval);
	}

    function checkSensors(sensors, cachefile) {
        var cache = JSON.parse(fs.read(cachefile));
        return(sensors === cache);
    }


	function generateDisplayGroups(sensors, displaygroups) {
		var retval = [];

		var definedgroupnames = new Set(sensors.reduce((acc,s) => (acc.concat(s['displaygroups'].split(' '))),[]));
		definedgroupnames.forEach(function(definedgroupname) {
            var existing = (displaygroups !== undefined)?displaygroups.filter(dg => (dg['id'] == definedgroupname))[0]:undefined;;
            retval.push({
                id: definedgroupname,
                title: (existing === undefined)?_.DEFAULT_DISPLAYGROUP_TITLE:existing['title'],
                ylabel: (existing === undefined)?_.DEFAULT_DISPLAYGROUP_YLABEL:existing['ylabel'],
                ymax: (existing === undefined)?_.DEFAULT_DISPLAYGROUP_YMAX:existing['ymax'],
                options: (existing === undefined)?_.DEFAULT_DISPLAYGROUP_OPTIONS:existing['options']
            });
		});
        return(retval);
	}
	
	function makeIdFromPath(path) {
		var result = path.toLowerCase().match(/^\w+\.(.*)\..*$/)
		if ((result != null) && (result.length > 1)) { 
			return(result[1].replace(/[^0-9a-z]/g, ''));
		} else {
			throw("parse error");
		}
	}

    function compareArrays(arr1, arr2) {
        var retval = false;
        if ((arr1 !== undefined) && (arr2 !== undefined)) {
            if (retval = (arr1.length == arr2.length)) {
                arr1.forEach(function(v) { retval &= arr2.includes(v); });
            }
        }
        return(retval);
    }


	function log(prefix, terse, verbose) {
		if (verbose != undefined) console.log(plugin.id + ": " + prefix + ": " + verbose);
		if (terse != undefined) { if (prefix !== "error") { app.setProviderStatus(terse); } else { app.setProviderError(terse); } }
	}

	function logE(terse) { log("error", terse, undefined); }
	function logEE(terse, verbose) { log("error", terse, (verbose === undefined)?terse:verbose); }
	function logW(terse) { log("warning", terse, undefined); }
	function logWW(terse, verbose) { log("warning", terse, (verbose === undefined)?terse:verbose); }
	function logN(terse) { log("notification", terse, undefined); }
	function logNN(terse, verbose) { log("notice", terse, (verbose === undefined)?terse:verbose); }

	return plugin;
}


