const CONFIG_FILE = "config.json";
const MANIFEST_FILE = "manifest.json";
const CHARTDIR = "charts/";

var config = null;
var manifest = null;
var index = 0;

var tcpclient = new TcpClient('192.168.1.1', 9999);
tcpclient.connect(function() {
    console.log("connected");
});
/**
 * Initialises the page by setting the page heading and attempting to load the
 * page manifest from MANIFEST_FILE. If the load is successful, then the
 * script continues to initialise the display.
 */

function init() {
    if (((config = JSON.parse(loadFile(CONFIG_FILE))) != null) && ((manifest = JSON.parse(loadFile(MANIFEST_FILE))) != null)) {
        var urlParams = new URLSearchParams(window.location.search);
        var group = (urlParams.has('group'))?urlParams.get('group'):manifest[0]['id'];
        var chart = (urlParams.has('chart'))?urlParams.get('chart'):config.images[0]['id'];
        document.getElementsByTagName('h1')[0].innerHTML = config.title;
        generateGroupMenu();
        changeGroup(group, chart);
    } else {
        document.getElementById('missingfile').innerHTML = (config == null)?CONFIG_FILE:MANIFEST_FILE;
        document.getElementById('error').style.display = 'block';
    }
}

function generateGroupMenu() {
    var content = "<ul>";
    manifest.forEach(function(group) {
        content += "<li id=\"" + group['id'] + "-menuitem\" class=\"menuitem\">";
        content += "<a href=\"?group=" + group['id'] + "&chart=" + config.images[0]['id'] + "\">" + group['id'] + "</a>";
        content += "</li>";
    });
    content += "</ul>";
    document.getElementById('menu').innerHTML = content;
}

function changeGroup(group, chart) {
    if ((selected = document.getElementsByClassName('selectedmenuitem')).length > 0) selected[0].classList.remove('selectedmenuitem');
    if ((selected = document.getElementById(group + "-menuitem")) != null) selected.classList.add('selectedmenuitem');
    document.getElementsByTagName('h1')[0].innerHTML = manifest.reduce((a,g) => ((g['id'] == group)?g['title']:a),config.title);
    generateThumbnails(group);
    goto(group, chart);
}

function generateThumbnails(group) {
    if ((container = document.getElementById('thumbnails')) != null) {
        var content = "";
        for (i = 0; i < config.images.length; i++) {
            id = config.images[i].id;
            filename = group + "." + config.images[i].filename;
            comment = config.images[i].comment;
            content += "<div id=\"" + id + "\" class=\"thumbnail\" onClick=\"goto('" + group + "','" + id + "');\" title=\"" + comment + "\">\n";
            content += "<img src=\"" + CHARTDIR + filename + "\" alt=\"" + comment + "\" onerror=\"deleteElement('" + id + "');\"/>\n";
            content += "<p>\n";
            content += id; 
            content += "</p>\n";
            content += "</div>\n";
        };
        container.innerHTML = content;
    }
}



function prev() {
    if ((group = document.getElementsByClassName('selectedmenuitem')).length > 0) {
        if ((group = group[0].id.split('-')[0]) != null) {
            if ((chart = document.getElementsByClassName('selectedthumb')).length > 0) {
                if ((chart = chart[0].id) != null) {
                    index = config.images.map(e => e['id']).indexOf(chart);
                    chart = config.images[(index == 0)?(config.images.length - 1):(index - 1)]['id'];
                    goto(group, chart);
                }
            }
        }
    }
}

function next() {
    if ((group = document.getElementsByClassName('selectedmenuitem')).length > 0) {
        if ((group = group[0].id.split('-')[0]) != null) {
            if ((chart = document.getElementsByClassName('selectedthumb')).length > 0) {
                if ((chart = chart[0].id) != null) {
                    index = config.images.map(e => e['id']).indexOf(chart);
                    chart = config.images[(index + 1) % config.images.length]['id'];
                    goto(group, chart);
                }
            }
        }
    }
}

function goto(group, chart) {
    console.log("goto " + group + " " + chart);
    if ((thumbs = document.getElementsByClassName('selectedthumb')).length > 0) { thumbs[0].classList.remove('selectedthumb'); }
    if ((thumbnail = document.getElementById(chart)) != null) {
        thumbnail.classList.add('selectedthumb');
        loadImage(group, chart);
    }
}

function loadImage(group, chart) {
    console.log("loadImage " + group + " " + chart);
    if ((container = document.getElementById('lightbox')) != null) {
        var content = "";
        content += "<img src=\"" + CHARTDIR + group + "." + config.images.reduce((a,i) => ((i['id'] == chart)?i['filename']:a), "") + "\"/>\n";
        content += "<div class=\"prev\" onClick=\"prev();\">&lt;</div>\n"
        content += "<div class=\"next\" onClick=\"next();\">&gt;</div>\n";
        container.innerHTML = content;
    } 
}

function loadFile(filePath) {
  var result = null;
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET", filePath, false);
  xmlhttp.send();
  if (xmlhttp.status==200) {
    result = xmlhttp.responseText;
  }
  return result;
}

function deleteElement(id) {
    config.images = config.images.filter(i => (i['id'] != id));
    document.getElementById(id).outerHTML = "";
}
