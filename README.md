# Userscript Proxy

[![Join the chat at https://gitter.im/eBay/userscript-proxy](https://badges.gitter.im/eBay/userscript-proxy.svg)](https://gitter.im/eBay/userscript-proxy?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Ever tried to run userscripts on your iOS device or your Android phone? For iOS, it's not possible, and for Android it's an exercise in frustration.

Userscript Proxy allows you to run userscripts on mobile devices. Userscripts are snippets of JavaScript and CSS code that are added to a particular web page, to change the way it looks or the way it behaves. [Tampermonkey](https://tampermonkey.net) and [Greasemonkey](http://www.greasespot.net) are browser extensions that allow you to install userscripts into web pages, but they only work properly in desktop browsers &ndash; they don't support iOS at all, and the version for Android is tied to an old browser that doesn't work very well anymore.

Instead of running userscripts directly in the browser, Userscript Proxy is an HTTP proxy server that transparently injects scripts and stylesheets (userscripts) into existing sites. We use this tool to quickly generate research stimuli for user testing: we write JavaScript scripts and CSS stylesheets that alter our existing sites according to new designs. This makes it much easier for our developers when we want to test out a simple change: we can run our changes on top of the existing site.

With Userscript Proxy, you can set up a collection of scripts, run multiple scripts at once, and specify which hosts and URLs to inject each script into. You can think of it as Tampermonkey or Greasemonkey running inside of a proxy server.

## How it works

Userscript Proxy generates a proxy PAC file that specifies which web hosts have URLs that need to be altered, and directs all requests to those hosts to Userscript Proxy's proxy server. The proxy server then adds userscripts to the HTML file that is served from each URL that matches. Scripts and stylesheets are added inline to the proxied page, so they run with the same permissions as a script running directly on the website.

Userscript Proxy uses the [http-mitm-proxy](https://github.com/joeferner/node-http-mitm-proxy/) npm module for the core proxy functionality.

## Installing

Userscript Proxy is a [Node.js](https://nodejs.org) application. The proxy can be used as a command-line application or as a Node module. Install as a command-line application unless you want to include the proxy in software you're writing.

### Installing as stand-alone command-line application

* Download and install [Node.js](https://nodejs.org)
* Open a Terminal window and install Userscript Proxy:

```sh
npm install -g userscript-proxy
```

#### Running with example files

To run Userscript Proxy, you need a configuration file (config.json) and userscripts, which are JavaScript and CSS files. You can get a feel for how it works with the example files on this page. Clone this repository to your computer or [download the ZIP file](https://github.corp.ebay.com/EPIC/userscript-proxy/archive/master.zip) from the GitHub page, open a Terminal window and navigate to the `examples` directory, then run:

```sh
userscript-proxy config.json
```

See "Using the proxy server" below to set it up on your devices.

#### Running on the command line

In general, run Userscript Proxy as follows:

```sh
userscript-proxy <config_file> [options]
```

* `<config_file>` is the path to a JSON file that specifies the configuration of the proxy (see below for config file format)
* `[options]` include:

```sh
--loadScript set   Start the proxy with the given set of userscripts active (defined in the config file)
--staticDir dir    Path to directory of static files to serve at /static
--proxyPort port   Port for HTTP proxy server (default 8888)
--pacPort port     Port to serve PAC and other static files (default 8080)
--limitHosts       Only proxy hosts in the currently-selected userscript set
                   (see "Notes" section for more details)
--addPac file      Path to existing PAC file to add proxy rules to
                   (see "Notes" section for more details)
--proxyIndex file  Path to proxy index HTML file
--auth             Enable proxy authentication (experimental; see "Notes" section)
```

### Installing as an npm module

```sh
npm install --save userscript-proxy
```

Add the following code to your script:

```javascript
var proxy = require('userscript-proxy');
proxy(config, id, options);
```

* `config` is a JavaScript object that specifies the configuration of the proxy (see below for config format)
* `id` is the id of the set of userscripts you want to enable
* `options` is an optional parameter with proxy options:

```javascript
{
  'loadScript': 'userscriptSetId',   // Start the proxy with the given set of userscripts active (defined in config)
  'staticDir': './path/to/static',   // Path to directory of static files to serve at /static
  'proxyPort': 8888,                 // Port for HTTP proxy server (default 8888)
  'pacPort': 8080,                   // Port to serve PAC and other static files (default 8080)
  'limitHosts': false,               // Only proxy hosts in the currently-selected userscript set
                                     // (see "Notes" section for more details)
  'addPac': pacFileString,           // Add proxy rules to the beginning of an existing PAC file (as string)
                                     // (see "Notes" section for more details)
  'proxyIndex': indexFileString,     // Proxy index HTML file (as string)
  'auth': false                      // Enable proxy authentication (experimental; see "Notes" section)
}
```

### Using the proxy server

* Connect the device that you wish to run userscripts on to the same network as your server.
* Load `http://<proxy-server>:8080/` in the browser of the device that will run the userscripts, where `<proxy-server>` is the hostname or IP of the proxy server.
* Install the CA certificate on the device that will run the userscripts. Download the CA Certificate from the page you just loaded. There are detailed instructions on the proxy's web page for multiple platforms.
* Set the Automatic HTTP Proxy URL on the device that will run the userscripts. Copy the link from the page you just loaded to your device's proxy settings. There are detailed instructions on the proxy's web page for multiple platforms.
* If you select a different set of userscripts from `http://<proxy-server>:8080/`, the proxy will globally and immediately update which sites will have userscripts added to them.

## Creating userscripts

Userscript Proxy doesn't have a graphical interface like Tampermonkey to install scripts, but don't get scared off &ndash; you just need to add the scripts to an easy configuration file.

See the `examples` directory for a sample `config.json` file and sample scripts. You can run the samples directly by opening a Terminal window in the `examples` directory and running `userscript-proxy config.json`

Userscripts are defined in a JavaScript object, defined below.

```json
{
  "userscripts": [
    {
      "title": "Title of userscript",
      "id": "userscriptId",
      "match": [
        {"host": "example.com", "url": "/"},
        {"host": "example.com", "url": "/index.html"}
      ],
      "scripts": [
        "./scripts/userscript.js"
      ],
      "styles": [
        "./styles/userscript.css"
      ]
    },
    ...
  ],
  "userscriptSets": [
    {
      "title": "Title of userscript set",
      "id": "userscriptSetId",
      "password": "pass",
      "userscripts": ["userscriptId", ...]
    },
    ...
  ]
}
```

* `userscripts` inject JavaScript or CSS file(s) into specified URL(s).
* `userscriptSets` are collections of individual userscripts that will be enabled at the same time. These sets are what are shown to the user on the proxy web page, and the user can switch between them.
* Individual userscripts have a `title` and `id`, can `match` one or more URLs, can have one or more JavaScript files (`scripts`) injected into that URL, and can have one or more CSS files (`styles`) injected into that URL.
* Sets of userscripts have a `title` and `id`, a `password` that is used when proxy authentication is enabled, and an array of `userscripts` IDs that will all be enabled when this set is selected.
* Every time you add a new userscript to the `userscripts` array, an entry also needs to be added to the `userscriptSets` array to allow the user to enable a userscript or set of userscripts by ID.
* The configuration object is passed directly to the proxy when using it a module, or as a JSON file if the proxy is invoked from the command line.

### Adding proxy information to your userscripts

All instances of the following static keys will be replaced with their corresponding dynamic values in userscripts.

* `@@USERSCRIPT-PROXY-HOSTNAME-FQDN@@` fully qualified domain name of the proxy server
* `@@USERSCRIPT-PROXY-HOSTNAME@@` hostname of the proxy server
* `@@USERSCRIPT-PROXY-PAC-PORT@@` port number that static files and the PAC are served from
* `@@USERSCRIPT-PROXY-PROXY-PORT@@` port number of the HTTP proxy
* `@@USERSCRIPT-PROXY-STATIC-SERVER@@` base URL of the static directory served by the proxy
* `@@USERSCRIPT-PROXY-LIST@@` HTML list of available userscript sets
* `@@USERSCRIPT-PROXY-PAC-URL@@` URL to download PAC from
* `@@USERSCRIPT-PROXY-CA-URL@@` URL to download CA certificate from

## Usage Notes

* Please note that there currently are no access controls on this proxy server. If you route the port that Userscript Proxy is using directly to the Internet, you will be running an [open proxy](https://en.wikipedia.org/wiki/Open_proxy).
* You can load userscript set-specific PAC files that limit the client device to use the proxy only for the hosts in the specified set of userscripts. Use the following URL in the proxy settings of the client device: `http://<proxy-server>:8080/userscript-proxy-<id>.pac`, where `<proxy-server>` is the hostname of the proxy server, and `<id>` is the ID of the set of userscripts you want to enable.
* If you want to limit the proxy to only proxy hosts in the currently-selected userscript set (best used in conjunction with userscript set-specific PAC files, as described in the previous bullet), start the proxy server with the option `--limitHosts`.
* If you want to fall back to another set of proxy PAC rules, start the proxy server with the option `--addPac <path>`, where `<path>` is the path to a PAC file on your computer. Userscript Proxy will add its proxy rules to the beginning of the `FindProxyForURL` function in that PAC file. Use the following URL in the proxy settings of the client device: `http://<proxy-server>:8080/userscript-proxy-<id>-internal.pac`, where `<proxy-server>` is the hostname of the proxy server, and `<id>` is the ID of the set of userscripts you want to enable or `all` if you want to allow all hosts in your config to be proxied.
* Userscripts installed with this proxy have the same permissions as scripts running on the page itself, as they are injected directly into the HTML code. Since they are just local scripts to the page, this means that they do not have any of the additional permissions offered by Tampermonkey or Greasemonkey such as cross-site XMLHttpRequests.
* If you've stopped Userscript Proxy, attempted to use it, and then restarted the proxy, your computer may still think that the proxy is down and not try to use it; you may need to force the computer to start using the proxy again by removing it, applying your changes, then enabling it and applying your changes.

## Implementation Notes

* Safari/macOS doesn't pass the URL path from requests to the proxy PAC file, and the PAC file has no visibility into the path when proxying HTTPS sites on any platform. Therefore, we can't filter which sites to proxy based on anything other than the host.
* iOS doesn't let you clear the username/password cache for proxy authentication without a factory reset of the device, so it's not feasible to use proxy authentication to choose which set of userscripts to enable. If you want to try it out anyway, start the proxy with the option `--auth`.
* If you don't install the CA certificate, you will have no issues with unencrypted web pages, but you will get a security warning that you can bypass for regular HTTPS connections and won't be allowed to connect at all for HTTPS connections with HSTS (e.g. Google).
* The CA certificate is automatically generated after running the proxy for the first time. It is located at `~/.userscript-proxy/certs/ca.pem`. If you want to use the generated CA certificate directly from `~/.userscript-proxy/certs/ca.pem`, you may need to convert it to `der` format or use the `crt` file extension, depending on the client device. The proxy serves a version in `der` format with the `crt` extension.

## Acknowledgements

* [Aaron Kleinsteiber](https://github.com/akleinsteiber) (special thanks to Aaron for the project)
* [Anthony Topper](https://github.com/tonytopper)
* [Sean Gates](https://github.com/seangates)

## License

Copyright (c) 2018 eBay Inc.

Use of this source code is governed by a MIT-style license that can be found in the LICENSE file or at [https://opensource.org/licenses/MIT](https://opensource.org/licenses/MIT).
