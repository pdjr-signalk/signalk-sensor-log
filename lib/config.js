const fs = require('fs');
const SERVICE_CONF = __dirname + "/../systemd/service.conf"

/**
 * config.js - lots of configuration values.  Some of these are extracted from
 * the systemd service configuration file identified above using the 'V'
 * function.
 */

// File names and locations
//
module.exports.RRDTOOL = "/usr/bin/rrdtool";
module.exports.RRDTOOL_WORKING_DIRECTORY = V('RRDCACHED_WORKING_DIRECTORY');
module.exports.RRDFILENAME = V('RRD_FILE');
module.exports.RRDUSER = V('RRD_USER');
module.exports.RRDGROUP = V('RRD_GROUP');
module.exports.CHARTMANIFESTFILENAME = "public/manifest.json";
module.exports.PERIODS = [
    { name: "hour", tag: "end-1h", seconds: 3600 },
    { name: "day", tag: "end-1d", seconds: 86400 },
    { name: "week", tag: "end-1w", seconds: 604800 },
    { name: "month", tag: "end-1m", seconds: 2592000 },
    { name: "year", tag: "end-1y", seconds: 31104000 }
];

// Program settings
//
module.exports.HOUR_GRAPH_INTERVAL = 30; // 'day' graph updated every 5 minutes
module.exports.DAY_GRAPH_INTERVAL = 55; // 'day' graph updated every 5 minutes
module.exports.WEEK_GRAPH_INTERVAL = 123; // 'week' graph updated every 30 minutes
module.exports.MONTH_GRAPH_INTERVAL = 247; // 'month' graph updated every 2 hours minutes
module.exports.YEAR_GRAPH_INTERVAL = 1441; // 'year' graph updated every day
module.exports.DATAMAX = 10000;

// Defaults which configure the default state of the plugin schema
//
module.exports.DEFAULT_RRDSERVICES_RRDCACHEDSOCKET = V('RRDCACHED_SOCKET');
module.exports.DEFAULT_RRDSERVICES_RRDCHARTDPORT = V('RRDCHARTD_PORT');
module.exports.DEFAULT_RRDDATABASE_FILENAME = V('RRD_FILE');
module.exports.DEFAULT_RRDDATABASE_UPDATEINTERVAL = 10; // Database update data frequency in seconds
module.exports.DEFAULT_RRDDATABASE_OPTIONS = [ "plug", "autocreate" ];
module.exports.DEFAULT_CHART_GENERATE = true;
module.exports.DEFAULT_CHART_DIRECTORY = V('RRDCHARTD_WORKING_DIRECTORY');
module.exports.DEFAULT_CHART_CANVASCOLOR = "#000000";
module.exports.DEFAULT_CHART_BACKGROUNDCOLOR = "#000000";
module.exports.DEFAULT_CHART_FONTCOLOR = "#804000";
module.exports.DEFAULT_LOGGING_CONSOLE = [ "updates", "notifications", "errors" ];
module.exports.DEFAULT_LOGGING_SYSLOG = [ "warnings", "errors" ];
module.exports.DEFAULT_SENSOR_SELECTOR = "\.(currentLevel|power)$";
module.exports.DEFAULT_SENSOR_RESCAN = false;
module.exports.DEFAULT_SENSOR_NAME = "";
module.exports.DEFAULT_SENSOR_DISPLAYCOLOR = "#FFFFFF";
module.exports.DEFAULT_SENSOR_DISPLAYGROUPS = "ALL";
module.exports.DEFAULT_SENSOR_MULTIPLIER = 1;
module.exports.DEFAULT_SENSOR_OPTIONS = [ "stackable" ];
module.exports.DEFAULT_SENSOR_LIST = [];
module.exports.DEFAULT_DISPLAYGROUP_TITLE = "Sensor values";
module.exports.DEFAULT_DISPLAYGROUP_YLABEL = "Sensor value";
module.exports.DEFAULT_DISPLAYGROUP_YMAX = 0;
module.exports.DEFAULT_DISPLAYGROUP_OPTIONS = [];
module.exports.DEFAULT_DISPLAYGROUP_LIST = [];

function V(varname) {
    var retval;
    try {
        retval = fs.readFileSync(SERVICE_CONF).toString().split("\n").reduce((a,v) => (((r = v.match("^" + varname + "=(.*)")) != null)?r[1]:a), "");
    } catch(err) {
        retval = "";
    }
    return(retval);
}
