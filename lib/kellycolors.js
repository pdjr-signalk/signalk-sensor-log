/**
 * Module giving quick access to Kelly colors.
 *
 * const kellycolors = require("./lib/kellycolors.js");
 * ...
 * var color = kellycolors.getNextColor(); 
 */

"use strict";


var kellycolors = {

    /**
     * 20 easily distinguished * colors.
     */
    KELLY_COLORS: [
        '#F3C300',
        '#875692',
        '#F38400',
        '#A1CAF1',
        '#BE0032',
        '#C2B280',
        '#848482',
        '#008856',
        '#E68FAC',
        '#0067A5',
        '#F99379',
        '#604E97',
        '#F6A600',
        '#B3446C',
        '#DCD300',
        '#882D17',
        '#8DB600',
        '#654522',
        '#E25822',
        '#2B3D26'
    ],


    /**
     * Get a new color from the library of colours.  Successive calls will
     * cycle through the set of available colours.
     */
    getNextColor: function() {
        var retval = KELLY_COLORS.shift();
        KELLY_COLORS.push(retval);
        return(retval);
    },

    /**
     * Get an array of <n> colors from the library of colors.
     */
    getColors: function(n) {
        return(KELLY_COLORS.slice(-n));
    }

}

module.exports = kellycolors;
