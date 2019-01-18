module.exports = class Database {

    constructor(name, paths) {
        this.name = name;
        this.paths = ((paths !== undefined)?paths:[]);
        this.values = ((paths !== undefined)?(new Array(paths.length).fill(0)):[]);
    }

    getName() {
        return(this.name);
    }

    getPaths() {
        return(this.paths);
    }

    setPaths(paths) {
        this.paths = paths;
        return(this);
    }

    getValues() {
        return(this.values);
    }

    setValues(values) {
        if (values.length == this.paths.length) {
            this.values = values;
            return(this);
        } else {
            return(null);
        }
    }

    addPath(path) {
        if (!this.paths.includes(path)) {
            this.paths.push(path); this.paths = this.paths.sort(); 
            this.values.push(0);
        }
        return(this);
    }

    pathCount() {
        return(this.paths.length);
    }

    equals(database) {
        var retval = false;
        if (this.name = database.getName()) {
            var databaseValues = database.getValues();
            if (this.values.length == databaseValues.length) {
                retval = true;
                for (var i = 0; i < this.length; i++) retval = retval && (this.values[i] == databaseValues[i]) 
            }
        }
        return(retval);
    }

    toString() {
        return(JSON.stringify(this));
    }

};
