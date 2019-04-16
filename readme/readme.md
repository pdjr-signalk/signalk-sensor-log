# signalk-sensor-log

Log and chart sensor data using round-robin databases.

At a regular, user-defined, sampling _interval_ __signalk-sensor-log__
retrieves a set of user selected path _values_ from the host Signal K Node
server and saves each of these values into a collection of round-robin
_databases_.

By default, the plugin consolodates stored data over hour, day, week, month
and year timescales in a way which prevents database expansion at the expense
of some loss of detail at larger timescales.

Data derived from each path can be rendered as part of one or more chart
collections (a chart collection is just a set of charts which depict the same
data values over each of the defined timescales).

The plugin includes a simple web application which can be used to display any
generated charts.

Database update and rendering services are implemented as stand-alone daemons
which have minimal impact upon server operation even when many sensor channels
are being monitored.

The plugin offers a range of user configuration options, but is designed to
work 'out of the box' in a way that may suit many users.

Some examples of the type of data logging that can be undertaken are
illustrated below.

__Example 1__  
Power levels reported from the host vessel's inverter/charger show changes in
electrical power consumption and use.

![Webapp screenshot](readme/acpower.png)

__Example 2__
Readings from tank level sensors are plotted to illustrate changes in tank
content over time.

![Webapp screenshot](readme/tanks.png)

__Example 3__
NMEA switchbank state changes over time.

