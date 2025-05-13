const express = require("express");
const router = express.Router();

const {esAdministrador} = require('../../middlewares/verificarAdmin.middleware');
const {tienePermiso} = require('../../middlewares/rolesPermitidos.middleware');

const {
    // obtenerRolesPorSistema,
    obtenerRolesPorJerarquia,
    asignarRoles,
    obtenerHistorialRoles,
    // obtenerTodosLosUsuariosDeLaVista,
    obtenerUsuariosPorJerarquia,
    desactivarAsignacionRol,
    reasignarRol
} = require("../../controllers/asignacion/role.controller");

// Ruta para obtener roles segun su jerarquia, es decir GSP->JTMT y asi
router.get("/sistema", tienePermiso(["ADMINISTRADOR", "ESPECIALISTA", "JEFE DE TURNO", "SUPERVISOR", "CODIFICADOR"]), obtenerRolesPorJerarquia);

// Ruta para obtener usuarios segun su jerarquia, es decir GSP->JTMT solo puede ver usuarios JTMT y asi
router.get('/usuarios/:nombre_corto', tienePermiso(["ADMINISTRADOR", "ESPECIALISTA", "JEFE DE TURNO", "SUPERVISOR", "CODIFICADOR"]), obtenerUsuariosPorJerarquia);

router.post("/asignar", esAdministrador, asignarRoles);

router.get("/historial/:usuario_id", obtenerHistorialRoles);

router.post("/desactivar", esAdministrador, desactivarAsignacionRol);

router.post('/reasignar', esAdministrador, reasignarRol);

module.exports = router;