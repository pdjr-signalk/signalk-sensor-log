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
const bacon = require('baconjs');
const kellycolors = require('./lib/kellycolors');
const rrdtool = require('./lib/rrdtool');

const RRDFILENAME = "signalk-sensor-log.rrd";
const RRDLOCKFILENAME = __dirname + "/" + RRDFILENAME + ".lock";
const HOUR_GRAPH_INTERVAL = 30; // 'day' graph updated every 5 minutes
const DAY_GRAPH_INTERVAL = 55; // 'day' graph updated every 5 minutes
const WEEK_GRAPH_INTERVAL = 123; // 'week' graph updated every 30 minutes
const MONTH_GRAPH_INTERVAL = 247; // 'month' graph updated every 2 hours minutes
const YEAR_GRAPH_INTERVAL = 1441; // 'year' graph updated every day
const GRAPH_INTERVALS = [ HOUR_GRAPH_INTERVAL, DAY_GRAPH_INTERVAL, WEEK_GRAPH_INTERVAL, MONTH_GRAPH_INTERVAL, YEAR_GRAPH_INTERVAL ];
const CHARTMANIFEST = "manifest.json";
const DEFAULT_DATAMAX = 10000;

const DEFAULT_RRDSERVER_NAME = "127.0.0.1";
const DEFAULT_RRDSERVER_PORT = 13900;
const DEFAULT_RRDSERVER_OPTIONS = [ ];

const DEFAULT_RRDDATABASE_UPDATEINTERVAL = 10; // Database update data frequency in seconds
const DEFAULT_RRDDATABASE_RECREATE = false;
const DEFAULT_RRDDATABASE_OPTIONS = [ "plug" ];

const DEFAULT_CHART_DIRECTORY = "public/";
const DEFAULT_CHART_CANVASCOLOR = "#000000";
const DEFAULT_CHART_BACKGROUNDCOLOR = "#000000";
const DEFAULT_CHART_FONTCOLOR = "#804000";

const DEFAULT_LOGGING_CONSOLE = [ "updates", "notifications", "errors" ];
const DEFAULT_LOGGING_SYSLOG = [ "warnings", "errors" ];

const DEFAULT_SENSOR_SELECTOR = "\.(currentLevel|power)$";
const DEFAULT_SENSOR_RESCAN = false;
const DEFAULT_SENSOR_NAME = "";
const DEFAULT_SENSOR_DISPLAYCOLOR = "#FFFFFF";
const DEFAULT_SENSOR_DISPLAYGROUPS = "ALL";
const DEFAULT_SENSOR_MULTIPLIER = 1;
const DEFAULT_SENSOR_OPTIONS = [ "stackable" ];

const DEFAULT_DISPLAYGROUP_TITLE = "Sensor values";
const DEFAULT_DISPLAYGROUP_YLABEL = "Sensor value";
const DEFAULT_DISPLAYGROUP_YMAX = 0;
const DEFAULT_DISPLAYGROUP_OPTIONS = [];

module.exports = function(app) {
	var CHARTDIRECTORY = null;
	var plugin = {};
	var unsubscribes = [];

	plugin.id = "sensor-log";
	plugin.name = "Sensor Log";
	plugin.description = "Log and chart sensor readings using a round-robin database.";

	plugin.schema = function() {
		return({	
			type: "object",
			properties: {
                rrdserver: {
                    type: "object",
                    properties: {
                        name: {
                            title: "RRD server hostname",
                            type: "string",
                            default: DEFAULT_RRDSERVER_NAME
                        },
                        port: {
                            title: "RRD server port",
                            type: "number",
                            default: DEFAULT_RRDSERVER_PORT
                        },
				        options: {
					        title: "RRD server options",
					        type: "array",
                            default: DEFAULT_RRDSERVER_OPTIONS,
					        items: {
						        type: "string",
						        enum: [ "logeverything" ],
						        enumNames: [ "Log all database activity" ]
					        },
					        uniqueItems: true
                        }
                    }
				},
                rrddatabase: {
                    type: "object",
                    properties: {
                        updateinterval: {
                            title: "Database update interval",
                            type: "number",
                            default: DEFAULT_RRDDATABASE_UPDATEINTERVAL
                        },
                        recreate: {
                            title: "Re-create database",
                            type: "boolean",
                            default: DEFAULT_RRDDATABASE_RECREATE
                        },
                        options: {
                            title: "RRD database options",
                            type: "array",
                            default: DEFAULT_RRDDATABASE_OPTIONS,
                            items: {
                                type: "string",
                                enum: [ "plug" ],
                                enumNames: [ "Plug data holes" ],
                            },
                            uniqueItems: true
                        }
                    }
                },
                chart: {
                    type: "object",
                    properties: {
				        directory: {
					        title: "Chart directory",
					        type: "string",
					        default: DEFAULT_CHART_DIRECTORY
				        },
                        canvascolor: {
							title: "Color to use for chart canvas",
							type: "string",
							default: DEFAULT_CHART_CANVASCOLOR
                        },
                        backgroundcolor: {
							title: "Color to use for chart background",
							type: "string",
							default: DEFAULT_CHART_BACKGROUNDCOLOR
                        },
                        fontcolor: {
							title: "Color to use for chart foreground",
							type: "string",
							default: DEFAULT_CHART_FONTCOLOR
                        }
                    }
                },
                logging: {
                    type: "object",
                    properties: { 
				        console: {
					        title: "Report the following events to Signal K server console",
					        type: "array",
                            default: DEFAULT_LOGGING_CONSOLE,
					        items: {
						        type: "string",
						        enum: [ "updates", "notifications", "warnings", "errors" ],
						        enumNames: [ "Database updates", "Notifications", "Warnings", "Errors" ]
                            },
					        uniqueItems: true
                        },
                        syslog: {
					        title: "Report the following events to system log",
					        type: "array",
                            default: DEFAULT_LOGGING_SYSLOG,
					        items: {
						        type: "string",
						        enum: [ "updates", "notifications", "warnings", "errors" ],
						        enumNames: [ "Database updates", "Notifications", "Warnings", "Errors" ]
                            },
					        uniqueItems: true
                        }
                    }
				},
				sensor: {
                    type: "object",
                    properties: {
                        selector: {
                            title: "Regex to select sensor path",
                            type: "string",
                            default: DEFAULT_SENSOR_SELECTOR
                        },
                        currentselector: {
                            type: "string",
                            default: DEFAULT_SENSOR_SELECTOR
                        },
                        rescan: {
                            title: "Scan host server and re-build sensor list",
                            type: "boolean",
                            default: DEFAULT_SENSOR_RESCAN
                        },
                        list: {
					        title: "Sensor list",
					        type: "array",
					        default: loadSensors(DEFAULT_SENSOR_SELECTOR),
				        	items: {
						        type: "object",
						        properties: {
							        path: {
								        title: "Sensor path",
								        type: "string",
								        default: ""
							        },
							        name: {
								        title: "Sensor name",
								        type: "string",
								        default: DEFAULT_SENSOR_NAME
							        },
							        displaycolor: {
								        title: "Color to use when rendering this sensor",
								        type: "string",
								        default: DEFAULT_SENSOR_DISPLAYCOLOR
							        },
							        displaygroups: {
								        title: "Display groups which include this sensor",
								        type: "string",
								        default: DEFAULT_SENSOR_DISPLAYGROUPS
							        },
                                    multiplier: {
                                        title: "Multiplier for sensor values",
                                        type: "number",
                                        default: DEFAULT_SENSOR_MULTIPLIER
                                    },
                                    options: {
					                    title: "Sensor options",
					                    type: "array",
                                        default: DEFAULT_SENSOR_OPTIONS,
					                    items: {
						                    type: "string",
						                    enum: [ "stackable" ],
						                    enumNames: [ "Stackable?" ]
					                    },
					                    uniqueItems: true
                                    }
                                }
						    }
                        }
					}
				},
				displaygroup: {
                    type: "object",
                    properties: {
					    list: {
                            title: "Display groups",
					        type: "array",
					        default: generateDisplayGroups(loadSensors()),
					        items: {
						        type: "object",
						        properties: {
							        id: {
								        title: "Display group id",
								        type: "string",
								        default: ""
							        },
							        title: {
								        title: "Chart title",
								        type: "string",
								        default: DEFAULT_DISPLAYGROUP_TITLE
							        },
							        ylabel: {
								        title: "Chart y-axis label",
								        type: "string",
								        default: DEFAULT_DISPLAYGROUP_YLABEL
							        },
                                    ymax: {
                                        title: "Maximum y-axis value",
                                        type: "number",
                                        default: DEFAULT_DISPLAYGROUP_YMAX
                                    },
                                    options: {
					                    title: "Chart options",
					                    type: "array",
                                        default: DEFAULT_DISPLAYGROUP_OPTIONS,
					                    items: {
						                    type: "string",
						                    enum: [ "stack" ],
						                    enumNames: [ "Stack graph data" ]
					                    },
					                    uniqueItems: true
                                    }
                                }
					        },
					        uniqueItems: true
				        }
                    }
                }
			}
		});
	}
 
	plugin.uiSchema = {
        rrdserver: {
            "ui:field": "collapsible",
            collapse: {
                field: 'ObjectField',
                wrapClassName: 'panel-group'
            },
       	    options: {
			    "ui:widget": {
				    component: "checkboxes",
				    options: {
					    inline: true
				    }
			    }
       	    }
        },
        rrddatabase: {
            "ui:field": "collapsible",
            collapse: {
                field: 'ObjectField',
                wrapClassName: 'panel-group'
            },
       	    options: {
			    "ui:widget": {
				    component: "checkboxes",
				    options: {
					    inline: true
				    }
			    }
       	    }
       	},
        chart: {
            "ui:field": "collapsible",
            collapse: {
                field: 'ObjectField',
                wrapClassName: 'panel-group'
            },
			canvascolor: {
				"ui:widget": "color"
			},
			backgroundcolor: {
				"ui:widget": "color"
			},
			fontcolor: {
				"ui:widget": "color"
			},
        },
        logging: {
            "ui:field": "collapsible",
            collapse: {
                field: 'ObjectField',
                wrapClassName: 'panel-group'
            },
       	    console: {
			    "ui:widget": {
				    component: "checkboxes",
				    options: {
					    inline: true
				    }
			    }
       	    },
       	    syslog: {
			    "ui:widget": {
				    component: "checkboxes",
				    options: {
					    inline: true
				    }
			    }
       	    }
        },
		sensor: {
            "ui:field": "collapsible",
            collapse: {
                field: 'ObjectField',
                wrapClassName: 'panel-group'
            },
            list: {
			    "ui:options": {
				    addable: false
			    },
			    items: {
				    path: {
					    "ui:disabled": true
				    },
				    displaycolor: {
					    "ui:widget": "color"
				    },
                    isratio: {
                    },
                    options: {
			            "ui:widget": {
				            component: "checkboxes",
				            options: {
					            inline: true
				            }
			            }
                    }
                }
			}
		},
        displaygroup: {
            "ui:field": "collapsible",
            collapse: {
                field: 'ObjectField',
                wrapClassName: 'panel-group'
            },
            list: {
                items: {
       	            options: {
			            "ui:widget": {
				            component: "checkboxes",
				            options: {
					            inline: true
				            }
			            }
       	            }
                }
            }
	    }
    }

	plugin.start = function(options) {
        //////////////////////////////////////////////////////////////////////
        // SOME OPTIONS REQUIRE AN IMMEDIATE RESTART /////////////////////////
        //////////////////////////////////////////////////////////////////////

		// If the user has changed the sensor selector regex or has explicitly
        // requested a re-scan of sensor paths, then we comply and immediately
        // re-start the plugin.
		//
		if ((options.sensor.rescan) || (options.sensor.selector != options.sensor.currentselector)) {
			logNN(undefined, "Scanning server for sensor data streams");
            options.sensor.list = loadSensors(options.sensor.selector, options.sensor.list);
            options.sensor.rescan = false;
            options.sensor.currentselector = options.sensor.selector;
            app.savePluginOptions(options);
            // TODO restart plugin
        }


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

		// If the configuration supplies a graph directory path then we check
        // that we can create and delete files there.
		//
      	if (options.chart.directory !== undefined) {
			CHARTDIRECTORY = (options.chart.directory.charAt(0) != '/')?(__dirname + "/" + options.chart.directory):options.chart.directory;
			CHARTDIRECTORY = (CHARTDIRECTORY.substr(-1) != '/')?(CHARTDIRECTORY + "/"):CHARTDIRECTORY;
			try {
  				fs.writeFileSync(CHARTDIRECTORY + "test.svg");
  				fs.unlinkSync(CHARTDIRECTORY + "test.svg");
			} catch(e) {
				logEE("Graph directory is not accessible");
				return;
			}
		}

        // TODO - check that database TCP socket is active.

        //////////////////////////////////////////////////////////////////////
        // HOUSEKEEPING //////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////

        // Update the displaygroup options from the sensor list, just in-case
        // there have been any changes.
        //
        options.displaygroup.list = generateDisplayGroups(options.sensor.list, options.displaygroup.list);

        // Warn the user if chart generation has been disabled.
        //
      	if (CHARTDIRECTORY == null) {
			logWW("Graph generation disabled at user request");
        }

        // If the user wants a new database, then make sure one will
        // subsequently be created by deleting any database lock file.
        //
        if (options.rrddatabase.recreate) {
            fs.unlinkSync(RRDLOCKFILENAME);
            options.rrddatabase.recreate = false;
        }

        // We may have changes some options, so let's save the options to disk
        // just to be on the safe side.
        //
        app.savePluginOptions(options);

        //////////////////////////////////////////////////////////////////////
        // BEGIN /////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////

        // Tell the rrdtool library that we will be using a remote server to
        // manage database operations.
        //
        rrdtool.useServer(options.rrdserver.name, options.rrdserver.port, (options.rrdserver.options.includes("logeverything")?2:1));

        // If no database exists then we need to create one.  We check for the
        // presence of the database lockfile and if it isn't there then we
        // make the create call.
		//
		if (!fs.existsSync(RRDLOCKFILENAME)) {
			logNN("Creating new database '" + RRDFILENAME + "'");
			try {
                rrdtool.createDatabase(RRDFILENAME, options.rrddatabase.updateinterval, 0, DEFAULT_DATAMAX, options.sensor.list.map(v => makeIdFromPath(v['path'])));
                fs.closeSync(fs.openSync(RRDLOCKFILENAME, 'w'));
			} catch(err) {
			    logEE("Error creating database '" + RRDFILENAME + "'", "Error creating database '" + RRDFILENAME + "' (" + err.toString() + ")"); 
			    return;
			}
		}

		// At this point, we should have a database and we can start to play
		// with it.
		//
		// We obtain an array of sensor data streams (one for each sensor path)
		// and then zip them together as a single stream which we sample once
		// every UPDATE_INTERVAL.
        //
		var streams = options.sensor.list.map(v => app.streambundle.getSelfBus(v['path']));
        var tick = 0;
		logNN("Connected to " + streams.length  + " sensor streams");

        unsubscribes.push(bacon.interval((1000 * options.rrddatabase.updateinterval), 0).onValue(function(t) {
            tick++;
	    	var now = Math.floor(Date.now() / 60000);
		    bacon.zipAsArray(streams).onValue(function(v) {
                try {
                    var val = v.map(a => ((a['value'] == null)?'U':a['value']));
                    for (var i = 0; i < options.sensor.list.length; i++) { val[i] *= options.sensor.list[i]['multiplier']; }
		            if (options.logging.console.includes('updates')) logN("Connected to " + streams.length  + " sensor streams (" + val + ")");
			        rrdtool.updateDatabase(RRDFILENAME, v.map(a => makeIdFromPath(a['path'])), val);
                } catch(err) {
                    logEE("Error executing update command", "Error executing update command (" + err + ")");
                }
                return(bacon.noMore);
            });

			if (CHARTDIRECTORY != null) {
                options.displaygroup.list.forEach(function(displaygroup) {
					[ 'hour','day','week','month','year' ].filter((v,i) => ((tick % GRAPH_INTERVALS[i]) == 0)).forEach(function(period) {
	                    try {  
	                        logNN(undefined, "Generating graph for period = " + period);
                            var dgsensors = options.sensor.list.filter(s => (s['displaygroups'].includes(displaygroup['id'])));
                            var properties = {
                                "canvascolor": options.chart.canvascolor,
                                "backgroundcolor": options.chart.backgroundcolor,
                                "fontcolor": options.chart.fontcolor,
	                            "displaycolors": dgsensors.map(s => s['displaycolor']),
	                            "displaynames": dgsensors.map(s => s['name']),
	                            "period": period,
	                            "title": displaygroup['title'] + " (over past " + period + ")",
	                            "ylabel": displaygroup['ylabel'],
                                "ymax": displaygroup['ymax']
                            };
                            if (displaygroup['options'].includes('stack')) {
                                properties.linetypes = dgsensors.map(s => (s['options'].includes('stackable')?'AREA':'LINE2'));
                                properties.stack = dgsensors.map(s => s['options'].includes('stackable'));
                            }
	                        rrdtool.createChart(
	                            CHARTDIRECTORY + displaygroup['id'] + ".",
	                            RRDFILENAME,
	                            dgsensors.map(s => makeIdFromPath(s['path'])),
                                properties
	                        );
	                    } catch(err) {
	                        logEE("Error creating chart", err);
	                    }
	                });
                });
                try {
                    writeManifest(CHARTDIRECTORY + CHARTMANIFEST, options.displaygroup.list);
                } catch(err) {
                    logWW("Error creating chart manifest");
                }    
	    	}
		}));
	}

	plugin.stop = function() {
		unsubscribes.forEach(f => f());
		unsubscribes = [];
	}

    function writeManifest(filename, displaygroups) {
        fs.writeFile(filename, JSON.stringify(displaygroups.map(dg => ({ id: dg['id'], title: dg['title'] }))), function(err) {
            if (err) throw("FILEWRT: " + err);
        });
    }

    /**
     * Recovers the list of currently available data paths from the Signal K
     * server and filters them using the supplied regular expression.  The
     * result of this operation is cached to disk and returned to the
     * caller.
     */

	function loadSensors(regex, sensors) {
        var regexp = RegExp(regex);
        var retval = app.streambundle.getAvailablePaths()
            .filter(path => (regexp.test(path)))
		    .map(function(path) {  
                var existing = (sensors !== undefined)?sensors.reduce((a,s) => ((s['path'] == path)?s:a),undefined):undefined;
                return({
                    "path": path,
                    "name": (existing === undefined)?makeIdFromPath(path):existing['name'],
                    "displaycolor": (existing === undefined)?kellycolors.getNextColor():existing['displaycolor'],
		            "displaygroups": (existing === undefined)?DEFAULT_SENSOR_DISPLAYGROUPS:existing['displaygroups'],
                    "multiplier": (existing === undefined)?DEFAULT_SENSOR_MULTIPLIER:existing['multiplier'],
                    "options": (existing === undefined)?DEFAULT_SENSOR_OPTIONS:existing['options']
                });
            });
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
                title: (existing === undefined)?DEFAULT_DISPLAYGROUP_TITLE:existing['title'],
                ylabel: (existing === undefined)?DEFAULT_DISPLAYGROUP_YLABEL:existing['ylabel'],
                ymax: (existing === undefined)?DEFAULT_DISPLAYGROUP_YMAX:existing['ymax'],
                options: (existing === undefined)?DEFAULT_DISPLAYGROUP_OPTIONS:existing['options']
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


