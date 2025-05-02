'use strict';
/* eslint-disable no-undef */

const auth = {
  secret: process.env.SECRET || 'BASE',
  algorithms: ['HS256']
};

module.exports = auth;
