// api/index.js
const serverless = require('serverless-http');
process.env.VERCEL = '1';
const app = require('../server'); // seu Express
module.exports = serverless(app);
