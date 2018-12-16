## Overview and system requirements

__signalk-sensor-log__ uses the
[RRDtool](https://oss.oetiker.ch/rrdtool/)
database management system, using both the __rrdtool__ and  __rrdcached__
applications.
The plugin includes a standalone chart generator implemented in Python which
requires a free TCP socket.
The host machine must implement __systemd__.

Against this background, use of __signalk-sensor-log__ requires:

1. __rrdtool__ (part of most Linux distributions).

2. __rrdcached__ (also part of most Linux distribuions).

3. Sufficient storage to hold the round-robin database and the generated image
   files.
   Each monitored data channel requires around 4MB of database storage and
   there is a small system overhead of about 2MB.
   Each chart group consists of five SVG image files which in total occupy
   about 0.6MB.

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

2. Change to the __signalk-sensor-log__ install directory.
   The command `cd ~/.signalk/node_modules/signalk-sensor-log` should do this
   if you are logged in as _root_. 

3. Use your favourite editor to review and, if necessary, amend the service
   configuration file `systemd/services.conf`.
   The file is commented to give guidance on what changes may be required -
   although in most situations, no changes will be necessary.

4. Execute the command `bash configure.sh` which will simply create the file
   `install.sh`.
   It is this script which will install the two supporting services by:

   1. Creating a new system user and group rrd:rrd by modifying `/etc/passwd`
      and `/etc/group` using the `useradd` command.
   2. Creating a working directory (`/var/rrd/`) for the update service and a
      sub-directory (`var/rrd/signalk-sensor-log/`) for the chart generation
      service, both owned by the rrd:rrd user.
   3. Creating links in `/etc/systemd/system/` which point to the configuration
      files in the plugin's `systemd` folder.
   4. Executing `systemctl daemon-reload` to register the changes made at (3).

5. If you are happy to modify your system in this way, then execute the command
   `bash install.sh`.
      
That's it.
You can now proceed to the next section which describes configuring and using
 __signalk-sensor-log__.
