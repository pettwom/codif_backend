const express = require("express");
const router = express.Router();

const {
    esEspecialista,
    asignarRolesJefatura,
    desactivarRolJefatura,
    obtenerJefaturasAsignadas
} = require("../../controllers/asignacion/especialista.controller");

// Rutas para especialistas (GSP)
router.post('/asignar', esEspecialista, asignarRolesJefatura);
router.post('/desactivar', esEspecialista, desactivarRolJefatura);
router.get('/jefaturas', esEspecialista, obtenerJefaturasAsignadas);

module.exports = router;