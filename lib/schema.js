exports.generateSchema = function() {
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

exports.generateUiSchema = function() {
    return(
        {
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
	            currentselector: {
	                "ui:widget": "hidden"
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
    );
}
	
	
