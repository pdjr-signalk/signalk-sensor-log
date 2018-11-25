// File names and locations
//
module.exports.RRDFILENAME = "signalk-sensor-log.rrd";
module.exports.RRDLOCKFILENAME = __dirname + "/signalk-sensor-log.rrd.lock";
module.exports.CHARTDIRECTORY = "public/";
module.exports.CHARTMANIFEST = "manifest.json";

// Program settings
//
module.exports.HOUR_GRAPH_INTERVAL = 30; // 'day' graph updated every 5 minutes
module.exports.DAY_GRAPH_INTERVAL = 55; // 'day' graph updated every 5 minutes
module.exports.WEEK_GRAPH_INTERVAL = 123; // 'week' graph updated every 30 minutes
module.exports.MONTH_GRAPH_INTERVAL = 247; // 'month' graph updated every 2 hours minutes
module.exports.YEAR_GRAPH_INTERVAL = 1441; // 'year' graph updated every day
module.exports.DATAMAX = 10000;

// Defaults which configure the plugin schema
//
module.exports.RRDSERVER_NAME = "127.0.0.1";
module.exports.RRDSERVER_PORT = 13900;
module.exports.RRDSERVER_OPTIONS = [ ];
module.exports.RRDDATABASE_UPDATEINTERVAL = 10; // Database update data frequency in seconds
module.exports.RRDDATABASE_RECREATE = false;
module.exports.RRDDATABASE_OPTIONS = [ "plug" ];
module.exports.CHART_DIRECTORY = "public/";
module.exports.CHART_CANVASCOLOR = "#000000";
module.exports.CHART_BACKGROUNDCOLOR = "#000000";
module.exports.CHART_FONTCOLOR = "#804000";
module.exports.LOGGING_CONSOLE = [ "updates", "notifications", "errors" ];
module.exports.LOGGING_SYSLOG = [ "warnings", "errors" ];
module.exports.SENSOR_SELECTOR = "\.(currentLevel|power)$";
module.exports.SENSOR_RESCAN = false;
module.exports.SENSOR_NAME = "";
module.exports.SENSOR_DISPLAYCOLOR = "#FFFFFF";
module.exports.SENSOR_DISPLAYGROUPS = "ALL";
module.exports.SENSOR_MULTIPLIER = 1;
module.exports.SENSOR_OPTIONS = [ "stackable" ];
module.exports.DISPLAYGROUP_TITLE = "Sensor values";
module.exports.DISPLAYGROUP_YLABEL = "Sensor value";
module.exports.DISPLAYGROUP_YMAX = 0;
module.exports.DISPLAYGROUP_OPTIONS = [];
