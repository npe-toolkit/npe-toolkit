const MetroUtils = require('@npe-toolkit-tools/config/MetroUtils');
const {getDefaultConfig} = require('expo/metro-config');

module.exports = MetroUtils.metroWithLocalDeps(
  __dirname,
  getDefaultConfig(__dirname),
);
