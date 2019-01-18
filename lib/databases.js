const Database = require("./database.js");
const fs = require("fs");

module.exports = class Databases {

    /**
     * Create a Databases object from an array of Signal K pathnames.
     */

    static createFromPaths(paths) {
        var retval = new Databases();
        if ((paths !== undefined) && (Array.isArray(paths)) {
            var currentDatabaseName = "" 
            var database = null;
            paths.forEach(path => {
                var databaseName = path.split('.')[0];
                if (databaseName != currentDatabaseName) { database = new Database(databaseName); retval.push(database); }
                database.add(path);
            });
        }
        return(retval);
    }

    static createFromDatabaseList(databases) {
        var retval = new Databases();
        if (databases !== undefined) {
            databases.forEach(database => { retval.add(new Database(database['name'], database['paths'])); });
        }
        return(retval);
    }

    constructor() {
        this.list = [];

    }

    getList() {
        return(this.list);
    }

    add(database) {
        var existing = this.list.reduce((a,d) => ((d.getName() == database.getName())?d:a), null);
        if (existing == null) { this.list.push(database); }
        return(this);
    }

    missingOnDisk(directory) {
        var retval = new Databases();
        retval.list = this.list.filter(database => (!fs.existsSync(directory + "/" + database.getName())));
        return(retval);
    }

    difference(databases) {
        var retval = new Databases();

        this.list.forEach(database => {
            var name = database.getName();
            var remake = false;
            var existing = databases.getList().reduce((a,d) => ((d.getName() == name)?d:a), null);
            if (existing != null) { 
                remake = (! arraysAreEqual(database.getPaths(), existing.getPaths()));
            } else {
                remake = true;
            }
            if (remake) retval.add(database); 
        });
        return(retval);
    }

    union(databases) {
        var retval = new Databases();
        this.list.forEach(database => retval.add(database));
        var retvalNames = retval.getList().map(database => database.getName());
        databases.getList().forEach(database => { if (!retvalNames.includes(database.getName())) retval.add(database); });
        return(retval);
    }

    getAllDatabasePaths() {
        var retval = [];
        this.getList().forEach(database => {
            database.getPaths().forEach(path => {
                retval.push(path);
            });
        });
        return(retval);
    }

    setAllDatabaseValues(values) {
        var retval = null;
        var pathcount = this.getList().reduce((a,database) => (a + database.pathCount()), 0);
        if (pathcount == values.length) {
            this.getList().forEach(database => { database.setValues(values.splice(0, database.pathCount())); });
            retval = this;
        }
        return(retval);
    }

    toString() {
        return(JSON.stringify(this));
    }

    
};


function arraysAreEqual(a1, a2) {
    var retval = false;
    if ((Array.isArray(a1)) && (Array.isArray(a2)) && (a1.length == a2.length)) {
        var aa1 = a1.concat().sort();
        var aa2 = a2.concat().sort();
        retval = true;
        for (var i = 0; i < aa1.length; i++) { retval &= (aa1[i] == aa2[i]) }
    }
    return(retval);
}

function dbnameFromPath(path) {
    var parts = path.split('.');
    return(parts[0]);
}

