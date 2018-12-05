var mypromises = {

    // Create a promise that rejects in <ms> milliseconds
    timeoutPromise: function(ms, promise) {
        let timeout = new Promise((resolve, reject) => {
            let id = setTimeout(() => {
                clearTimeout(id);
                reject('Timed out in '+ ms + 'ms.')
            }, ms)
        })
        // Returns a race between our timeout and the passed in promise
        return Promise.race([ promise, timeout ]);
    }

}

module.exports = mypromises;
