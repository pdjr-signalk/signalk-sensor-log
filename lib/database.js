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
            this.paths.push(path);
            this.values.push(0);
        }
        return(this);
    }

    pathCount() {
        return(this.paths.length);
    }

    toString() {
        return(JSON.stringify(this));
    }

};
