const express = require("express");
const router = express.Router();

const {esAdministrador} = require('../../middlewares/verificarAdmin.middleware');

const {
    obtenerTodosLosRoles,
    asignarRoles,
    obtenerHistorialRoles,
    desactivarAsignacionRol,
    reasignarRol
} = require("../../controllers/asignacion/role.controller");

router.get("/", obtenerTodosLosRoles);
router.post("/asignar", esAdministrador, asignarRoles);
router.get("/historial/:usuario_id", obtenerHistorialRoles);
router.post("/desactivar", esAdministrador, desactivarAsignacionRol);
router.post('/reasignar', esAdministrador, reasignarRol);

module.exports = router;