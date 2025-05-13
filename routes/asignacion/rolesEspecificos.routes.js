const express = require("express");

const {
    verificarRolJerarquico,
    asignarRol,
    desactivarRol,
    obtenerAsignacionesPorTipo,
    obtenerJerarquiaAsignaciones
} = require('../../controllers/asignacion/rolesEspecificos.controller');
const router = express.Router();

// Rutas unificadas para asignacion de roles
router.post('/roles/asignar', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), asignarRol);
router.post('/roles/desactivar', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), desactivarRol);
router.get('/roles/asignaciones', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), obtenerAsignacionesPorTipo);

// Nueva ruta para obtener la jerarquia completa de asignaciones
router.get('/roles/jerarquia', verificarRolJerarquico(['GSP', 'JTMT', 'SUP', 'COD']), obtenerJerarquiaAsignaciones);

module.exports = router;