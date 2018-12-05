#!/usr/bin/python

from SocketServer import TCPServer, StreamRequestHandler
import socket
from subprocess import call
import datetime
import json
import re
import sys
import os

PERIODS = {
     "hour": { "tag": "end-1h", "seconds": 3600, "consolidate": "MAX" },
     "day": { "tag": "end-1d", "seconds": 86400, "consolidate": "MAX" },
     "week": { "tag": "end-1w", "seconds": 604800, "consolidate": "AVERAGE" },
     "month": { "tag": "end-1m", "seconds": 2592000, "consolidate": "AVERAGE" },
     "year": { "tag": "end-1y", "seconds": 31104000, "consolidate": "AVERAGE" }
}

CONF = {}
CHART_DIRECTORY = '/tmp/'
DEFAULT_FONT = 'LEGEND:8:Courier New'
DEFAULT_IMAGEFORMAT = 'SVG'
DATABASE = '/var/rrdsrv/signalk-sensor-log.rrd'
RRDTOOL = '/usr/bin/rrdtool'

optBackgroundColor = '#000000'
optCanvasColor = '#000000'
optFont = DEFAULT_FONT
optFontColor = '#804040'
optImageFormat = DEFAULT_IMAGEFORMAT

def init(database, config):
    global CONF, optBackgroundColor, optCanvasColor, optFont, optFontColor, optImageFormat, CHART_DIRECTORY

    with open(config) as data_file:
        CONF = json.load(data_file)["configuration"]
    optBackgroundColor = CONF["chart"]["backgroundcolor"]
    optCanvasColor = CONF["chart"]["canvascolor"]
    optFont = DEFAULT_FONT;
    optFontColor = CONF["chart"]["fontcolor"]
    optImageFormat = DEFAULT_IMAGEFORMAT
    CHART_DIRECTORY = CONF['chart']['directory']
    return True


def makeGraph(group, chart):
    command = ""
    if group in map(lambda x: x['id'], CONF['displaygroup']['list']):
        displayGroup = reduce(lambda a, v: (v if (v['id'] == group) else a), CONF['displaygroup']['list'], None)
        if (chart in PERIODS):
            dsPaths = filter(lambda x: x in CONF["sensor"]["dbpaths"], map(lambda x: x['path'], filter(lambda x: (group in x["displaygroups"]), CONF["sensor"]["list"])))
            dsIds = map(lambda x: makeIdFromPath(x), filter(lambda x: x in CONF["sensor"]["dbpaths"], map(lambda x: x['path'], filter(lambda x: (group in x["displaygroups"]), CONF["sensor"]["list"]))))
            dsColors = map(lambda x: x['displaycolor'], filter(lambda x: (group in x["displaygroups"]), CONF["sensor"]["list"]))
            dsNames = map(lambda x: x['name'], filter(lambda x: (group in x["displaygroups"]), CONF["sensor"]["list"]))
            dsLineTypes = map(lambda x: 'AREA' if (('stackable' in x['options']) and ('stack' in displayGroup['options'])) else 'LINE', filter(lambda x: (group in x["displaygroups"]), CONF["sensor"]["list"]))

            command = RRDTOOL + " graph '" + CHART_DIRECTORY + "/" + group + "." + chart + "." + optImageFormat.lower() + "'"
            command += " -T 80"
            command += " --imgformat " + optImageFormat
            command += " --font '" + optFont + "'" 
            command += " --title '" + displayGroup["title"] + "'"
            command += " --vertical-label '" + displayGroup["ylabel"] + "'"
            command += " --watermark 'Generated on " + datetime.datetime.now().replace(microsecond=0).isoformat(' ') + "'"
            command += " --start '" + PERIODS[chart]["tag"] + "'"
            command += " --lower-limit=0"
            command += (" --upper-limit=" + str(displayGroup["ymax"])) if (displayGroup["ymax"] != 0) else ""
            command += " --slope-mode"
            command += " --rigid"
            command += " --color CANVAS" + CONF["chart"]["canvascolor"]
            command += " --color BACK" + CONF["chart"]["backgroundcolor"]
            command += " --color FONT" + CONF["chart"]["fontcolor"]
            command += " --full-size-mode"
            command += " --width=800"
            command += " --height=300"
    
            for index, dsid in enumerate(dsIds):
                command += " DEF:" + dsid + "=" + DATABASE + ":" + dsid + ":" + PERIODS[chart]["consolidate"]
                command += " VDEF:" + dsid + "min=" + dsid + ",MINIMUM";
                command += " VDEF:" + dsid + "max=" + dsid + ",MAXIMUM";
                command += " VDEF:" + dsid + "avg=" + dsid + ",AVERAGE";
                #//command += " CDEF:" + dsname + "filled=" + dsname + ",UN," + dsname + "avg," + dsname + ",IF";
                command += " CDEF:" + dsid + "filled=" + dsid + ",UN,PREV," + dsid + ",IF"
                command += " CDEF:" + dsid + "fixed=" + dsid + "filled," + str(PERIODS[chart]["seconds"]) + ",/"
                command += " VDEF:" + dsid + "total=" + dsid + "fixed,TOTAL"
            command += " COMMENT:'" + "Data stream".ljust(19) + "Min  ".rjust(13) + "Max  ".rjust(14) + "Average  ".rjust(14) + "Derived".rjust(13) + "\\n'"; 
            for i, dsid in enumerate(dsIds):
                command += " " + dsLineTypes[i] + ":" + dsid + dsColors[i] + ":'" + dsNames[i].ljust(15)  + "'" + (":STACK" if (dsLineTypes[i] == "AREA") else "")
                command += " GPRINT:" + dsid + "min:'%10.2lf  '"
                command += " GPRINT:" + dsid + "max:'%10.2lf  '"
                command += " GPRINT:" + dsid + "avg:'%10.2lf  '"
                command += " GPRINT:" + dsid + "total:'%10.2lf\\n'"

            call(command, shell=True)
    return command

def makeIdFromPath(path):
    parts = re.split('\.', path)
    return ''.join(parts[1:-1]).lower()

class Handler(StreamRequestHandler):
    def handle(self):
        line = self.rfile.readline()
        while (line):
            line = line.decode('ascii').strip()
            if (line == "quit"):
                break
            parts = re.split('\s+', line)
            if (len(parts) == 2):
                result = makeGraph(parts[0], parts[1])
            line = self.rfile.readline()

class Server(TCPServer):
    # The constant would be better initialized by a systemd module
    SYSTEMD_FIRST_SOCKET_FD = 3

    def __init__(self, server_address, handler_cls):
        # Invoke base but omit bind/listen steps (performed by systemd activation!)
        TCPServer.__init__(self, server_address, handler_cls, bind_and_activate=False)
        # Override socket
        self.socket = socket.fromfd(self.SYSTEMD_FIRST_SOCKET_FD, self.address_family, self.socket_type)


if __name__ == '__main__':
    DAEMONISE = False
    DATABASE = "/var/rrd/signalk-sensor-log.rrd"
    CONFIG = "/root/.signalk/plugin-config-data/sensor-log.json"

    args = sys.argv[1:]
    if (len(args) > 0) and (args[0] == "-"):
        DAEMONISE = True;
        args = args[1:]
    if (len(args) > 1) and (args[0] == "-d"):
        DATABASE = args[1]
        args = args[2:]
    if (len(args) > 1) and (args[0] == "-c"):
        CONFIG = args[1]
        args = args[2:]

    if init(DATABASE, CONFIG):
        if (DAEMONISE):
            server = Server(('127.0.0.1', 9999), Handler)
            server.serve_forever()
        else:
            if (len(args) > 1):
                makeGraph(args[0], args[1])

