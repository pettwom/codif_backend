'use strict';

const db = require('./db');
const auth = require('./auth');
const adSetting = require('./activeDirectory');
const encriptacion = require('./encriptacion');

module.exports = {
  db,
  adSetting,
  auth,
  encriptacion
};
