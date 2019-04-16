/**
 * log.js - class implementing log operations for Signal K plugins.
 * 
 * Writes log messages to both the Signal K server dashboard and the host system logging facility.
 * Typical use in a Signal K context will be:
 * 
 * const log = new Log(app.setProviderStatus, app.setProviderError, plugin.id);
 * ...
 * ...
 * log.N("Message to be written to dashboard status and system log");
 * log.N("Message to be written to system log only", false);
 */

module.exports = class Log {

    /**
     * Construct a new Log instance.
     *
     * statusFunction   - callback function which will write status (non-error) messages to the Signal K dashboard.
     * errorFunction    - callback function which will write error messages to the Signal K dashboard.
     * prefix           - text string which will be used to prefix all messages written to the system logging facility.
     */
    constructor(statusFunction, errorFunction, prefix) {
        this.statusFunction = statusFunction;
        this.errorFunction = errorFunction;
        this.prefix = prefix;
    }

    /**
     * Output a notification message.
     *
     * message          - text message to be output.
     * toConsole        - false = no dashboard output. true or undefined = output using status callback.
     */
    N(message, toConsole) {
        this.log(message, (toConsole === undefined)?true:toConsole);
    }

    /**
     * Output a warning message.
     *
     * message          - text message to be output.
     * toConsole        - false = no dashboard output. true or undefined = output using status callback.
     */
    W(message, toConsole) {
        this.log("warning: " + message, (toConsole === undefined)?true:toConsole);
    }

    /**
     * Output an error message.
     *
     * message          - text message to be output.
     * toConsole        - false = no dashboard output. true or undefined = output using status callback.
     */
    E(message, toConsole) {
        this.log("error: " + message, (toConsole === undefined)?true:toConsole, true);
    }

    log(message, toConsole, toError) {
        if (message !== undefined) {
            // Always write message to syslog
	        console.log("%s%s", (this.prefix === undefined)?"":(this.prefix + ": "), message);
    
            if (toConsole) {
                message = message.charAt(0).toUpperCase() + message.slice(1);
	            if ((toError === undefined) || (!toError)) { this.statusFunction(message); } else { this.errorFunction(message); }
            }
        }
    }
}
