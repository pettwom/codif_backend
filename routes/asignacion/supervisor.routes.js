const express = require("express");
const {
    esSupervisor,
    asignarRolCodificador,
    desactivarRolCodificador,
    obtenerCodificadoresAsignados
} = require('../../controllers/asignacion/supervisor.controller');
const router = express.Router();

// Rutas para jefaturas (SUP)
router.post('/roles/asignar', esSupervisor, asignarRolCodificador);
router.post('/roles/desactivar', esSupervisor, desactivarRolCodificador);
router.get('/codificadores', esSupervisor, obtenerCodificadoresAsignados);

module.exports = router;

