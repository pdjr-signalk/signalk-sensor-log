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
const Kellycolors = require('./lib/kellycolors');
const rrdtool = require('./lib/rrdtool');
const Schema = require('./lib/signalk-libschema/Schema.js');
const utils = require("./lib/utils.js");
const Log = require("./lib/signalk-liblog/Log.js");

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

    const log = new Log(plugin.id, { ncallback: app.setProviderStatus, ecallback: app.setProviderError });
    const CONFIG = Schema.createSchema(PLUGIN_CONFIG_FILE, loadSystemdConfig(SYSTEMD_CONFIG_FILE)).getSchema(); 

    /**
     * Load the plugin's react:json schema from disk file, expanding variables
     * using the configuration dictionary and insert dynamic object default
     * values by interrogting the host application environment.
     */
	plugin.schema = function() {
        if (DEBUG) log.N("plugin.schema()...", false);

        var schema = Schema.createSchema(PLUGIN_SCHEMA_FILE, CONFIG);
        return(schema.getSchema());
    };

    /**
     * Load the plugin's react:json ui:schema from disk file.
     */
	plugin.uiSchema = function() {
        if (DEBUG) log.N("plugin.uiSchema()...", false);

        var schema = Schema.createSchema(PLUGIN_UISCHEMA_FILE);
        return(schema.getSchema());
    }

    /**
     * Execute the plugin by attempting to make a connection to rrdcached and
     * rrdchartd. As long as the cache daemon can be contacted, then perform a
     * few sanity checks before entering the production loop.
     */
	plugin.start = function(options) {
        if (DEBUG) log.N("plugin.start(" + JSON.stringify(options) + ")...", false);

        Promise.all([
            rrdtool.openCacheD(options.rrdservices.rrdcachedsocket, handleRrdcachedOutput),
            rrdtool.openChartD(options.chart.generatecharts?options.rrdservices.rrdchartdport:0)
        ]).then(function ([ cachedConnected, chartdConnected ]) {
            if (cachedConnected) {
                if (DEBUG) log.N("connected to cache daemon and chart daemon", false);

                // Normalise database definitions by sorting database entries and datasource
                // entries by name.
                options.databases = options.databases.sort((a,b) => ((a.name < b.name)?-1:((a.name > b.name)?1:0)));
                options.databases = options.databases.map(db => {
                    db.datasources = db.datasources.sort((a,b) => ((a.name < b.name)?-1:((a.name > b.name)?1:0)));
                    return(db);
                });

                var canProceed = true;
                options.databases.forEach(database => {
                    var dbdiskfile = options.rrddatabase.directory + "/" + database.name;
                    var dbmin = 0;
                    var dbmax = 10000;
                    var create = false;
                    if (!fs.existsSync(dbdiskfile)) {
                        console.log("database '" + dbdiskfile + "' missing on disk");
                        create = true;
                    } else {
                        if (!options.rrddatabase.databases.map(v => v.name).includes(database.name)) {
                            console.log("database configuration mismatch");
                            create = true;
                        } else {
                            if (options.rrddatabase.options.includes("rebuild")) {
	                            var existingDatabaseDefinition;
	                            if ((existingDatabaseDefinition = options.rrddatabase.databases.reduce((a,v) => (v.name == database.name), null)) != null) {
	                                var requiredDatasources = database.datasources;
	                                var existingDatasources = existingDatabaseDefinition.datasources;
	                                if (!(create = (requiredDatasources.length != existingDatasources.length))) {
	                                    for (var i = 0; i < requiredDatasources.length; i++) {
	                                        requiredDatasources[i].getOwnPropertyNames.forEach(propertyName => {
	                                            create  = (create || (requiredDatasources[i] != existingDatasources[i]));
	                                        });
	                                    }
	                                }
                                }
                            }
                        }
                    }
                    if (create) { 
			            if (rrdtool.createDatabase(
                            database.name,
                            options.rrddatabase.updateinterval, 
                            dbmin, 
                            dbmax, 
                            database.datasources.map(datasource => datasource.name), 
                            options.rrddatabase.periods
                        )) {
                            log.N("successfully created missing database '" + database.name + "'");
                        } else {
                            log.N("error creating missing database '" + database.name + "'");
                            canProceed = false;
                        }
                    } 
                });

                // All databases have been made successfully, so copy the requested configuration
                // to the actual configuration and save the application options to disk.
                // 
                if (canProceed) {
                    // Make configuration reflect requested state
                    options.rrddatabase.databases = options.databases;
                
                    // Save plugin options.
                    app.savePluginOptions(options, function(err) {
                        if (err) log.E("update of plugin options failed: " + err);
                        canProceed = false;
                    });
                }

                if (canProceed) {
                    // Handle all the various chart generation possibilities and if it seems sensible,
                    // try and save a chart manifest file so that the webapp knows what's what.
                    //
      	            if (options.displaygroups.length == 0) {
                        log.W("disabling chart generation because there are no defined display groups");
                        options.chart.generatecharts = false;
                    } else {
		                if (options.chart.generatecharts) {
                            writeManifest(CHART_MANIFEST_FILE, options.displaygroups, function(err) { if (err) log.W("update of chart manifest failed"); });
                            if (!chartdConnected) log.W("disabling chart generation because rrdchartd cannot be reached");
                        } else {
                            log.W("chart generation disabled by configuration option");
                        }
                    }

                    // Begin processing by flattening the databases structure into a one-dimensional
                    // array of Signal K data streams and an equivalent array of multiplier functions.
                    //
                    var streams = [];
                    var multipliers = [];
                    options.rrddatabase.databases.forEach(database => {
                        database.datasources.forEach(datasource => {
		                    streams.push(app.streambundle.getSelfBus(datasource.path));
                            multipliers.push(function(v) {
                                if ((v == null) || (v == NaN)) {
                                    return('U');
                                } else {
                                    var x = v * datasource.multiplier;
                                    return(Math.round((x < datasource.min)?datasource.min:((x > datasource.max)?datasource.max:x)));
                                }
                            });

                        });
                    });
                    log.N("connected to " + streams.length + " Signal K sensor streams");

    		        var tick = 1;
                    unsubscribes.push(bacon.interval((1000 * options.rrddatabase.updateinterval), 0).onValue(function(t) {
                        var seconds = Math.floor(new Date() / 1000);
    		            bacon.combineAsArray(streams).onValue(function(vals) {
                            if (DEBUG) log.N("path values: " + JSON.stringify(vals), false);
                            var pathValues = vals.map((v,i) => ((v)?((v.value)?multipliers[i](v.value):'U'):'U'));

                            options.rrddatabase.databases.forEach(database => {
                                var datasourceValues = pathValues.slice(0, database.datasources.length);
                                //if (options.logging.console.includes('updates')) log.N("updating '" + database.name + "' with " + JSON.stringify(datasourceValues));
                                rrdtool.updateDatabase(
                                    database.name,
                                    seconds,
                                    datasourceValues)
                                .then(result => {
                                    // silence is golden
                                })
                                .catch(err => {
                                    log.W("database update failed: " + err);
                                });
                                pathValues = pathValues.slice(database.datasources.length);
                            });

                            return(bacon.noMore);
                        });

                        if (options.chart.generatecharts && chartdConnected) {
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
                }
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


