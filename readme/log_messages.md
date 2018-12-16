## Log messages

__signalk-sensor-log__ generates three type of message: _Notifications_ are
just life-cycle advisories about what is happening, _Warnings_ let you know
that something has occurred or been identified which is a little unusual and
_Errors_ tell you that something fatal has happened or been identified and
that the plugin is terminating.

### Notifications

__Scanning server for sensor data streams__  
The plugin is requesting a list of sensor paths from the host Signal K server which it will filter using the regex supplied as a configuration option.

__Scan selected _nn_ streams__  
Application of the regex has selected _nn_ sensor paths from those supplied by the Signal K Node server.

__Creating new database '_dbname_' for _nn_ sensors__  
The plugin is creating a new database called _dbname_ to hold data for _nn_ sensor streams.

__Updating display groups__  
The plugin is updating the list of display groups by scanning the sensor list.

__Chart generation disabled by configuration option__  
The plugin will not generate any charts because the user has disabled chart generation.

__There are no defined display groups__  
Chart generation is enabled but no charts will be generated because there are no defined display groups.

__Connected to _nn_ sensor streams__  
The plugin has connected to _nn_ sensor streams and is about to begin logging data.

__Logging _nn_ sensor streams (_v1_,_v2_,...)__  
The plugin is processing _nn_ data values (_v1_, _v2_, etc.) to database.

### Warnings

__Update of chart manifest failed__  
The plugin was unable to update `public/manifest.json`.
This probably means that the webapp will not work correctly.
This is only likely to happen if the permissions on the `public/` directory
have changed or there is no space left on the host storage device.

__Update of plugin options failed: _msg__  
The plugin asked the host Signal K Node server to update its configuration
file and the server returned an error described by _msg_.

__Updating _dbname_  with (_v1_,_v2_,...)__  

__Database update failed: _err__

__Chart generation failed for '_group_, _chart_ '__  

### Errors

__There are no accessible sensor data streams__  
This means either that the Signal K Node server has not returned a list of
available sensor paths (unlikely), or that the currently configured regex is
not selecting anything.
The plugin will terminate since with no sensor paths there is no data.

__Error creating database '_dbname_'__  
The plugin attempted and failed to create the database _dbname_.
The plugin will terminate since a problem creating or writing to a database
suggests that something is amiss, probably with __rrdcached__ (you can check
the service status with the command `systemctl status rrdcached`).

__There are no defined databases__  
There are no database for the plugin to log to.
This may be because the plugin can't create them and suggests a  problem
with __rrdcached__ or a a permissions issue in the database directory.

__Could not connect to cache daemon__
The plugin could not connect to __rrdcached__.
