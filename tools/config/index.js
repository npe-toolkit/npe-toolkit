const path = require('path');
const WebpackUtils = require('./WebpackUtils');

function getXplat() {
  const xplatMatch = '/fbsource/xplat/';
  return __dirname.split(xplatMatch)[0] + xplatMatch;
}

module.exports = {
  WebpackUtils,
};
