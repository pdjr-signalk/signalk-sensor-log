#!/bin/bash

SYSTEMCTL="/bin/systemctl"
CP="/bin/cp"
LN="/bin/ln -s"
RM="/bin/rm -f"
GREP="/bin/grep"

MODE=INSTALL
if [ "${1}" == "-u" ] ; then MODE=UNINSTALL ; fi

MY_UNIT_DIRECTORY="./systemd/"
SYSTEMD_UNIT_DIRECTORY="/etc/systemd/system/"
SYSTEMD_CONFIG_FILE="${MY_UNIT_DIRECTORY}service.conf"
LINKED_THINGS="rrdchartd.socket.d rrdchartd-watcher.path.d"
COPIED_THINGS="rrdcached.service rrdchartd.socket rrdchartd.service rrdchartd-watcher.path rrdchartd-watcher.service"
UNITS="rrdcached.service rrdchartd.socket rrdchartd-watcher.path"
PORT_SNIPPET="${MY_UNIT_DIRECTORY}rrdchartd.socket.d/socket.conf"
PATH_SNIPPET="${MY_UNIT_DIRECTORY}rrdchartd-watcher.path.d/path.conf"

if [ ! -d "${MY_UNIT_DIRECTORY}" ] ; then
    echo "This command must be run from the plugin install directory."
    exit 1
fi

if ! LINE=$(${GREP} "RRDCHARTD_PORT=" ${SYSTEMD_CONFIG_FILE}) ; then
    echo "Bad or missing configuration file '${SYSTEMD_CONFIG_FILE}'"
    exit 2
fi
PORT=${LINE#*=}

if ! LINE=$(${GREP} "RRDCHARTD_CONFIG_FILE=" ${SYSTEMD_CONFIG_FILE}) ; then
    echo "Bad or missing configuration file '${SYSTEMD_CONFIG_FILE}'"
    exit 3
fi
CONFIG=${LINE#*=}

MY_UNIT_DIRECTORY=${MY_UNIT_DIRECTORY//\./`pwd`}

if [ "${MODE}" == "INSTALL" ] ; then 
    echo "creating snippet for port number ${PORT}"
    echo "[Socket]" > ${PORT_SNIPPET}
    echo "ListenStream=${PORT}" >> ${PORT_SNIPPET}

    echo "creating snippet for watch path ${CONFIG}"
    echo "[Path]" > ${PATH_SNIPPET}
    echo "PathChanged=${CONFIG}" >> ${PATH_SNIPPET}

    echo "copying files to ${SYSTEMD_UNIT_DIRECTORY}"
    pushd "${SYSTEMD_UNIT_DIRECTORY}" > /dev/null
    for thing in ${LINKED_THINGS} ; do ${LN} "${MY_UNIT_DIRECTORY}${thing}" "." ; done
    for thing in ${COPIED_THINGS} ; do ${CP} "${MY_UNIT_DIRECTORY}${thing}" "." ; done
    popd > /dev/null
    echo "enabling and starting ${UNITS}"
    ${SYSTEMCTL} daemon-reload
    for unit in ${UNITS} ; do
        ${SYSTEMCTL} enable ${unit}
        ${SYSTEMCTL} start ${unit}
    done
else
    echo "stopping and disabling ${UNITS}" 
    for unit in ${UNITS} ; do
        ${SYSTEMCTL} stop ${unit}
        ${SYSTEMCTL} disable ${unit}
    done
    ${SYSTEMCTL} daemon-reload
    echo "removing files from ${SYSTEMD_UNIT_DIRECTORY}"
    for thing in ${COPIED_THINGS} ${LINKED_THINGS} ; do ${RM} "${SYSTEMD_UNIT_DIRECTORY}${thing}" ; done
fi

exit 0
