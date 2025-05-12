const express = require("express");
const {
    verificarRol,
    asignarRol,
    desactivarRol,
    obtenerAsignacionesPorTipo
} = require('../../controllers/asignacion/rolesEspecificos.controller');
const router = express.Router();

// Para GSP (Especialista)
router.post('/especialista/roles/asignar', verificarRol('GSP'), asignarRol);
router.post('/especialista/roles/desactivar', verificarRol('GSP'), desactivarRol);
router.get('/especialista/listado/jefaturas', verificarRol('GSP'), obtenerAsignacionesPorTipo);

// Para JTMT (Jefatura de Turno)
router.post('/jefatura/roles/asignar', verificarRol('JTMT'), asignarRol);
router.post('/jefatura/roles/desactivar', verificarRol('JTMT'), desactivarRol);
router.get('/jefatura/listado/supervisores', verificarRol('JTMT'), obtenerAsignacionesPorTipo);

// Para SUP (Supervisor)
router.post('/supervisor/roles/asignar', verificarRol('SUP'), asignarRol);
router.post('/supervisor/roles/desactivar', verificarRol('SUP'), desactivarRol);
router.get('/supervisor/listado/codificadores', verificarRol('SUP'), obtenerAsignacionesPorTipo);

module.exports = router;