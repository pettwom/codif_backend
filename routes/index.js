/* eslint-disable no-unused-vars */
'use strict';

const express = require('express');
const auth = require('express-jwt');
const config = require('../config/auth');
const api = express.Router();

module.exports = function setupApi() {

  api.use('/login', require('../routes/login.routes'));
  api.use('/dashboard', require('../routes/dashboard.routes'));
  api.use('/diccionario', require('../routes/diccionario.routes'));
  api.use('/frecuencia', require('../routes/frecuencia.routes'));
  api.use('/codificacion', require('../routes/codificacion.routes'));
  api.use('/administracion', require('../routes/administracion.routes'));
  api.use('/', require('../routes/log.routes'));

  api.use('/roles', require('../routes/asignacion/role.routes'));
  // api.use('/especialista', require('../routes/asignacion/especialista.routes'));
  // api.use('/jefatura', require('../routes/asignacion/jefatura.routes'));
  // api.use('/supervisor', require('../routes/asignacion/supervisor.routes'));

  api.use('/jerarquia', require('../routes/asignacion/rolesEspecificos.routes'));
  api.use('/codificacion-asistida', require('../routes/distribucion/codificacionAsistida.routes'));

  return api;
};
