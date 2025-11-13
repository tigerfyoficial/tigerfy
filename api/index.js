const serverless = require('serverless-http');
process.env.VERCEL = '1';        // garante export do app, não dá listen
const app = require('../server'); // usa seu server.js (sem tocar no front)
module.exports = serverless(app);
