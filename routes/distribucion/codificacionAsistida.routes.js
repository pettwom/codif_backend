const express = require("express");
const {
    verificarRolJerarquico
} = require('../../controllers/asignacion/rolesEspecificos.controller');
const {
    obtenerCodificacionesAsistidas,
    obtenerDetallePregunta,
    obtenerEstadisticas,
    asignarPreguntaACodificador,
    asignarMultiplesPreguntas,
    obtenerMisPreguntas
} = require('../../controllers/distribucion/codificacionAsistida.controller');

const router = express.Router();

// Rutas para codificación asistida
// Solo usuarios con rol SUP o superior pueden acceder
router.get('/:nombre_corto', verificarRolJerarquico(['GSP', 'JTMT', 'SUP', 'COD']), obtenerCodificacionesAsistidas);
router.get('/detalle/:id_pregunta', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), obtenerDetallePregunta);
router.get('/estadisticas', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), obtenerEstadisticas);

// Rutas para asignación de preguntas - solo supervisores o superiores
router.post('/asignar', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), asignarPreguntaACodificador);

router.post('/asignar-multiples', verificarRolJerarquico(['GSP', 'JTMT', 'SUP']), asignarMultiplesPreguntas);

router.get('/codificador/mis-preguntas', verificarRolJerarquico(['COD']), obtenerMisPreguntas);

module.exports = router;