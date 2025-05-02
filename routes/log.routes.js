const express = require('express');
const logController = require('../controllers/system/log.controller'); 

const router = express.Router();

// Rutas para los logs
router.post('/logs', logController.createLog); // Crear un log
router.get('/', logController.getLogs);   // Consultar logs

module.exports = router;