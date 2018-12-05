const _ = require('./config');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const fs = require('fs');
const net = require('net');
const path = require('path');

var RRDCACHED_SOCKET = null;
var RRDCHARTD_SOCKET = null;
var DEBUG = false;


/**
 * Awaits the opening of the specified Unix socket, returning true if the
 * socket is opened successfully, otherwise false.
 */

var _openCacheD = async function(rrdcachedSocketPath) {
    if (DEBUG) console.log("rrdtool:openCacheD('" + rrdcachedSocketPath + "')...");
    RRDCACHED_SOCKET = await _openCacheDPromise(rrdcachedSocketPath).catch(err => { RRDCACHED_SOCKET = null });
    return(RRDCACHED_SOCKET != null);
}

/**
 * Promises to open a specified Unix socket. On success, assigns the opened
 * socket to RRDCACHED_SOCKET; on failure assigns the value null to
 * RRDCACHED_SOCKET.
 */

var _openCacheDPromise = function(rrdcachedSocketPath) {
    return new Promise(function(resolve, reject) {
        var socket;
        socket = net.createConnection(rrdcachedSocketPath);
        socket.on('connect', function() { resolve(socket); });
        socket.on('error', function() { reject(null); });
    });
} 

var _openChartD = async function(rrdchartdPortNumber) {
    if (DEBUG) console.log("rrdtool:openChartD(" + rrdchartdPortNumber + ")...");
    RRDCHARTD_SOCKET = await _openChartDPromise(rrdchartdPortNumber).catch(err => { RRDCHARTD_SOCKET = null });
    return(RRDCHARTD_SOCKET != null);
}

var _openChartDPromise = function(rrdchartdPortNumber) {
    return new Promise(function(resolve, reject) {
        var socket;
        socket = new net.Socket();
        socket.connect(rrdchartdPortNumber, '127.0.0.1');
        socket.on('connect', function() { resolve(socket); });
        socket.on('error', function() { reject(null); });
    });
}

var _createDatabase = async function(database, interval, min, max, dsnames, user, group) {
    if (DEBUG) console.log("rrdtool:createDatabase('" + database + ", " + interval + ", " + min + ", " + max + ", " + JSON.stringify(dsnames) + ", " + user + ", " + group + ")...");
    var retval;
    retval = await _createDatabasePromise(database, interval, min, max, dsnames, user, group).catch(err => { retval = false; });
    return(retval);
}

var _createDatabasePromise = function(database, interval, min, max, dsnames, user, group) {
    return new Promise(function(resolve, reject) {
	    var command = _.RRDTOOL;
	    command += " create '" + database + "'";
	    command += " -s " + interval;
	    dsnames.forEach(function(dsname) {
	         command += " DS:" + dsname + ":GAUGE:" + (interval * 2) + ":" + min + ":" + max;
	    });
	    
	    _.PERIODS.map(v => v['name']).forEach(function(period) {
	        switch(period) {
	            case "hour":    command += (" RRA:AVERAGE:0.5:1:" + Math.floor(3600 / (interval * 1))); break;
	            case "day":     command += (" RRA:MAX:0.5:5:" + Math.floor(86400 / (interval * 5))); break;
	            case "week":    command += (" RRA:AVERAGE:0.5:34:" + Math.floor(604800 / (interval * 34))); break;
	            case "month":   command += (" RRA:AVERAGE:0.5:144:" + Math.floor(2592000 / (interval * 144))); break;
	            case "year":    command += (" RRA:AVERAGE:0.5:1728:" + Math.floor(31104000 / (interval * 1728))); break;
	        }
	    });
	  
        command += ((user !== undefined) && (group !== undefined))?(" ; chown " + user + ":" + group + " '" + database + "'"):"";

	    exec(command, function(error, stdout, stderr) {
            if (error) { reject(false); } else { resolve(true); }
        });
    });
}

var _updateDatabase = async function(database, timestamp, dsvalues) {
    if (DEBUG) console.log("rrdtool:updateDatabase('" + database + "', " + timestamp + ", " + JSON.stringify(dsvalues) + ")..");
    var retval = true;
    try {
       await _updateDatabasePromise(database, timestamp, dsvalues);
    } catch(err) {
       retval = false;
    }
    return(retval);
}

var _updateDatabasePromise = function(database, timestamp, dsvalues) {
    return new Promise(function(resolve, reject) {
        if ((database !== undefined) && (timestamp !== undefined) && (dsvalues !== undefined) && (dsvalues.length > 0)) {
            var command = (RRDCACHED_SOCKET == null)?(_.RRDTOOL + " "):"";
            command += "update " +  ((RRDCACHED_SOCKET == null)?("'" + database + "'"):path.basename(database));
            command += " " + timestamp + ":" + dsvalues.join(":");

            if (RRDCACHED_SOCKET == null) {
	            exec(command, function(error, stdout, stderr) {
                    if (error) { reject(); } else { resolve(); }
                });
            } else {
                RRDCACHED_SOCKET.write(command + "\n", 'utf8', function(error, data) {
                    if (error) { console.log("ERROR: " + error + " " + data); reject(); } else { console.log("SUCCESS: " + error + " " + data); resolve(); }
                });
            }
        } else {
            reject();
        }
    });
}

var _createChart = async function(group, chart) {
    if (DEBUG) console.log("rrdtool:createChart('" + group + "', '" + chart + "')...");
    var retval = true;
    try {
        await _createChartPromise(group, chart);
    } catch(err) {
        retval = false;
    }
    return(retval);
}

var _createChartPromise = function(group, chart) {
    return new Promise(function(resolve, reject) {
        if (RRDCHARTD_SOCKET !== undefined) {
            RRDCHARTD_SOCKET.write(group + " " + chart + "\n", function(error, data) {
                if (error) { reject(); } else { resolve(); }
            });
        } else {
            reject();
        }
    });
}

module.exports = {
    openCacheD: _openCacheD,
    openChartD: _openChartD,
    createDatabase: _createDatabase,
    updateDatabase: _updateDatabase,
    createChart: _createChart
}

