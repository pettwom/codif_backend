const express = require("express");
const router = express.Router();

const {esAdministrador} = require('../../middlewares/verificarAdmin.middleware');
const {tienePermiso} = require('../../middlewares/rolesPermitidos.middleware');

const {
    obtenerRolesPorJerarquia,
    asignarRoles,
    obtenerHistorialRoles,
    obtenerUsuariosPorJerarquia,
    desactivarAsignacionRol,
    reasignarRol,
    // obtenerUsuariosAsignadosPorMi,
    obtenerUsuariosDisponibles,
    obtenerTodosUsuariosAsignados,
    obtenerUsuariosConAsignaciones
} = require("../../controllers/asignacion/role.controller");

const {
    verificarRolJerarquico
} = require('../../controllers/asignacion/rolesEspecificos.controller');

// Ruta para obtener roles segun su jerarquia, es decir GSP->JTMT y asi
router.get("/sistema", tienePermiso(["ADMINISTRADOR", "ESPECIALISTA", "JEFE DE TURNO", "SUPERVISOR", "CODIFICADOR"]), obtenerRolesPorJerarquia);

// Ruta para obtener usuarios segun su jerarquia, es decir GSP->JTMT solo puede ver usuarios JTMT y asi
router.get('/usuarios/:nombre_corto', tienePermiso(["ADMINISTRADOR", "ESPECIALISTA", "JEFE DE TURNO", "SUPERVISOR", "CODIFICADOR"]), obtenerUsuariosPorJerarquia);

router.post("/asignar", esAdministrador, asignarRoles);

router.get("/historial/:usuario_id", obtenerHistorialRoles);

router.post("/desactivar", esAdministrador, desactivarAsignacionRol);

router.post('/reasignar', esAdministrador, reasignarRol);

// Ruta para obtener usuarios asignados por el mismo en funcion al rol y al id devueltos por el token
// router.get('/mis-asignaciones', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), obtenerUsuariosAsignadosPorMi);

// Ruta para obtener usuarios sin preguntas asignadas (disponibles para asignar)
router.get('/mis-asignaciones', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), obtenerUsuariosDisponibles);

router.get('/todas-mis-asignaciones', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), obtenerTodosUsuariosAsignados);
router.get('/mis-codificadores-asignados', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), obtenerUsuariosConAsignaciones);

module.exports = router;