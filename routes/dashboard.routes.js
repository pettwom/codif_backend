const { Router } = require('express');

const {

    obtenerNotificaciones,
    notificacion_t,
    marcarVisto,
    almacenarNoti,
    getUser
} = require('../controllers/system/dashboard.controller');

const router = Router();

router.get('/notificacion', obtenerNotificaciones);
router.get('/notificacion_t/:ids', notificacion_t);
router.put('/marcarVisto/', marcarVisto);
router.post('/almacenarNoti/', almacenarNoti);
router.get('/getUser/', getUser);

module.exports = router;
