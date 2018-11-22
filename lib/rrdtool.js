/**
 * Module giving quick access to RRDtool.
 */

const execSync = require('child_process').execSync;
const exec = require('child_process').exec;
const fs = require('fs');
const kellycolors = require('./kellycolors');

const DEFAULT_CANVASCOLOR = "#000000";
const DEFAULT_BACKGROUNDCOLOR = "#000000";
const DEFAULT_FONT = "LEGEND:8:Courier New"; 
const DEFAULT_FONTCOLOR = "#ff7f7f";
const DEFAULT_IMGFORMAT = "svg";

const RRDTOOL = "rrdtool"; 
const PERIODS = [
    { name: "hour", tag: "end-1h", seconds: 3600 },
    { name: "day", tag: "end-1d", seconds: 86400 },
    { name: "week", tag: "end-1w", seconds: 604800 },
    { name: "month", tag: "end-1m", seconds: 2592000 },
    { name: "year", tag: "end-1y", seconds: 31104000 }
];

/**
 * Create a new round-robin database with the defined properties.
 *
 * filename - name for the new database.
 * interval - database update interval in seconds.
 * min - the minimum data value that should be stored.
 * max - the maximum data value that should be stored.
 * dsnames - array of data-source vnames.
 *
 * throws - exception on argument errors and command execution error.
 *
 * The rrdtool command is executed synchronously.
 */

exports.createDatabase = function(filename, interval, min, max, dsnames) {
    if (filename === null) throw("ERRNULLFILENAME");
    if ((dsnames === null) || (dsnames.length == 0)) throw("ERRNODSNAMES");
    
    var command = RRDTOOL;
    command += " create '" + filename + "'";
    command += " --step " + interval;
    dsnames.forEach(function(dsname) {
         command += " DS:" + dsname + ":GAUGE:" + (interval * 2) + ":" + min + ":" + max;
    });
    PERIODS.map(v => v['name']).forEach(function(period) {
        switch(period) {
            case "hour":    command += (" RRA:AVERAGE:0.5:1:" + Math.floor(3600 / (interval * 1))); break;
            case "day":     command += (" RRA:MAX:0.5:5:" + Math.floor(86400 / (interval * 5))); break;
            case "week":    command += (" RRA:AVERAGE:0.5:34:" + Math.floor(604800 / (interval * 34))); break;
            case "month":   command += (" RRA:AVERAGE:0.5:144:" + Math.floor(2592000 / (interval * 144))); break;
            case "year":    command += (" RRA:AVERAGE:0.5:1728:" + Math.floor(31104000 / (interval * 1728))); break;
        }
    });
  
    execSync(command);
}

/**
 * Update an rrd database with some values.  The update command is executed
 * asynchronously.
 *
 * filename - name of the rrd database.
 * dsnames - array of dataset names.
 * dsvalues - corresponding array of dataset values.
 * throws - an error on invalid arguments and update failure.
 */

exports.updateDatabase = function(filename, dsnames, dsvalues) {
    if (filename === null) throw("ERRNULLFILENAME");
    if ((dsnames === null) || (dsnames.length == 0)) throw("ERRNODSNAMES");
    if ((dsvalues === null) || (dsvalues.length == 0)) throw("ERRNODSVALUES");
    if (dsnames.length != dsvalues.length) throw("ERRDSPROBLEM");

    var command = RRDTOOL;
    command += " update " + filename;
    command += " -t " + dsnames.join(":");
    command += " N:" + dsvalues.join(":");

	exec(command, function(error, stdout, stderr) { if (error) throw("ERRUPDATE: " + stderr); });
}

exports.createChart = function(dirname, filename, dsnames, options) {
    if (dirname === null) throw("ERRNULLDIRNAME");
    if (filename === null) throw("ERRNULLFILENAME");
    if ((dsnames === null) || (dsnames.length == 0)) throw("ERRNODSNAMES");
    
    console.log(JSON.stringify(options));

    var optBackgroundColor = (options.backgroundcolor === undefined)?DEFAULT_BACKGROUNDCOLOR:options.backgroundcolor;
    var optCanvasColor = (options.canvascolor === undefined)?DEFAULT_CANVASCOLOR:options.canvascolor;
    var optDisplayColors = (options.displaycolors === undefined)?kellycolors.getColors(dsnames.length):options.displaycolors;
    var optDisplayNames = (options.displaynames === undefined)?dsnames:options.displaynames;
    var optFontColor = (options.fontcolor === undefined)?DEFAULT_FONTCOLOR:options.fontcolor;
    var optFont = (options.font === undefined)?DEFAULT_FONT:options.font;
    var optImgFormat = (options.imgformat === undefined)?DEFAULT_IMGFORMAT:options.imgformat;
    var optLineTypes = (options.linetypes === undefined)?(new Array(dsnames.length).fill("LINE2")):options.linetypes;
    var optPeriod = (options.period === undefined)?"hour":options.period;
    var optStack = (options.stack === undefined)?(new Array(dsnames.length).fill(false)):options.stack;
    var optTitle = (options.title === undefined)?"Title not defined":options.title;
    var optYLabel = (options.ylabel === undefined)?"Not defined":options.ylabel;
    var optYMax = (options.ymax === undefined)?undefined:options.ymax;

    var command = RRDTOOL;
    command += " graph '" + dirname + optPeriod + "." + optImgFormat.toLowerCase() + "'"
    command += " -T 80";
    command += " --imgformat " + optImgFormat.toUpperCase();
    command += " --font '" + optFont + "'"; 
    command += " --title '" + optTitle + "'";
    command += " --vertical-label '" + optYLabel + "'";
    command += " --watermark 'Generated on " +  (new Date()).toISOString() + "'";
    command += " --start '" + PERIODS.filter(v => (v['name'] == optPeriod))[0].tag + "'";
    command += " --lower-limit=0";
    if ((optYMax !== undefined) && (optYMax != 0)) command += " --upper-limit=" + optYMax;
    command += " --slope-mode";
    command += " --rigid";
    command += " --color CANVAS" + optCanvasColor;
    command += " --color BACK" + optBackgroundColor;
    command += " --color FONT" + optFontColor;
    command += " --full-size-mode";
    command += " --width=800";
    command += " --height=300";
    dsnames.forEach(function(dsname) {
        command += " DEF:" + dsname + "=" + filename + ":" + dsname + ":AVERAGE";
        command += " VDEF:" + dsname + "min=" + dsname + ",MINIMUM";
        command += " VDEF:" + dsname + "max=" + dsname + ",MAXIMUM";
        command += " VDEF:" + dsname + "avg=" + dsname + ",AVERAGE";
        command += " CDEF:" + dsname + "filled=" + dsname + ",UN," + dsname + "avg," + dsname + ",IF";
        command += " CDEF:" + dsname + "fixed=" + dsname + "filled," + PERIODS.filter(v => (v['name'] == optPeriod))[0].seconds + ",/";
        command += " VDEF:" + dsname + "total=" + dsname + "fixed,TOTAL";
    });
    command += " COMMENT:'" + "Data stream".padEnd(19, ' ') + "Min  ".padStart(13, ' ') + "Max  ".padStart(14, ' ') + "Average  ".padStart(14, ' ') + "Derived".padStart(13, ' ') + "\\n'"; 
    for (var i = 0; i < dsnames.length; i++) {
        var dsname = dsnames[i];
        command += " " + optLineTypes[i] + ":" + dsname + optDisplayColors[i] + ":'" + optDisplayNames[i].padEnd(15, ' ')  + "'" + ((optStack[i])?":STACK":"");
        command += " GPRINT:" + dsname + "min:'%10.2lf  '";
        command += " GPRINT:" + dsname + "max:'%10.2lf  '";
        command += " GPRINT:" + dsname + "avg:'%10.2lf  '";
        command += " GPRINT:" + dsname + "total:'%10.2lf\\n'";
    };

	exec(command, function(error, stdout, stderr) { if (error) throw("ERRGRAPH: " + stderr); });
}
