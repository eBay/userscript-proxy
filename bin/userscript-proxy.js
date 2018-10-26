#! /usr/bin/env node
'use strict';

var proxy = require('../lib/userscript-proxy');
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));

//Output usage info if incorrect number of command-line arguments
if (argv['_'].length != 1) {
  console.log(`Userscript Proxy: HTTP proxy to inject scripts & stylesheets into existing sites
  Usage: node userscript-proxy.js config_file [options]
  Options:
    --loadScript set  Start the proxy with the given set of userscripts active
    --staticDir dir   Path to directory of static files to serve at /static
    --proxyPort port  Port for HTTP proxy server (default 8888)
    --pacPort port    Port to serve PAC and other static files (default 8080)
    --limitHosts      Only proxy hosts in the currently-selected userscript set
                      (use in conjunction with set-specific PAC files)
    --addPac file     Path to existing PAC file to add proxy rules to
    --proxyIndex file Path to proxy index HTML file
    --auth            Enable proxy authentication (experimental)
    --overrideHost    Override domain name that was automatically discovered`);
  return;
}

//Read config file from file specified in command-line arguments
var config = JSON.parse(fs.readFileSync(argv['_'][0], 'utf8'));
//Read proxy index HTML file if argument is provided
if (argv['proxyIndex'] && argv['proxyIndex'] !== true) {
  argv['proxyIndex'] = fs.readFileSync(argv['proxyIndex'], 'utf8');
}
//Read PAC file to add proxy rules to, if argument is provided
if (argv['addPac'] && argv['addPac'] !== true) {
  argv['addPac'] = fs.readFileSync(argv['addPac'], 'utf8');
}

//Start the proxy
proxy(config, argv);
