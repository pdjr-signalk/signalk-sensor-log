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
const utils = require("./lib/utils.js");
const Log = require("./lib/log.js");

const DEBUG = false;
const PLUGIN_CONFIG_FILE = __dirname + "/config.json";
const PLUGIN_SCHEMA_FILE = __dirname + "/schema.json";
const PLUGIN_UISCHEMA_FILE = __dirname + "/uischema.json";
const SYSTEMD_CONFIG_FILE = __dirname + "/systemd/service.conf";
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

    const log = new Log(app.setProviderStatus, app.setProviderError, plugin.id);
    const CONFIG = Schema.createSchema(PLUGIN_CONFIG_FILE, loadSystemdConfig(SYSTEMD_CONFIG_FILE)).getSchema(); 

    /**
     * Load the plugin's react:json schema from disk file, expanding variables
     * using the configuration dictionary and insert dynamic object default
     * values by interrogting the host application environment.
     */
	plugin.schema = function() {
        if (DEBUG) console.log("plugin.schema()...");

        var schema = Schema.createSchema(PLUGIN_SCHEMA_FILE, CONFIG);
        var paths = utils.createPathObjects(utils.filterAvailablePaths(app, ["notifications"]), undefined, createPathObject);
        var databases = utils.createDatabasesFromPaths(paths, undefined, makeIdFromPath);
        var displaygroups = utils.createDisplaygroupsFromPaths(paths, undefined, createDisplaygroupObject);
        schema.insertValue("properties.paths.default", paths);
        schema.insertValue("properties.rrddatabase.properties.databases.default", databases);
        schema.insertValue("properties.displaygroups.default", displaygroups);
        fs.writeFileSync(__dirname + "/out", JSON.stringify(schema.getSchema()));
        return(schema.getSchema());
    };

    /**
     * Load the plugin's react:json ui:schema from disk file.
     */
	plugin.uiSchema = function() {
        if (DEBUG) console.log("plugin.uiSchema()...");

        var schema = Schema.createSchema(PLUGIN_UISCHEMA_FILE);
        return(schema.getSchema());
    }

    /**
     * Execute the plugin by attempting to make a connection to rrdcached and
     * rrdchartd. As long as the cache daemon can be contacted, then perform a
     * few sanity checks before entering the production loop.
     */
	plugin.start = function(options) {
        if (DEBUG) console.log("plugin.start(%s)...", JSON.stringify(options));

        Promise.all([
            rrdtool.openCacheD(options.rrdservices.rrdcachedsocket, handleRrdcachedOutput),
            rrdtool.openChartD(options.chart.generatecharts?options.rrdservices.rrdchartdport:0)
        ]).then(function ([ cachedConnected, chartdConnected ]) {
            if (cachedConnected) {

				// If If the user has changed the sensor selector regex or has explicitly
		        // requested a re-scan of sensor paths, then we try to load a list of
		        // sensors using the selector regex.
				//
                var proposedDatabases, missingDatabases = [], changedDatabases = [];
                if (options.rrddatabase.options.includes("rebuild")) {
                    log.N("database rebuild: starting by sleeping for 15 seconds");
                    options.rrddatabase.options = [];
                    setTimeout(function() {
                        options.paths = utils.createPathObjects(utils.filterAvailablePaths(app, ["notifications"]), options.paths, createPathObject);
                        log.N("database rebuild: identified " + options.paths.length + " data source(s)");

                        proposedDatabases = utils.createDatabasesFromPaths(options.paths, makeIdFromPath);
                        missingDatabases = utils.getMissingDatabases(proposedDatabases, options.rrddatabase.directory);
                        log.N("database rebuild: will create " + missingDatabases.length + " missing database(s)");
                        changedDatabases = utils.getChangedDatabases(proposedDatabases, options.rrddatabase.databases);
                        log.N("database rebuild: will recreate " + changedDatabases.length + " changed database(s)");
                    }, 15000);
                }

                options.paths = options.paths.sort((a,b) => ((a['path'] < b['path'])?-1:((a['path'] > b['path'])?1:0)));

                if (options.rrddatabase.options.includes("autocreate")) {
                    proposedDatabases = utils.createDatabasesFromPaths(options.paths, options.databases,makeIdFromPath);
                    missingDatabases = utils.getMissingDatabases(proposedDatabases, options.rrddatabase.directory);
                    log.N("database autocreate: will create " + missingDatabases.length + " missing database(s)");
                }

                utils.mergeDatabases(changedDatabases, missingDatabases).forEach(database => {
			        log.N("creating new database '" + database['name'] + "' for " + database['datasources'].length + " paths");
			        rrdtool.createDatabase(
                        database['name'],
                        options.rrddatabase.updateinterval, 
                        0, 
                        CONFIG.DATAMAX, 
                        database['datasources'].map(datasource => datasource['name']), 
                        options.rrddatabase.periods
                    )
                    .then(result => {
                        if (!result) {
                            log.E("error creating database '" + database['name'] + "'");
                            return;
                        } else {
                            log.N("created new database '" +  database['name'] + "'");
                            options.rrddatabase.databases = utils.updateDatabases(options.rrddatabase.databases, database);
                        }
			        })
                    .catch(err => {
                        log.E("fatal error: " + err);
                        return;
                    });
                });

                if (options.rrddatabase.databases.length == 0) {
			        log.E("there are no defined databases");
			        return;
                }

                // Update the displaygroup options from the sensor list, just in-case
                // the user has made any changes in plugin config.
                //
                options.displaygroups = utils.createDisplaygroupsFromPaths(options.paths, options.displaygroups, createDisplaygroupObject);

                // Save plugin options.
                //
                app.savePluginOptions(options, function(err) {
                    if (err) log.W("update of plugin options failed: " + err);
                });


                // Handle all the various chart generation possibilities and
                // if it seems sensible, try and save a chart manifest file
                // so that the webapp knows what's what.
                //
      	        if (options.displaygroups.length == 0) {
                    log.W("disabling chart generation because there are no defined display groups");
                    options.chart.generatecharts = false;
                } else {
		            if (options.chart.generatecharts) {
                        writeManifest(CHART_MANIFEST_FILE, options.displaygroups, function(err) { if (err) log.W("update of chart manifest failed"); });
                        if (!chartdConnected) log.W("disabling chart generation because rrdchartd cannot be reached");
                    } else {
                        log.N("chart generation disabled by configuration option");
                    }
                }

                var paths = utils.getAllDatabasePaths(options.rrddatabase.databases);
		        var pathStreams = paths.map(path => app.streambundle.getSelfBus(path));
                var pathMultipliers = paths.map(path => options.paths.reduce((a,x) => ((x['path'] == path)?x['multiplier']:a),1));
    		    var tick = 1;
                log.N("connected to " + pathStreams.length  + " sensor streams");

                unsubscribes.push(bacon.interval((1000 * options.rrddatabase.updateinterval), 0).onValue(function(t) {
                    var seconds = Math.floor(new Date() / 1000);
    		        bacon.zipAsArray(pathStreams).onValue(function(vals) {
                        var pathValues = vals.map((a,i) => (((a['value'] == null) || Number.isNaN(a['value']))?NaN:(Math.round(a['value'] * pathMultipliers[i]))));
                        //if (options.logging.console.includes('updates')) log.N("connected to " + pathStreams.length + " sensor streams (" + pathValues.join(',') + ")");
                        options.rrddatabase.databases = utils.setAllDatabaseValues(options.rrddatabase.databases, pathValues);
                        options.rrddatabase.databases.forEach(database => {
                            var dbname = database['name']
                            if (options.logging.syslog.includes('updates')) log.N("updating '" + dbname + "' with " + JSON.stringify(database['values']));
                            rrdtool.updateDatabase(dbname, seconds, database['datasources'].map(v => (v['value'] == NaN)?'U':v['value']))
                            .then(result => {
                                // silence is golden
                            })
                            .catch(err => {
                                log.W("database update failed: " + err);
                            });
                        });

                        return(bacon.noMore);
                    });

                    if (chartdConnected) {
                        options.rrddatabase.periods
                        .map(p => p['name'])
                        .filter((v,i) => ((tick % options.rrddatabase.periods[i]['plotticks']) == 0))
                        .forEach(chart => {
                            options.displaygroups.map(g => g['id']).forEach(function(group) {
                                rrdtool.createChart(group, chart)
                                .then(result => {
                                    if (!result) log.W("chart generation failed for '" + group + ", " + chart + "'");
                                })
                                .catch(err => {});
                            });
                        });
                    }
                    tick++;
                }));
            } else {
                log.E("could not connect to cache daemon");
                return;
            }
        });
	}

	plugin.stop = function() {
		unsubscribes.forEach(f => f());
		unsubscribes = [];
	}

    function handleRrdcachedOutput(msg) {
        if (msg.charAt(0) == '-') log.N(msg);
    }

    function writeManifest(filename, displaygroups, callback) {
        fs.writeFile(filename, JSON.stringify(displaygroups.map(dg => ({ id: dg['id'], title: dg['title'] }))), callback);
    }

	function createPathObject(path, existing) {
        return({
            "path": path,
            "multiplier": (existing === undefined)?CONFIG.DEFAULT_SENSOR_MULTIPLIER:existing['multiplier'],
	        "displaygroups": (existing === undefined)?"":existing['displaygroups']
        });
	}

    function createDisplaygroupObject(name, paths, existing) {
        var datasources = (existing === undefined)?[]:existing['datasources'];
        paths.forEach(path => {
            if (!datasources.map(ds => ds['path']).includes(path['path'])) {
                datasources.push({ "path": path['path'], "name": makeIdFromPath(path['path']), "color": kellycolors.getNextColor(), "options": [] });
            }
        });
        return({
            "id": name,
            "title": (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_TITLE:existing['title'],
            "ylabel": (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_YLABEL:existing['ylabel'],
            "ymin": (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_YMIN:existing['ymin'],
            "ymax": (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_YMAX:existing['ymax'],
            "options": (existing === undefined)?CONFIG.DEFAULT_DISPLAYGROUP_OPTIONS:existing['options'],
            "datasources": datasources
        });
	}

	function makeIdFromPath(path) {
        var retval = "";
        var parts = path.replace(/([A-Z])/g, '.$1').replace(/([0-9]+)/g, '.$1').replace("-", ".").split(".");
        var start = (parts[0] == "notifications")?2:1;
        for (var i = start; i < parts.length; i++) {
            retval += parts[i].toLowerCase().substr(0, 3);
        }
        return(retval);
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

	return plugin;
}


