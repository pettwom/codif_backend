'use strict';
/* eslint-disable no-undef */

require('dotenv').config();

const db = {
  secret: process.env.ENCRIPT_SECRET,
};

module.exports = db;
