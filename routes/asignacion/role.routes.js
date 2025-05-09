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

//router.get("/", obtenerTodosLosRoles);obtenerRolesPorSistema
//router.get("/sistema/:sistema", tienePermiso(["ADMINISTRADOR", "ESPECIALISTA", "JEFE DE TURNO", "SUPERVISOR", "CODIFICADOR"]), obtenerRolesPorJerarquia);
router.get("/sistema", tienePermiso(["ADMINISTRADOR", "ESPECIALISTA", "JEFE DE TURNO", "SUPERVISOR", "CODIFICADOR"]), obtenerRolesPorJerarquia);

/*
router.get(
    "/usuarios/:nombre_corto",
    tienePermiso([
        "ADMINISTRADOR",
        "ESPECIALISTA",
        "JEFE DE TURNO",
        "SUPERVISOR",
        "CODIFICADOR"
    ]),
    obtenerTodosLosUsuariosDeLaVista
);
*/

router.get('/usuarios/:nombre_corto', tienePermiso(["ADMINISTRADOR", "ESPECIALISTA", "JEFE DE TURNO", "SUPERVISOR", "CODIFICADOR"]), obtenerUsuariosPorJerarquia);

router.post("/asignar", esAdministrador, asignarRoles);

router.get(
    "/historial/:usuario_id", 
    tienePermiso([
        "ADMINISTRADOR",
        "ESPECIALISTA",
        "JEFE DE TURNO",
        "SUPERVISOR",
        "CODIFICADOR"
    ]),
    obtenerHistorialRoles
);

router.post("/desactivar", esAdministrador, desactivarAsignacionRol);
router.post('/reasignar', esAdministrador, reasignarRol);

module.exports = router;