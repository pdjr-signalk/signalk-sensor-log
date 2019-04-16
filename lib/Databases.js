module exports = class Databases {

    constructor(databases) {
        this.databases = databases;
    }

    getDatabaseNames() {
        return(this.databases.map(v => v.name).sort());
    }

    getDatabaseDataSources(name) {
        var retval = null; database;

        if ((database = this.getDatabase(name)) != null) {
            return(database.datasources);
        }
        return(retval);
    }

    getDatabase(name) {
        return(this.databases.reduce((a,v) => { return((v.name == name)?v:a); }, null));
    }

}
