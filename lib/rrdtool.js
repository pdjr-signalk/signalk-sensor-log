const net = require('net');

var RRDCACHED_SOCKET = null;
var RRDCHARTD_SOCKET = null;
var DEBUG = false;


/**
 * Awaits the opening of the specified Unix socket, returning a resolved
 * Promise with the value true if the socket is opened successfully,
 * otherwise false.
 */

var _openCacheD = async function(rrdcachedSocketPath, callback) {
    if (DEBUG) console.log("rrdtool:openCacheD('" + rrdcachedSocketPath + "')...");
    RRDCACHED_SOCKET = await _openCacheDPromise(rrdcachedSocketPath).catch(err => {
        RRDCACHED_SOCKET = null;
    });
    if (RRDCACHED_SOCKET != null) RRDCACHED_SOCKET.on('data', data => { callback(data.toString()); });
    return(RRDCACHED_SOCKET != null);
}

/**
 * Promises to open a specified Unix socket. On success, assigns the opened
 * socket to RRDCACHED_SOCKET and calls resolve(); on failure assigns the
 * value null to RRDCACHED_SOCKET and calls reject().
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

    if (rrdchartdPortNumber != 0) {
        RRDCHARTD_SOCKET = await _openChartDPromise(rrdchartdPortNumber).catch(err => {
            RRDCHARTD_SOCKET = null;
        });
    }
    return(RRDCHARTD_SOCKET != null);
}

var _openChartDPromise = function(rrdchartdPortNumber) {
    return new Promise(function(resolve, reject) {
        var socket;
        socket = new net.Socket();
        socket.connect(rrdchartdPortNumber, '127.0.0.1');
        socket.on('connect', function() { resolve(socket); });
        socket.on('error', function() { });
        socket.on('close', function(err) { socket.connect(rrdchartdPortNumber, '127.0.0.1'); });
    });
}

/**
 * Creates a new RRD database and returns a resolved Promise containing either
 * true (on success) or false (on failure).
 */

var _createDatabase = async function(database, interval, min, max, dsnames, periods) {
    if (DEBUG) console.log("rrdtool:createDatabase('" + database + ", " + interval + ", " + min + ", " + max + ", " + JSON.stringify(dsnames) + ")...");

    var retval = false;
    if (RRDCACHED_SOCKET != null) {
        retval = await _createDatabasePromise(database, interval, min, max, dsnames, periods).catch(err => {
            retval = false;
        });
    }
    return(retval);
}

var _createDatabasePromise = function(database, interval, min, max, dsnames, periods) {
    return new Promise(function(resolve, reject) {
	    var command = "create " + database + " -s " + interval;
	    dsnames.forEach(function(dsname) {
	        command += " DS:" + dsname + ":GAUGE:" + (interval * 2) + ":" + min + ":" + max;
	    });
	    periods.forEach(period => {
	        command += (" RRA:" + period['consolidate'] + ":0.5:" + period['stepfactor'] + ":" + Math.floor(period['seconds'] / (interval * period['stepfactor'])));
	    });
	  
        RRDCACHED_SOCKET.write(command + "\n", 'utf8', function(error, data) {
            if (error) { reject(false); } else { resolve(true); }
        });
    });
}

var _updateDatabase = async function(database, timestamp, dsvalues) {
    if (DEBUG) console.log("rrdtool:updateDatabase('" + database + "', " + timestamp + ", " + JSON.stringify(dsvalues) + ")..");

    var retval = false;
    if (RRDCACHED_SOCKET != null) {
        retval = await _updateDatabasePromise(database, timestamp, dsvalues).catch(err => {
            retval = false;
        });
    }
    return(retval);
}

var _updateDatabasePromise = function(database, timestamp, dsvalues) {
    return new Promise(function(resolve, reject) {
        var command = "UPDATE " +  database + " " + timestamp + ":" + dsvalues.join(":");
        RRDCACHED_SOCKET.write(command + "\n", "utf8", function(error, data) {
            if (error) { reject(false); } else { resolve(true); }
        });
    });
}
    
var _createChart = async function(group, chart) {
    if (DEBUG) console.log("rrdtool:createChart('" + group + "', '" + chart + "')...");

    var retval = false;
    if (RRDCHARTD_SOCKET != null) {
        retval = await _createChartPromise(group, chart).catch(error => {
            retval = false;
        });
    }
    return(retval);
}

var _createChartPromise = function(group, chart) {
    return new Promise(function(resolve, reject) {
        RRDCHARTD_SOCKET.write(group + " " + chart + "\n", 'utf8', function(error, data) {
            if (error) { reject(false); } else { resolve(true); }
        });
    });
}

module.exports = {
    openCacheD: _openCacheD,
    openChartD: _openChartD,
    createDatabase: _createDatabase,
    updateDatabase: _updateDatabase,
    createChart: _createChart
}

