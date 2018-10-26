'use strict';

var Proxy = require('http-mitm-proxy');
var fs = require('fs');
var node_fqdn = require('node-fqdn');
var os = require('os');
var express = require('express');
var forge = require('node-forge');

module.exports = function(config, options) {
  options = typeof options !== 'undefined' ? options : {};
  var currentId = options['loadScript'] && options['loadScript'] !== true ? options['loadScript'] : false; //userscript set that is initially active
  var proxyPort = options['proxyPort'] && options['proxyPort'] !== true ? options['proxyPort'] : 8888; //port to run proxy from
  var pacPort = options['pacPort'] && options['pacPort'] !== true ? options['pacPort'] : 8080; //port to serve PAC files and other static files from
  var enableProxyAuth = !!options['auth']; //enable basic authentication
  var limitHosts = !!options['limitHosts']; //limit allowed hosts to current userscript set
  var internalProxy = options['addPac'] && options['addPac'] !== true ? options['addPac'] : false; //add proxy rules to the beginning of an existing PAC file
  var proxyIndex = options['proxyIndex'] && options['proxyIndex'] !== true ? options['proxyIndex'] : fs.readFileSync(__dirname + '/../config/index.html', 'utf8'); //proxy settings index HTML file
  var staticDir = options['staticDir'] && options['staticDir'] !== true ? options['staticDir'] : false; //path of directory to serve with static files
  var overrideHost = options['overrideHost'] && options['overrideHost'] !== true ? options['overrideHost'] : false; //override domain name that the proxy automatically discovers
  
  var userscripts = config.userscripts; //all userscripts from config file
  var userscriptSets = config.userscriptSets; //all userscript sets from config file
  var authSelectedBasic = {}; //map of basic authentication values to userscript sets
  var authSelectedById = {}; //map of userscript set IDs to userscript sets
  var userscriptSetIds = []; //all userscript set IDs
  var allHosts = []; //all hosts to proxy from config file
  var auth = ""; //currently active basic auth string

  var hostname = os.hostname();
  var fqdn;
  if (overrideHost) {
    fqdn = overrideHost
  } else {
    //getting the FQDN sometimes errors out, so fall back gracefully to the hostname
    try {
      fqdn = node_fqdn();
    } catch (e) {
      fqdn = hostname;
    }
  }

  //All instances of the following static keys will be replaced with their corresponding dynamic values in userscripts
  var textReplace = [
    {
      "key": /@@USERSCRIPT-PROXY-HOSTNAME-FQDN@@/g,
      "value": fqdn
    },
    {
      "key": /@@USERSCRIPT-PROXY-HOSTNAME@@/g,
      "value": hostname
    },
    {
      "key": /@@USERSCRIPT-PROXY-PAC-PORT@@/g,
      "value": pacPort
    },
    {
      "key": /@@USERSCRIPT-PROXY-PROXY-PORT@@/g,
      "value": proxyPort
    },
    {
      "key": /@@USERSCRIPT-PROXY-STATIC-SERVER@@/g,
      "value": "http://"+fqdn+":"+pacPort+"/static"
    },
    {
      "key": /@@USERSCRIPT-PROXY-PAC-URL@@/g,
      "value": "http://"+fqdn+":"+pacPort+"/userscript-proxy-all.pac"
    },
    {
      "key": /@@USERSCRIPT-PROXY-CA-URL@@/g,
      "value": "http://"+fqdn+":"+pacPort+"/"+hostname+"-ca.crt"
    },
    {
      "key": /@@USERSCRIPT-PROXY-LIST@@/g, //HTML list of userscript sets
      "value": function() {
        var list = "";
        list += '<li>' + (!currentId ? '<b>' : '') + '<a href="/?">None</a>' + (!currentId ? '</b>' : '') + '</li>\n';
        for (var a in userscriptSets) {
          list += '<li>' + (userscriptSets[a]['id'] == currentId ? '<b>' : '') + '<a href="/?'+userscriptSets[a]['id']+'">' + userscriptSets[a]['title'] + '</a>' + (userscriptSets[a]['id'] == currentId ? '</b>' : '') + '</li>\n';
        }
        return list;
      }
    }
  ];

  //Replace all static keys with dynamic values in the given text string
  function replaceAllText(file, replaceStrings) {
    for (var i in replaceStrings) {
      file = file.replace(replaceStrings[i].key, replaceStrings[i].value);
    }
    return file;
  }

  //Generate script and stylesheet tags to add to matched pages ('scriptsHtml' and 'stylesHtml' in the 'userscripts' variable)
  function generateScriptAndStyleHTML() {
    for (var s in userscripts) {
      userscripts[s]['scriptsHtml'] = '';
      userscripts[s]['stylesHtml'] = '';
      for (var script in userscripts[s]['scripts']) {
        if (userscripts[s]['scripts'][script].indexOf('./') == 0) {
          var currentFile = replaceAllText(fs.readFileSync(userscripts[s]['scripts'][script].replace('./', process.cwd() + '/'), 'utf8'), textReplace);
          userscripts[s]['scriptsHtml'] += '<script>\n'+currentFile+'</script>\n';
        } else {
          userscripts[s]['scriptsHtml'] += '<script src="'+userscripts[s]['scripts'][script]+'"></script>\n';
        }
      }
      for (var style in userscripts[s]['styles']) {
        if (userscripts[s]['styles'][style].indexOf('./') == 0) {
          var currentFile = replaceAllText(fs.readFileSync(userscripts[s]['styles'][style].replace('./', process.cwd() + '/'), 'utf8'), textReplace);
          userscripts[s]['stylesHtml'] += '<style>\n'+currentFile+'</style>\n';
        } else {
          userscripts[s]['stylesHtml'] += '<link rel="stylesheet" href="'+userscripts[s]['styles'][style]+'">\n';
        }
      }
    }
  }
  generateScriptAndStyleHTML();
  fs.watch(process.cwd() + '/', {recursive: true}, function(eventType, filename) {
    console.log('Reloading scripts and styles.'+(filename ? ' ' + filename + ' changed.':''));
    generateScriptAndStyleHTML();
  });

  //Generate key/value pairs for authentication values to userscript sets
  for (var a in userscriptSets) {
    authSelectedBasic[userscriptSets[a].id+':'+userscriptSets[a].password] = userscriptSets[a].userscripts; //map basic authentication values to userscript set
    authSelectedById[userscriptSets[a].id] = userscriptSets[a].userscripts; //map userscript set ID to userscript set
    userscriptSetIds.push(userscriptSets[a].id); //all userscript set IDs
  }

  //Get all hosts in the config file for a given userscript ID
  function getHosts(id) {
    var hosts = [];
    var selected = [];
    for (var a in userscriptSets) {
      if (userscriptSets[a].id == id) {
        selected = userscriptSets[a].userscripts;
      }
    }
    for (var s in userscripts) {
      if (selected.indexOf(userscripts[s]['id']) != -1 || id == 'all') {
        for (var m in userscripts[s]['match']) {
          if (hosts.indexOf(userscripts[s]['match'][m]['host']) == -1) {
            hosts.push(userscripts[s]['match'][m]['host']);
          }
        }
      }
    }
    return Array.from(new Set(hosts)); //return unique values
  }

  //Get all hosts in the config file for all userscripts
  allHosts = getHosts('all');

  //Set up http-mitm-proxy
  var proxy = Proxy();
  proxy.use(Proxy.gunzip);

  proxy.onError(function(ctx, err, errorKind) {
    var url = (ctx && ctx.clientToProxyRequest) ? ctx.clientToProxyRequest.url : '';
    console.error(errorKind + ' on ' + url + ':', err);
  });

  //Authenticate on connect for HTTPS connections (only if auth is enabled)
  proxy.onConnect(function(req, socket, head, callback) {
    if (enableProxyAuth) {
      if (req.headers['proxy-authorization'] || req.headers['Proxy-Authorization']) {
        var encodedAuth = req.headers['proxy-authorization'] || req.headers['Proxy-Authorization'];
        encodedAuth = encodedAuth.substr(6);
        var currentAuth = new Buffer(encodedAuth, 'base64').toString("ascii");
        console.log("current auth connect",currentAuth);
        if (authSelectedBasic[currentAuth]) {
          auth = currentAuth;
          console.log("header set connect",req.headers.host);
          return callback();
        } else {
          console.log("connect unauthorized");
        }
      }
      auth = "";
      console.log("header not set connect",req.headers.host);
      socket.write('HTTP/1.1 407 Proxy Authentication Required\r\n');
      socket.write('Proxy-Authenticate: Basic realm="userscriptproxy"\r\n');
      socket.write('\r\n');
      socket.end();
    } else {
      return callback();
    }
  });

  //Authenticate when sending response headers for HTTP connections (only if auth is enabled)
  // see https://github.com/joeferner/node-http-mitm-proxy/issues/74#issuecomment-195967863
  proxy.onResponseHeaders(function(ctx, callback) {
    if (enableProxyAuth) {
      if (!ctx.isSSL) {
        var correctAuth = false;
        if (ctx.clientToProxyRequest.headers['proxy-authorization'] || ctx.clientToProxyRequest.headers['Proxy-Authorization']) {
          var encodedAuth = ctx.clientToProxyRequest.headers['proxy-authorization'] || ctx.clientToProxyRequest.headers['Proxy-Authorization'];
          encodedAuth = encodedAuth.substr(6);
          var currentAuth = new Buffer(encodedAuth, 'base64').toString("ascii");
          if (authSelectedBasic[currentAuth]) {
            console.log("header set response",ctx.clientToProxyRequest.headers.host,ctx.clientToProxyRequest.url);
            return callback();
          }
        }
        console.log("header not set response",ctx.clientToProxyRequest.headers.host,ctx.clientToProxyRequest.url);
        ctx.proxyToClientResponse.setHeader('Proxy-Authenticate', 'Basic realm="userscriptproxy"');
        ctx.proxyToClientResponse.writeHead(407, 'Proxy Authentication Required');
        ctx.proxyToClientResponse.end("Access denied");
      } else {
        return callback();
      }
    } else {
      return callback();
    }
  });

  //Alter responses to requests to the proxy based on what userscripts are selected
  proxy.onRequest(function(ctx, callback) {
    var fullUrl = ctx.clientToProxyRequest.headers.host + ctx.clientToProxyRequest.url;
    var allowed = false; //is this host allowed by the proxy?
    var selected; //selected userscript set
    
    //Proxy all hosts in config file
    if (!limitHosts) {
      for (var h in allHosts) {
        if (ctx.clientToProxyRequest.headers.host.match(allHosts[h])) {
          allowed = true;
        }
      }
    }

    //Set selected userscript set
    // Use basic authentication details from config file if proxy auth is enabled
    // Use userscript set ID if proxy auth is not enabled
    if (enableProxyAuth) {
      var currentAuth = "";
      if (ctx.isSSL) {
        currentAuth = auth;
        auth = "";
      } else {
        var encodedAuth = ctx.clientToProxyRequest.headers['proxy-authorization'] || ctx.clientToProxyRequest.headers['Proxy-Authorization'];
        if (encodedAuth) {
          encodedAuth = encodedAuth.substr(6);
          currentAuth = new Buffer(encodedAuth, 'base64').toString("ascii");
        }
      }
      
      if (currentAuth && authSelectedBasic[currentAuth]) {
        console.log("current auth request",currentAuth);
      } else {
        return callback();
      }
      selected = authSelectedBasic[currentAuth];
    } else {
      if (currentId) {
        selected = authSelectedById[currentId];
      } else {
        selected = false;
      }
    }
    
    //If the host and URL match a selected userscript, alter the page that is served: add the styles and scripts from that userscript
    for (var s in userscripts) {
      var thisScript = false; //do host and URL match a selected userscript?
      if (selected && selected.indexOf(userscripts[s]['id']) != -1) {
        for (var h in userscripts[s]['match']) {
          if (ctx.clientToProxyRequest.headers.host.match(userscripts[s]['match'][h]['host'])) {
            //Only proxy hosts in selected userscript set
            if (limitHosts) {
              allowed = true;
            }
            if (ctx.clientToProxyRequest.headers.host.match(userscripts[s]['match'][h]['host'] + (userscripts[s]['match'][h]['port'] ? ':'+userscripts[s]['match'][h]['port'] : '')) && ctx.clientToProxyRequest.url.match(userscripts[s]['match'][h]['url'])) {
              thisScript = true;
              break;
            }
          }
        }
        //Host and URL match a selected userscript, so alter the page
        if (thisScript) {
          console.log("Altering with " + userscripts[s]['id'] + ": " + fullUrl);
          var styles = userscripts[s]['stylesHtml'];
          var scripts = userscripts[s]['scriptsHtml'];
          ctx.onResponseData(function(ctx, chunk, callback) {
            //only alter pages that are served with a text/* MIME type
            if (ctx.serverToProxyResponse.headers['content-type'].indexOf('text/') != -1) {
              var chunkString = chunk.toString();
              chunkString = chunkString.replace('</head>', styles+'</head>');
              chunkString = chunkString.replace('</body>', scripts+'</body>');
              chunk = new Buffer(chunkString);
            }
            return callback(null, chunk);
          });
        }
      }
    }
    
    //Drop the connection if the host is not specified in any userscripts
    if (allowed) {
      console.log("Proxying: " + fullUrl);
      return callback();
    } else {
      console.log("Disallowed: " + fullUrl);
      ctx.proxyToClientResponse.end('Proxy not allowed for this host');
    }
  });

  //Start proxy server
  proxy.listen({port: proxyPort, sslCaDir: os.homedir()+'/.userscript-proxy/'});
  console.log('Proxy listening on port ' + proxyPort);

  //Set up web server for PAC and static files
  var app = express();

  //Generate and serve a proxy PAC file for the given userscript set ID
  function getProxyPac(id) {
    var matchPac = '  var matchHosts = '+JSON.stringify(getHosts(id))+';';
    matchPac += `
      for (var h in matchHosts) {
        if (dnsDomainIs(host,matchHosts[h])) {
          return 'PROXY `+fqdn+`:`+proxyPort+`';
        }
      }`;

    var externalProxy = `
    function FindProxyForURL(url, host) {
    ` + matchPac + `
      return 'DIRECT';
    }`

    if (internalProxy) {
      //Add rules for this proxy to the beginning of the existing proxy PAC file
      //This may not work with all edge cases (e.g. if the FindProxyForURL function is inside a comment)
      var currentInternalProxy = internalProxy.replace(/function\s+FindProxyForURL\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*\{/, "function FindProxyForURL($1, $2) {\n"+matchPac+"\n");
    }

    app.get('/userscript-proxy-'+id+'.pac', function(req, res) {
      res.type('application/x-ns-proxy-autoconfig');
      res.send(externalProxy);
    });

    if (internalProxy) {
      app.get('/userscript-proxy-'+id+'-internal.pac', function(req, res) {
        res.type('application/x-ns-proxy-autoconfig');
        res.send(currentInternalProxy);
      });
    }
  }

  //Serve proxy PAC files for each userscript set IDs and all IDs
  for (var i in userscriptSetIds) {
    getProxyPac(userscriptSetIds[i]);
  }
  getProxyPac('all');

  //Serve the base web page for proxy configuration
  app.get('/', function(req, res) {
    console.log(req.url);
    //Set the current userscript set ID based on search string
    if (req.url.indexOf('/?') == 0) {
      var search = req.url.substr(2);
      if (!search) {
        currentId = false;
      } else if (authSelectedById[search]) {
        currentId = search;
      }
    }
    var result = replaceAllText(proxyIndex, textReplace); //replace static keys with dynamic values from the proxy index HTML file
    res.send(result);
  });

  //Serve the CA certificate for this proxy server
  app.get('/'+hostname+'-ca.crt', function(req, res) {
    //Convert the PEM certificate to DER format
    var pemcert = fs.readFileSync(os.homedir()+'/.userscript-proxy/certs/ca.pem');
    var cert = forge.pki.certificateFromPem(pemcert);
    var asn1cert = forge.pki.certificateToAsn1(cert);
    var dercert = forge.asn1.toDer(asn1cert);

    res.type('application/x-x509-ca-cert');
    res.end(dercert.getBytes(), 'binary');
  });

  //Serve static files within the 'static' directory
  if (staticDir) {
    app.use('/static', express.static(staticDir));
  }

  //Start web server for PAC and static files
  app.listen(pacPort, function() {
    console.log('Web server listening on port ' + pacPort);
    console.log('Load http://'+fqdn+':'+pacPort+'/ in your web browser to view and change proxy settings');
  });
};
