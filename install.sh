#!/bin/bash

SERVICENAME=rrdsrv
SERVICEPORT=13900
SERVICEDESC="RRD service"

REQUIREDPACKAGES="xinetd rrdtool"
ETCSERVICES="/etc/services"
ETXXINETDD="/etc/xinetd.d/"
XINETDCONFIG="extras/etc/xinetd.d/rrdsrv"


echo "Attempting to install service ${SERVICENAME} on port ${SERVICEPORT}"
echo "Sevice will be owned by the user ${SERVICENAME}:${SERVICENAME}"
echo

###############################################################################
# Silently update the local package cache.
#
echo "Updating package indexes."
apt-get -qq update

###############################################################################
# Silently install the required packages.
#
for package in ${REQUIREDPACKAGES} ; do
    echo "Installing required package ${package}"
    #apt-get -qq -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" ${package}
done

###############################################################################
# Add rrdsrv to Internet service daemon.
#
if RESULT=$(grep "^${SERVICENAME}" ${ETCSERVICES}) ; then
    if [[ ${RESULT} =~ ([0-9]+) ]] && [ "${BASH_REMATCH}" == "${SERVICEPORT}" ] ; then
        echo -n ""
    else
        echo "I would like to add a definition for service ${SERVICENAME} on"
        echo "port ${SERVICEPORT} to ${ETCSERVICES}, but the service is already"
        echo "defined on port ${BASH_REMATCH}."
        echo "I'm stopping now so that you can resolve this issue."
        exit 1
    fi
else
    if RESULT=$(grep -q "${SERVICEPORT}" /etc/services) ; then 
        echo "Internet port ${SERVICEPORT} is already assigned to another"
        echo "service: ${RESULT}" 
        echo "I'm stopping now so that you can resolve this issue."
        exit 1
    else
        echo "echo \"${SERVICENAME} ${SERVICEPORT}/tcp #${SERVICEDESC}\" >> ${ETCSERVICES}"
        echo "${SERVICENAME}    ${SERVICEPORT}/tcp      #${SERVICEDESC}" >> ${ETCSERVICES}
    fi
fi

###############################################################################
# Create a user and group for the new service.
#
useradd -r ${SERVICENAME}
usermod -s /bin/false ${SERVICENAME}

echo -n "Creating server work directories..."
if mkdir -p /var/rrd/signalk-sensor-log ; then
    echo
    echo "=== aborting: could not create server working directory"
    exit 1
else
    chown -R ${SERVICENAME}:${SERVICENAME} /var/rrd
fi
echo "done"

echo -n "Making symbolic links..."
rm public/charts
ln -s /var/rrd/signalk-sensor-log public/charts
echo "done"

XINETDCONFMOD="${XINETDCONF}.last"
sed -e 's/USER/${RRDSRV}/' ${XINETDCONF} > ${XINETDCONFMOD}

CONFIGFILE="${ETXXINETDD}{$SERVICENAME}"
echo -n "Installing new xinetd sevice configuration ${CONFIGFILE}..."
if [ -f "${CONFIGFILE}" ] ; then
    if RESULT=$(diff ${XINETDCONFMOD} ${CONFIGFILE}) ; then
        echo "=== A service configuration file with the above name and"
        echo "=== ambiguous content already exists:"
        echo ${RESULT}
        echo "=== I'm going to stop now so that you can review this"
        echo "=== conflict and take any necessary corrective actions."
        exit 1
    else
        echo "=== Skipping this step - configuration file already exists.
    fi
else
    cp "${XINETDCONFMOD}" "${CONFIGFILE}"
fi
echo "done"

echo -n "Restarting xinetd..."
kill -USR2 `pidof xinetd`
echo "done"

echo "Finished."
