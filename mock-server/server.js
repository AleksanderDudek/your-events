const jsonServer = require('json-server');
const https = require('https');
const fs = require('fs');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Expose-Headers', 'X-Total-Count');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

server.use(jsonServer.rewriter({ '/api/*': '/$1' }));
server.use(middlewares);
server.use(router);

const options = {
  key: fs.readFileSync(path.join(__dirname, '../certificates/localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../certificates/localhost.pem')),
};

https.createServer(options, server).listen(3001, () => {
  console.log('Mock server running at https://localhost:3001');
});
