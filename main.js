var fs = require('fs');
var express = require('express');
var http = require('http');
var https = require('https');
var utils = require('./utils.js');

var privateKey = fs.readFileSync('certs/privkey.pem', 'utf8');
var certificate = fs.readFileSync('certs/fullchain.pem', 'utf8');
var credentials = { key: privateKey, cert: certificate };

const HTTP_PORT = 8081, HTTPS_PORT = 8444;

var httpApp = express(), httpsApp = express();
var httpServer = http.createServer(httpApp);
var httpsServer = https.createServer(credentials, httpsApp);

console.log(`Listening for HTTP/HTTPS requests on ports ${HTTP_PORT}/${HTTPS_PORT}`);
httpServer.listen(HTTP_PORT);
httpsServer.listen(HTTPS_PORT);

httpApp.get('*', (req, res) => {
  res.redirect('https://' + req.headers.host + req.url);
});

httpsApp.get('/', function(req, res) {
  res.redirect('/public/index.htm');
});

httpsApp.get('/public/*', function(req, res) {
  var url = req.url.replace(/\?.*$/, '');
  var localPath = utils.makeAbsolute(url);
  if (fs.existsSync(localPath)) {
    res.sendFile(localPath);
  } else {
    res.sendStatus(404);
  }
});