const _ = require("./config");
const fs = require('fs');

module.exports.schema = {
    type: "object",
    properties: {
        rrdservices: {
            type: "object",
            properties: {
                rrdcachedsocket: {
                    title: "RRD update service socket",
                    type: "string",
                    default: _.DEFAULT_RRDSERVICES_RRDCACHEDSOCKET
                },
                rrdchartdport: {
                    title: "RRD chart service port",
                    type: "string",
                    default: _.DEFAULT_RRDSERVICES_RRDCHARTDPORT
                }
            }
        },
        rrddatabase: {
            type: "object",
            properties: {
                filename: {
                    title: "Database filename",
                    type: "string",
                    default: _.DEFAULT_RRDDATABASE_FILENAME
                },
                updateinterval: {
                    title: "Database update interval",
                    type: "number",
                    default: _.DEFAULT_RRDDATABASE_UPDATEINTERVAL
                },
                options: {
                    title: "RRD database options",
                    type: "array",
                    default: _.DEFAULT_RRDDATABASE_OPTIONS,
                    items: {
                        type: "string",
                        enum: [ "plug", "autocreate", "createnow" ],
                        enumNames: [ "Plug data holes", "Recreate database if plugin list changes", "Recreate database now" ],
                    },
                    uniqueItems: true
                }
            }
        },
        chart: {
            type: "object",
            properties: {
                generatecharts: {
                    title: "Generate charts?",
                    type: "boolean",
                    default: _.DEFAULT_CHART_GENERATE
                },
                directory: {
                    title: "Directory for generated charts",
                    type: "string",
                    default: _.DEFAULT_CHART_DIRECTORY
                },
                canvascolor: {
                    title: "Color to use for chart canvas",
                    type: "string",
                    default: _.DEFAULT_CHART_CANVASCOLOR
                },
                backgroundcolor: {
                    title: "Color to use for chart background",
                    type: "string",
                    default: _.DEFAULT_CHART_BACKGROUNDCOLOR
                },
                fontcolor: {
                    title: "Color to use for chart foreground",
                    type: "string",
                    default: _.DEFAULT_CHART_FONTCOLOR
                }
            }
        },
        logging: {
            type: "object",
            properties: { 
                console: {
                    title: "Report the following events to Signal K server console",
                    type: "array",
                    default: _.DEFAULT_LOGGING_CONSOLE,
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
                    default: _.DEFAULT_LOGGING_SYSLOG,
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
                    default: _.DEFAULT_SENSOR_SELECTOR
                },
                currentselector: {
                    type: "string",
                    default: ""
                },
                rescan: {
                    title: "Scan host server and re-build sensor list",
                    type: "boolean",
                    default: _.DEFAULT_SENSOR_RESCAN
                },
                list: {
                    title: "Sensor list",
                    type: "array",
                    default: _.DEFAULT_SENSOR_LIST,
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
                                default: _.DEFAULT_SENSOR_NAME
                            },
                            displaycolor: {
                                title: "Color to use when rendering this sensor",
                                type: "string",
                                default: _.DEFAULT_SENSOR_DISPLAYCOLOR
                            },
                            displaygroups: {
                                title: "Display groups which include this sensor",
                                type: "string",
                                default: _.DEFAULT_SENSOR_DISPLAYGROUPS
                            },
                            multiplier: {
                                title: "Multiplier for sensor values",
                                type: "number",
                                default: _.DEFAULT_SENSOR_MULTIPLIER
                            },
                            options: {
                                title: "Sensor options",
                                type: "array",
                                default: _.DEFAULT_SENSOR_OPTIONS,
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
                dbpaths: {
                    type: "array",
                    default: [],
                    items: {
                        type: "string",
                        default: ""
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
	                default: _.DEFAULT_DISPLAYGROUP_LIST,
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
	                            default: _.DEFAULT_DISPLAYGROUP_TITLE
	                        },
	                        ylabel: {
	                            title: "Chart y-axis label",
	                            type: "string",
	                            default: _.DEFAULT_DISPLAYGROUP_YLABEL
	                        },
	                        ymax: {
	                            title: "Maximum y-axis value",
	                            type: "number",
	                            default: _.DEFAULT_DISPLAYGROUP_YMAX
	                        },
	                        options: {
	                            title: "Chart options",
	                            type: "array",
                                default: _.DEFAULT_DISPLAYGROUP_OPTIONS,
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
}

module.exports.uiSchema = {
    rrdservices: {
        "ui:field": "collapsible",
        collapse: {
            field: 'ObjectField',
            wrapClassName: 'panel-group'
        }
    },
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
        dbpaths: {
            "ui:widget": "hidden"
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
    
    
