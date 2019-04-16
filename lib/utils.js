const fs = require("fs");

const DEBUG = false;

"use strict;"

var createDatabasesFromPaths = function(paths, existingDatabases, callback) {
    if (DEBUG) console.log("createDatabasesFromPaths(%s,%s)...", JSON.stringify(paths), callback);
    var retval = [];
    if ((paths !== undefined) && (Array.isArray(paths))) {
        var database = null;
        paths.map(path => path['path']).forEach(path => {
            var databaseName = path.split('.')[0] + ".rrd";
            if ((database == null) || (databaseName != database['name'])) {
                if (database != null) retval.push(database);
                database = { "name": databaseName, "datasources": [ { "name": callback(path), "path": path, "value": 0 } ] };
            } else {
                database['datasources'].push({ "name": callback(path), "path": path, "value": 0 });
            }
        });
        if (database != null) retval.push(database);
    }
    return(retval);
}

var setAllDatabaseValues = function(databases, values) {
    var retval = null;
    var pathcount = databases.reduce((a,database) => (a + database['datasources'].length), 0);
    if (pathcount == values.length) {
        databases.forEach(database => {
            database['datasources'].forEach(datasource => {
                datasource['value'] = values.shift();
            });
        });
        retval = databases;
    }
    return(retval);
}

var createDisplaygroupsFromPaths = function(paths, displaygroups, makeDisplayGroup) {
	var retval = [];

	var groupnames = Array.from(new Set(paths.reduce((a,path) => (a.concat((path['displaygroups'].match(/\S+/g) || []))),[])));
	groupnames.forEach(groupname => {
        var existingDisplayGroup = (displaygroups !== undefined)?displaygroups.filter(dg => (dg['id'] == groupname))[0]:undefined;
        var grouppaths = paths.filter(path => path['displaygroups'].includes(groupname));
        retval.push(makeDisplayGroup(groupname, grouppaths, existingDisplayGroup));
    });
    return(retval);
}

var getMissingDatabases = function(databases, directory) {
    return(databases.filter(d => (!fs.existsSync(directory + "/" + d['name']))));
}

var getChangedDatabases = function(databasesA, databasesB) {
    retval = [];
    databasesA.forEach(databaseA => {
        var databaseB = databasesB.reduce((a,db) =>  ((db['name'] == databaseA['name'])?db:a), undefined);
        if ((databaseB === undefined) || (!compareDatabaseSchema(databaseA, databaseB))) retval.push(databaseA);
    });
    return(retval);
}

var mergeDatabases = function(databasesA, databasesB) {
    retval = [];
    databasesA.forEach(database => { retval.push(database); });
    databasesB.forEach(database => {
        if (!retval.map(d => d['name']).includes(database['name'])) retval.push(database);
    });
    return(retval);
}

var updateDatabases = function (databases, database) {
    var replaced = false;

    for (var i = 0; i < databases.length; i++) {
        if (databases[i]['name'] == database['name']) {
            databases[i] = database;
            replaced = true;
        }
    }
    if (!replaced) databases.push(database);
    return(databases);
}

var getAllDatabasePaths = function(databases) {
    return(databases.reduce((a,d) => (a.concat(d['datasources'].map(d => d['path']))), []));
}

var compareDatabaseSchema = function(databaseA, databaseB) {
    var retval = false;
    if (databaseA['name'] == databaseB['name']) {
        retval = true;
        databaseA['datasources'].forEach(datasource => {
            retval = (retval && databaseB['datasources'].map(ds => ds['path']).includes(datasource['path']));
        });
    }
    return(retval);
}


module.exports = {
    setAllDatabaseValues: setAllDatabaseValues,
    updateDatabases: updateDatabases
}
