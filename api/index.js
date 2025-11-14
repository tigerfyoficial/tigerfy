// api/index.js
const serverless = require('serverless-http');
process.env.VERCEL = '1';
const app = require('../server');
module.exports = serverless(app);
