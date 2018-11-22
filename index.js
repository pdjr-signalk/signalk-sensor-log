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

const HOUR_GRAPH_INTERVAL = 30; // 'day' graph updated every 5 minutes
const DAY_GRAPH_INTERVAL = 55; // 'day' graph updated every 5 minutes
const WEEK_GRAPH_INTERVAL = 123; // 'week' graph updated every 30 minutes
const MONTH_GRAPH_INTERVAL = 247; // 'month' graph updated every 2 hours minutes
const YEAR_GRAPH_INTERVAL = 1441; // 'year' graph updated every day
const GRAPH_INTERVALS = [ HOUR_GRAPH_INTERVAL, DAY_GRAPH_INTERVAL, WEEK_GRAPH_INTERVAL, MONTH_GRAPH_INTERVAL, YEAR_GRAPH_INTERVAL ];
const RRDCREATESCRIPT = __dirname + "/bin/createrrd";
const RRDGRAPHSCRIPT = __dirname + "/bin/graphrrd";
const GRAPH_TITLE = "Power levels over last";
const GRAPH_YLABEL = "Power/W";
const CHARTMANIFEST = "manifest.json";

const DEFAULT_RRDPATHNAME = "database.rrd";
const DEFAULT_RRDUPDATEINTERVAL = 10; // Database update data frequency in seconds
const DEFAULT_RRDOPTIONS = [];
const DEFAULT_REPORTOPTIONS = [];
const DEFAULT_CHARTDIRECTORY = "public/";
const DEFAULT_CONSOLEREPORTING = false;
const DEFAULT_DATAMAX = 10000;
const DEFAULT_DISPLAYCOLOR = "#000000";

const DEFAULT_SENSORDISPLAYNAME = "";
const DEFAULT_SENSORDISPLAYCOLOR = "#000000";
const DEFAULT_SENSORDISPLAYGROUPS = "ALL";
const DEFAULT_SENSORMULTIPLIER = 1;
const DEFAULT_SENSOROPTIONS = [ "stackable" ];

const DEFAULT_DISPLAYTITLE = "Sensor values";
const DEFAULT_DISPLAYYLABEL = "Sensor value";
const DEFAULT_DISPLAYYMAX = 0;
const DEFAULT_DISPLAYOPTIONS = [];

module.exports = function(app) {
	var RRDTOOL;
	var RRDPATHNAME;
	var CHARTDIRECTORY;
	var plugin = {};
	var unsubscribes = [];

	plugin.id = "sensor-log";
	plugin.name = "Sensor Log";
	plugin.description = "Log and chart sensor readings using a round-robin database.";

	plugin.schema = function() {
		return({	
			type: "object",
			properties: {
				rrdpathname: {
					title: "Database filename",
					type: "string",
					default: DEFAULT_RRDPATHNAME
				},
                rrdupdateinterval: {
                    title: "Database update interval",
                    type: "number",
                    default: DEFAULT_RRDUPDATEINTERVAL
                },
				rrdoptions: {
					title: "Database re-generation options",
					type: "array",
                    			default: DEFAULT_RRDOPTIONS,
					items: {
						type: "string",
						enum: [ "create", "init" ],
						enumNames: [ "Re-create database", "Re-initialise database" ]
					},
					uniqueItems: true
				},
				chartdirectory: {
					title: "Chart directory",
					type: "string",
					default: DEFAULT_CHARTDIRECTORY
				},
				reportoptions: {
					title: "Report options",
					type: "array",
                    default: DEFAULT_REPORTOPTIONS,
					items: {
						type: "string",
						enum: [ "console" ],
						enumNames: [ "Log updates to console" ]
					},
					uniqueItems: true
				},
				sensors: {
					title: "Sensors",
					type: "array",
					default: loadSensors("\.(currentLevel|power)$"),
					items: {
						type: "object",
						properties: {
							path: {
								title: "Sensor path",
								type: "string",
								default: ""
							},
							displayname: {
								title: "Display name",
								type: "string",
								default: DEFAULT_SENSORDISPLAYNAME
							},
							displaycolor: {
								title: "Default color to use for chart rendering",
								type: "string",
								default: DEFAULT_SENSORDISPLAYCOLOR
							},
							displaygroups: {
								title: "Display groups",
								type: "string",
								default: DEFAULT_SENSORDISPLAYGROUPS
							},
                            multiplier: {
                                title: "Multiplier (for example, use 100 to convert ratios to percentages)",
                                type: "number",
                                default: DEFAULT_SENSORMULTIPLIER
                            },
                            options: {
					            title: "Sensor options",
					            type: "array",
                                default: DEFAULT_SENSOROPTIONS,
					            items: {
						            type: "string",
						            enum: [ "stackable" ],
						            enumNames: [ "Stackable?" ]
					            },
					            uniqueItems: true
                            }
						}
					}
				},
				displaygroups: {
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
								default: ""
							},
							ylabel: {
								title: "Chart y-axis label",
								type: "string",
								default: ""
							},
                            ymax: {
                                title: "Maximum y-axis value",
                                type: "number",
                                default: 0
                            },
                            options: {
					            title: "Chart options",
					            type: "array",
                                default: DEFAULT_DISPLAYOPTIONS,
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
		});
	}
 
	plugin.uiSchema = {
       	rrdoptions: {
			"ui:widget": {
				component: "checkboxes",
				options: {
					inline: true
				}
			}
       	},
       	reportoptions: {
			"ui:widget": {
				component: "checkboxes",
				options: {
					inline: true
				}
			}
       	},
		sensors: {
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
		},
        displaygroups: {
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

	plugin.start = function(options) {
		// If rrdtool doesn't exist, then we can't do anything.
		//
		try {
			RRDTOOL = execSync("which rrdtool").toString().trim();
		} catch(e) {
			logEE("Cannot find required command 'rrdtool'");
			return;
		}

		// If the configuration doesn't supply a database name, then we
        // simply isupply our own. 
		//
      	if (options.rrdpathname.length == 0) {
            logWW("Database pathname was blank - using a default"); 
			options.rrdpathname = DEFAULT_RRDPATHNAME; app.savePluginOptions(options);
		}
		RRDPATHNAME = (options.rrdpathname.charAt(0) != '/')?(__dirname + "/" + options.rrdpathname):options.rrdpathname;

		// If the configuration doesn't supply a graph directory path
		// then we should warn about this because subsequently we will
		// not be producing any graphs. If it does, then we check that
		// we can write and delete files there.
		//
      	if (options.chartdirectory.length == 0) {
			logWW("Graph generation disabled at user request");
			CHARTDIRECTORY = null;
		} else {
			CHARTDIRECTORY = (options.chartdirectory.charAt(0) != '/')?(__dirname + "/" + options.chartdirectory):options.chartdirectory;
			CHARTDIRECTORY = (CHARTDIRECTORY.substr(-1) != '/')?(CHARTDIRECTORY + "/"):CHARTDIRECTORY;
			try {
  				fs.writeFileSync(CHARTDIRECTORY + "test.svg");
  				fs.unlinkSync(CHARTDIRECTORY + "test.svg");
			} catch(e) {
				logEE("Graph directory is not accessible");
				return;
			}
		}

		// If the configuration options do not include any sensor
		// definitions, then we should terminate.
		//
		if (options.rrdoptions.includes("scan")) {
			logNN(undefined, "Scanning for sensor data streams");
            options.rrdoptions.includes = [];
            options.sensors = loadSensors();
            app.savePluginOptions(options);
        }
        if (options.sensors.length == 0) {
			logEE("There are no accessible sensor data streams");
			return;
		}

        options.displaygroups = generateDisplayGroups(options.sensors, options.displaygroups);
        app.savePluginOptions(options);

		// If no database exists then we need to create one.
		//
		if ((!fs.existsSync(RRDPATHNAME)) || (options.rrdoptions.includes("create"))) {
            options.rrdoptions.includes = []; app.savePluginOptions(options);
			logNN("Creating new database '" + RRDPATHNAME + "'");
			try {
                rrdtool.createDatabase(RRDPATHNAME, options.rrdupdateinterval, 0, DEFAULT_DATAMAX, options.sensors.map(v => makeIdFromPath(v['path'])));
			} catch(err) {
				logEE("Error creating database '" + RRDPATHNAME + "'", "Error creating database '" + RRDPATHNAME + "' (" + err.toString() + ")"); 
				return;
			}
		}

		// At this point, we should have a database and we can start to play
		// with it.
		//
		// We obtain an array of sensor data streams (one for each sensor path)
		// and then zip them together as a single stream which we sample once
		// every UPDATE_INTERVAL.
		if (fs.existsSync(RRDPATHNAME)) {
			var streams = options.sensors.map(v => app.streambundle.getSelfBus(v['path']));
            var tick = 0;
			logNN("Connected to " + streams.length  + " sensor streams");

            unsubscribes.push(bacon.interval((1000 * options.rrdupdateinterval), 0).onValue(function(t) {
                tick++;
				var now = Math.floor(Date.now() / 60000);
			    bacon.zipAsArray(streams).onValue(function(v) {
                    try {
                        var val = v.map(a => ((a['value'] == null)?'U':a['value']));
                        for (var i = 0; i < options.sensors.length; i++) { val[i] *= options.sensors[i]['multiplier']; }
			            if (options.reportoptions.includes('console')) logN("Connected to " + streams.length  + " sensor streams (" + val + ")");
				        rrdtool.updateDatabase(RRDPATHNAME, v.map(a => makeIdFromPath(a['path'])), val);
                    } catch(err) {
                        logEE("Error executing update command", "Error executing update command (" + err + ")");
                    }
                    return(bacon.noMore);
                });

				if (CHARTDIRECTORY != null) {
                    options.displaygroups.forEach(function(displaygroup) {
						[ 'hour','day','week','month','year' ].filter((v,i) => ((tick % GRAPH_INTERVALS[i]) == 0)).forEach(function(period) {
	                        try {  
	                            logNN(undefined, "Generating graph for period = " + period);
                                var dgsensors = options.sensors.filter(s => (s['displaygroups'].includes(displaygroup['id'])));
                                var properties = {
	                                "displaycolors": dgsensors.map(s => s['displaycolor']),
	                                "displaynames": dgsensors.map(s => s['displayname']),
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
	                                RRDPATHNAME,
	                                dgsensors.map(s => makeIdFromPath(s['path'])),
                                    properties
	                            );
	                        } catch(err) {
	                            logEE("Error creating graph", err);
	                        }
	                    });
                    });
                    try {
                        writeManifest(CHARTDIRECTORY + CHARTMANIFEST, options.displaygroups.map(g => g['id']));
                    } catch(err) {
                        logWW("Error creating chart manifest");
                    }    
				}

			}));

		} else {
			logEE("Missing databse '" + RRDPATHNAME + "'");
			return;
		}
	}

	plugin.stop = function() {
		unsubscribes.forEach(f => f());
		unsubscribes = [];
	}

    function writeManifest(filename, entries) {
        fs.writeFile(filename, JSON.stringify(entries), function(err) {
            if (err) throw("FILEWRT: " + err);
        });
    }

	function loadSensors(regex) {
        var regexp = RegExp(regex);
	    return(app.streambundle.getAvailablePaths()
            .filter(path => (regexp.test(path)))
		    .map(path => ({ 
                "path": path,
                "displayname": makeIdFromPath(path),
                "displaycolor": kellycolors.getNextColor(),
		        "displaygroups": DEFAULT_SENSORDISPLAYGROUPS,
                "multiplier": DEFAULT_SENSORMULTIPLIER,
                "options": DEFAULT_SENSOROPTIONS
            }))
        );
	}

	function generateDisplayGroups(sensors, displaygroups) {
		var retval = [];

		var definedgroupnames = new Set(sensors.reduce((acc,s) => (acc.concat(s['displaygroups'].split(' '))),[]));
		definedgroupnames.forEach(function(definedgroupname) {
            var existing = (displaygroups !== undefined)?displaygroups.filter(dg => (dg['id'] == definedgroupname))[0]:undefined;;
            retval.push({
                id: definedgroupname,
                title: (existing === undefined)?DEFAULT_DISPLAYTITLE:existing['title'],
                ylabel: (existing === undefined)?DEFAULT_DISPLAYYLABEL:existing['ylabel'],
                ymax: (existing === undefined)?DEFAULT_DISPLAYYMAX:existing['ymax'],
                options: (existing === undefined)?DEFAULT_DISPLAYOPTIONS:existing['options']
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


