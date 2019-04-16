#!/usr/bin/python

from SocketServer import TCPServer, StreamRequestHandler
import socket
from subprocess import call
import datetime
import json
import re
import sys
import os

CONF = {}
RRDTOOL = '/usr/bin/rrdtool'

PERIODS = []
CHART_BACKGROUNDCOLOR = '#000000'
CHART_CANVASCOLOR = '#000000'
CHART_DIRECTORY = '/tmp/'
CHART_FONT = 'LEGEND:8:Courier New'
CHART_FONTCOLOR = '#804040'
CHART_IMAGETYPE = 'SVG'
DISPLAYGROUP_LIST = []
RRDDATABASE_DATABASES = []
RRDDATABASE_DIRECTORY = '/tmp'
SENSOR_LIST= []

def init(config):
    global CONF, PERIODS, CHART_BACKGROUNDCOLOR, CHART_CANVASCOLOR, CHART_DIRECTORY, CHART_FONTCOLOR, DISPLAYGROUP_LIST, RRDDATABASE_DATABASES, RRDDATABASE_DIRECTORY, SENSOR_LIST

    with open(config) as data_file:
        CONF = json.load(data_file)["configuration"]
    PERIODS = CONF['rrddatabase']['periods']
    CHART_BACKGROUNDCOLOR = CONF["chart"]["backgroundcolor"]
    CHART_CANVASCOLOR = CONF["chart"]["canvascolor"]
    CHART_DIRECTORY = CONF['chart']['directory']
    CHART_FONTCOLOR = CONF["chart"]["fontcolor"]
    DISPLAYGROUP_LIST = CONF['displaygroups']
    SENSOR_LIST = CONF['paths']
    RRDDATABASE_DATABASES = CONF['rrddatabase']['databases']
    RRDDATABASE_DIRECTORY = CONF['rrddatabase']['directory']
    return True


def makeGraph(group, chart, directory):
    command = ""
    if group in map(lambda x: x['id'], DISPLAYGROUP_LIST):
        displayGroup = reduce(lambda a, v: (v if (v['id'] == group) else a), DISPLAYGROUP_LIST, None)
        if (chart in map(lambda s: s['name'], PERIODS)):
            dsIds = map(lambda datasource: datasource['datasource'][datasource['datasource'].find(':') + 1:], displayGroup['datasources'])
            dsDatabases = map(lambda datasource: datasource['datasource'][0: datasource['datasource'].find(':')], displayGroup['datasources'])
            dsColors = map(lambda datasource: datasource['color'], displayGroup['datasources'])
            dsNames = map(lambda datasource: datasource['displayname'], displayGroup['datasources'])
            dsLineTypes = map(lambda datasource: 'AREA' if ('area' in datasource['options']) else 'LINE', displayGroup['datasources'])
            dsStack = map(lambda datasource: ('stack' in datasource['options']), displayGroup['datasources'])

            command = RRDTOOL
            command += " graph '" + directory + "/" + group + "." + chart + "." + CHART_IMAGETYPE.lower() + "'"
            command += " -T 80"
            command += " --imgformat " + CHART_IMAGETYPE
            command += " --font '" + CHART_FONT + "'" 
            command += " --title '" + displayGroup["title"] + "'"
            command += " --vertical-label '" + displayGroup["ylabel"] + "'"
            command += " --watermark 'Generated on " + datetime.datetime.now().replace(microsecond=0).isoformat(' ') + "'"
            command += " --start '" + reduce(lambda a, v: (v['tag'] if (v['name'] == chart) else a), PERIODS,"end-1h") + "'"
            command += (" --lower-limit=" + displayGroup["ymin"]) if (displayGroup["ymin"] != "") else ""
            command += (" --upper-limit=" + displayGroup["ymax"]) if (displayGroup["ymax"] != "") else ""
            command += " --slope-mode"
            command += " --rigid"
            command += " --color CANVAS" + CHART_CANVASCOLOR
            command += " --color BACK" + CHART_BACKGROUNDCOLOR
            command += " --color FONT" + CHART_FONTCOLOR
            command += " --full-size-mode"
            command += " --width=800"
            command += " --height=300"
    
            for index, dsid in enumerate(dsIds):
                command += " DEF:" + dsid + "=" + RRDDATABASE_DIRECTORY + "/" + dsDatabases[index] + ":" + dsid + ":" + reduce(lambda a, v: (v['consolidate'] if (v['name'] == chart) else a), PERIODS,"AVERAGE")
                command += (" VDEF:" + dsid + "min=" + dsid + ",MINIMUM") if ("min" in displayGroup["options"]) else ""
                command += (" VDEF:" + dsid + "max=" + dsid + ",MAXIMUM") if ("max" in displayGroup["options"]) else ""
                command += (" VDEF:" + dsid + "avg=" + dsid + ",AVERAGE") if ("avg" in displayGroup["options"]) else ""
                command += (" VDEF:" + dsid + "lst=" + dsid + ",LAST") if ("lst" in displayGroup["options"]) else ""
                command += (" CDEF:" + dsid + "eeg=" + dsid + "," + str(index * 1.1) + ",+") if ("eeg" in displayGroup["options"]) else ""
                #//command += " CDEF:" + dsname + "filled=" + dsname + ",UN," + dsname + "avg," + dsname + ",IF";
                #command += " CDEF:" + dsid + "filled=" + dsid + ",UN,PREV," + dsid + ",IF"
                #command += " CDEF:" + dsid + "fixed=" + dsid + "filled," + str(reduce(lambda a, v: (v['seconds'] if (v['name'] == chart) else a), PERIODS,"1")) + ",/"
                #command += " VDEF:" + dsid + "total=" + dsid + "fixed,TOTAL"

            comments = reduce(lambda a, v: (a | (v in displayGroup["options"])), ["min","max","avg","lst"], False)
            command += (" COMMENT:'" + "Data source".ljust(23) + "'") if (comments) else ""
            command += (" COMMENT:'" + "Min  ".rjust(10) + "'") if ("min" in displayGroup["options"]) else ""
            command += (" COMMENT:'" + "Max  ".rjust(10) + "'") if ("max" in displayGroup["options"]) else ""
            command += (" COMMENT:'" + "Average  ".rjust(10) + "'") if ("avg" in displayGroup["options"]) else ""
            command += (" COMMENT:'" + "Last  ".rjust(10) + "'") if ("lst" in displayGroup["options"]) else ""
            command += (" COMMENT:'\\n'") if (comments) else "" 
            #command += " COMMENT:'" + "Data stream".ljust(19) + "Min  ".rjust(13) + "Max  ".rjust(14) + "Average  ".rjust(14) + "Derived".rjust(13) + "\\n'"; 
            for i, dsid in enumerate(dsIds):
                plot = (dsid + "eeg") if ("eeg" in displayGroup["options"]) else dsid
                command += " " + dsLineTypes[i] + ":" + plot + dsColors[i] + ":'" + dsNames[i].ljust(19)  + "'" + (":STACK" if (dsStack[i]) else "")
                command += (" GPRINT:" + dsid + "min:'%10.2lf'") if ("min" in displayGroup["options"]) else ""
                command += (" GPRINT:" + dsid + "max:'%10.2lf'") if ("max" in displayGroup["options"]) else ""
                command += (" GPRINT:" + dsid + "avg:'%10.2lf'") if ("avg" in displayGroup["options"]) else ""
                command += (" GPRINT:" + dsid + "lst:'%10.2lf'") if ("lst" in displayGroup["options"]) else ""
                #command += (" GPRINT:" + dsid + "total:'%10.2lf\\n'"
                command += (" COMMENT:'\\n'") if (comments) else ""

            call(command, shell=True)
    return command

def dropPrivileges(user, group):
    import pwd, grp

    # Get the uid/gid from the name
    runningUid = pwd.getpwnam(user).pw_uid
    runningGid = grp.getgrnam(group).gr_gid
        
    # Remove group privileges
    os.setgroups([])
        
    # Try setting the new uid/gid
    os.setgid(runningGid)
    os.setuid(runningUid)

    # Reset logging
    # self.resetLogging() 

class Handler(StreamRequestHandler):
    def handle(self):
        line = self.rfile.readline()
        while (line):
            #self.wfile.write(line)
            line = line.decode('ascii').strip()
            if (line == "quit"):
                break
            parts = re.split('\s+', line)
            if (len(parts) == 2):
                makeGraph(parts[0], parts[1], CHART_DIRECTORY)
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
    CONFIG = "/root/.signalk/plugin-config-data/sensor-log.json"
    USER = None
    GROUP = None

    args = sys.argv[1:]
    if (len(args) > 0) and (args[0] == "-"):
        DAEMONISE = True;
        args = args[1:]
    if (len(args) > 1) and (args[0] == "-c"):
        CONFIG = args[1]
        args = args[2:]
    if (len(args) > 1) and (args[0] == "-U"):
        USER = args[1]
        args = args[2:]
    if (len(args) > 1) and (args[0] == "-G"):
        GROUP = args[1]
        args = args[2:]

    if (init(CONFIG)):
        if (DAEMONISE):
            if ((USER != None) and (GROUP != None)):
                dropPrivileges(USER, GROUP)                
            server = Server(('127.0.0.1', 9999), Handler)
            server.serve_forever()
        else:
            if (len(args) > 1):
                print(makeGraph(args[0], args[1], "."))

