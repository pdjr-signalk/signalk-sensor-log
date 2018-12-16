## Installation

1. Download and install __rrdtool__ and __rrdcached__ using your operating
   system's package manager.
   On my system `sudo apt-get install rrdtool rrdcached` does the trick.

2. Download and install __signalk-sensor-log__ using the _Appstore_ link
   in your Signal K Node server console.

   The plugin can also be downloaded from the
   [project homepage](https://github.com/preeve9534/signalk-sensor-log)
   and installed using
   [these instructions](https://github.com/SignalK/signalk-server-node/blob/master/SERVERPLUGINS.md).

3. Change to the __signalk-sensor-log__ install directory.
   The command `cd ~/.signalk/node_modules/signalk-sensor-log` should do this
   if you are logged in as _root_. 

4. Use your favourite editor to review and, if necessary, amend the service
   configuration file `systemd/services.conf`.

   The default file defines eight variables in the following way.
   ```
   RRD_USER=rrd
   RRD_GROUP=rrd
   RRDCACHED_WORKING_DIRECTORY=/var/rrd/signalk-sensor-log
   RRDCACHED_SOCKET=rrdcached.sock
   RRDCACHED_PID=rrdcached.pid
   RRDCHARTD_WORKING_DIRECTORY=/var/rrd/signalk-sensor-log/charts
   RRDCHARTD_PORT=9999
   RRDCHARTD_CONFIG_FILE=/root/.signalk/plugin-config-data/sensor-log.json
   ```
   The file is commented to give guidance on the purpose of each variable and
   what changes, if any, may be considered or required.

5. Execute the command `sudo bash ./systemd/install.sh`.

   This script copies unit files into the `/etc/systemd/system/` directory
   and installs and starts __rrdcached__ and  __rrdchartd__.
   These changes can be reversed by `sudo bash ./systemd/install.sh -u`.


