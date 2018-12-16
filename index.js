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

const fs = require('fs');
const bacon = require('baconjs');
const kellycolors = require('./lib/kellycolors');
const rrdtool = require('./lib/rrdtool');
const Schema = require('./lib/schema.js');
const Database = require("./lib/database.js");
const Databases = require("./lib/databases.js");

const DEBUG = false;
const PLUGIN_CONFIG_FILE = __dirname + "/config.json"
const PLUGIN_SCHEMA_FILE = __dirname + "/schema.json"
const PLUGIN_UISCHEMA_FILE = __dirname + "/uischema.json"
const SYSTEMD_CONFIG_FILE = __dirname + "/systemd/service.conf"
const CHART_MANIFEST_FILE = __dirname + "/public/manifest.json";

module.exports = function(app) {
	var plugin = {};
	var unsubscribes = [];

	plugin.id = "sensor-log";
	plugin.name = "Sensor Log";
	plugin.description = "Log and chart sensor readings using a round-robin database.";
        
    /**
     * Load the plugin configuration dictionary from disk file, expanding
     * variables using a meta-dictionary loaded from the systemd configuration
     * file.
     */

    const CONFIG = Schema.createSchema(PLUGIN_CONFIG_FILE, loadSystemdConfig(SYSTEMD_CONFIG_FILE)).getSchema(); 

    /**
     * Load the plugin's react:json schema from disk file, expanding variables
     * using the configuration dictionary and insert dynamic object default
     * values by interrogting the host application environment.
     */
	plugin.schema = function() {
        var schema = Schema.createSchema(PLUGIN_SCHEMA_FILE, CONFIG);
        var sensors = loadSensors(CONFIG.DEFAULT_SENSOR_SELECTOR);
        var databases = Databases.createFromSensorList(sensors).getList();
        var displaygroups = generateDisplayGroups(sensors);
        schema.insertValue("properties.sensor.properties.list.default", sensors);
        schema.insertValue("properties.rrddatabase.properties.databases.default", databases);
        schema.insertValue("properties.displaygroup.properties.list.default", displaygroups);
        return(schema.getSchema());
    };

    /**
     * Load the plugin's react:json ui:schema from disk file.
     */
	plugin.uiSchema = function() {
        var schema = Schema.createSchema(PLUGIN_UISCHEMA_FILE);
        return(schema.getSchema());
    }

    /**
     * Execute the plugin by attempting to make a connection to rrdcached and
     * rrdchartd. As long as the cache daemon can be contacted, then perform a
     * few sanity checks before entering the production loop.
     */
	plugin.start = function(options) {
        Promise.all([
            rrdtool.openCacheD(options.rrdservices.rrdcachedsocket, handleRrdcachedOutput),
            rrdtool.openChartD(options.chart.generatecharts?options.rrdservices.rrdchartdport:0)
        ]).then(function ([ cachedConnected, chartdConnected ]) {
            if (cachedConnected) {

				// If If the user has changed the sensor selector regex or has explicitly
		        // requested a re-scan of sensor paths, then we try to load a list of
		        // sensors using the selector regex.
				//
				if ((options.sensor.list.length == 0) || (options.sensor.rescan) || (options.sensor.selector != options.sensor.currentselector)) {
					logNN(undefined, "scanning server for sensor data streams");
		            options.sensor.list = loadSensors(options.sensor.selector, options.sensor.list);
		            options.sensor.rescan = false;
		            options.sensor.currentselector = options.sensor.selector;
		            logNN(undefined, "scan selected " + options.sensor.list.length + " streams");
		        }
                if (options.sensor.list.length == 0) {
			        logEE("there are no accessible sensor data streams");
			        return;
		        }

                // Check the current database configuration, re-making any databases
                // that are missing or whose structure does not conform to the current
                // sensor list settings.
                //
                var databases = Databases.createFromSensorList(options.sensor.list);
                var missingdatabases = databases.missingOnDisk(options.rrddatabase.directory);
                var currentdatabases = Databases.createFromDatabaseList(options.rrddatabase.databases);
                var changeddatabases = databases.difference(currentdatabases);
                var dirtydatabases = missingdatabases.union(changeddatabases);
                dirtydatabases.getList().forEach(database => {
			        logNN("creating new database '" + database.getName() + "' for " + database.getPaths().length + " sensors");
			        rrdtool.createDatabase(
                        database.getName(),
                        options.rrddatabase.updateinterval, 
                        0, 
                        CONFIG.DATAMAX, 
                        database.getPaths().map(v => makeIdFromPath(v)), 
                        options.rrddatabase.periods
                    )
                    .then(result => {
                        if (!result) {
                            logEE("error creating database '" + database.getName() + "'");
                            return;
                        }
			        })
                    .catch(err => {
                        logEE("fatal error: " + err);
                        return;
                    });
                });
                options.rrddatabase.databases = databases.getList();
                if (options.rrddatabase.databases.length == 0) {
			        logEE("there are no defined databases");
			        return;
                }

                // Update the displaygroup options from the sensor list, just in-case
                // the user has made any changes in plugin config.
                //
                options.displaygroup.list = generateDisplayGroups(options.sensor.list, options.displaygroup.list);

                // Save plugin options.
                //
                app.savePluginOptions(options, function(err) {
                    if (err) logNN("update of plugin options failed: " + err);
                });


                // Handle all the various chart generation possibilities and
                // if it seems sensible, try and save a chart manifest file
                // so that the webapp knows what's what.
                //
      	        if (options.displaygroup.list.length == 0) {
                    logWW("disabling chart generation because there are no defined display groups");
                    options.chart.generatecharts = false;
                } else {
		            if (options.chart.generatecharts) {
                        writeManifest(CHART_MANIFEST_FILE, options.displaygroup.list, function(err) { if (err) logWW("update of chart manifest failed"); });
                        if (!chartdConnected) logWW("disabling chart generation because rrdchartd cannot be reached");
                    } else {
                        logNN("chart generation disabled by configuration option");
                    }
                }

                var paths = databases.getAllDatabasePaths();
		        var pathStreams = paths.map(path => app.streambundle.getSelfBus(path));
                var pathMultipliers = paths.map(path => options.sensor.list.reduce((a,x) => ((x['path'] == path)?x['multiplier']:a),1));
    		    var tick = 1;
                logNN("connected to " + pathStreams.length  + " sensor streams");

                unsubscribes.push(bacon.interval((1000 * options.rrddatabase.updateinterval), 0).onValue(function(t) {
                    var seconds = Math.floor(new Date() / 1000);
    		        bacon.zipAsArray(pathStreams).onValue(function(vals) {
                        var pathValues = vals.map((a,i) => ((a['value'] == null)?NaN:(Math.round(a['value'] * pathMultipliers[i]))));
                        if (options.logging.console.includes('updates')) logN("connected to " + pathStreams.length + " sensor streams (" + pathValues.join(',') + ")");
                        databases.setAllDatabaseValues(pathValues);
                        databases.getList().forEach(database => {
                            var dbname = database.getName();
                            if (options.logging.syslog.includes('updates')) console.log("updating '" + dbname + "' with " + JSON.stringify(database.getValues()));
                            rrdtool.updateDatabase(dbname, seconds, database.getValues().map(v => (v == NaN)?'U':v))
                            .then(result => {
                                // silence is golden
                            })
                            .catch(err => {
                                logWW("database update failed: " + err);
                            });
                        });

                        return(bacon.noMore);
                    });

                    if (chartdConnected) {
                        options.rrddatabase.periods
                        .map(p => p['name'])
                        .filter((v,i) => ((tick % options.rrddatabase.periods[i]['plotticks']) == 0))
                        .forEach(chart => {
                            options.displaygroup.list.map(g => g['id']).forEach(function(group) {
                                rrdtool.createChart(group, chart)
                                .then(result => {
                                    if (!result) logWW("chart generation failed for '" + group + ", " + chart + "'");
                                })
                                .catch(err => {});
                            });
                        });
                    }
                    tick++;
                }));
            } else {
                logEE("could not connect to cache daemon");
                return;
            }
        });
	}

	plugin.stop = function() {
		unsubscribes.forEach(f => f());
		unsubscribes = [];
	}

    function handleRrdcachedOutput(msg) {
        if (msg.charAt(0) == '-') logNN(msg);
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
        if (DEBUG) console.log("loadSensors('" + regex + "', " + JSON.stringify(sensors) + ")...");
        var regexp = RegExp(regex);
        var retval = app.streambundle.getAvailablePaths()
            .filter(path => (regexp.test(path)))
		    .map(function(path) {  
                var existing = (sensors !== undefined)?sensors.reduce((a,s) => ((s['path'] == path)?s:a),undefined):undefined;
                return({
                    "path": path,
                    "name": (existing === undefined)?makeIdFromPath(path):existing['name'],
                    "databases": (existing === undefined)?makeDatabaseNameFromPath(path, '.rrd'):existing['databases'],
                    "displaycolor": (existing === undefined)?kellycolors.getNextColor():existing['displaycolor'],
		            "displaygroups": (existing === undefined)?makeDatabaseNameFromPath(path, ''):existing['displaygroups'],
                    "multiplier": (existing === undefined)?CONFIG.DEFAULT_SENSOR_MULTIPLIER:existing['multiplier'],
                    "options": (existing === undefined)?CONFIG.DEFAULT_SENSOR_OPTIONS:existing['options']
                });
            });
        return(retval);
	}


	function generateDisplayGroups(sensors, displaygroups) {
		var retval = [];

		var definedgroupnames = new Set(sensors.reduce((acc,s) => (acc.concat(s['displaygroups'].split(' '))),[]));
		definedgroupnames.forEach(function(definedgroupname) {
            var existing = (displaygroups !== undefined)?displaygroups.filter(dg => (dg['id'] == definedgroupname))[0]:undefined;;
            retval.push({
                id: definedgroupname,
                title: (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_TITLE:existing['title'],
                ylabel: (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_YLABEL:existing['ylabel'],
                ymin: (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_YMIN:existing['ymin'],
                ymax: (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_YMAX:existing['ymax'],
                options: (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_OPTIONS:existing['options']
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

	function makeDatabaseNameFromPath(path, suffix) {
        if (DEBUG) console.log("makeDatabaseNameFromPath('" + path + "')...");
		return(path.substr(0, path.indexOf('.')).replace(/[^0-9a-z]/g, '') + suffix);
	}

    function loadSystemdConfig(filename) {
        var retval = {};

        if (filename != undefined) {
            try {
                var lines = fs.readFileSync(filename).toString();
                if (lines != null) {
                    lines.split("\n").forEach(line => {
                        if ((a = line.match(/^(.*)=(.*)$/)) != null) { retval[a[1]] = (/\d/.test(a[2]))?parseInt(a[2]):a[2]; }
                    });
                }
            } catch(err) { }
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


