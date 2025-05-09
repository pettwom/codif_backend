const express = require("express");
const {
    esJefatura,
    asignarRolSupervisor,
    desactivarRolSupervisor,
    obtenerSupervisoresAsignados
} = require('../../controllers/asignacion/jefatura.controller');
const router = express.Router();

// Rutas para jefaturas (JTMT)
router.post('/asignar', esJefatura, asignarRolSupervisor);
router.post('/desactivar', esJefatura, desactivarRolSupervisor);
router.get('/supervisores', esJefatura, obtenerSupervisoresAsignados);

module.exports = router;