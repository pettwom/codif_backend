const logger = require('./logMiddleware');
const {userData} = require('../lib/auth');
const requestLogger = async(req, res, next) => {
    let _user = await userData(req, res);
    var id_usuario = null;
    if(_user) {
        id_usuario = _user.id_usuario;
    }else{
        id_usuario = 'anonymous';
    }
    // console.log(req.user, '<=== logs requestLogger');
    if (req.method === 'POST' || req.method === 'PUT') {
        const logData = { 
            method: req.method,
            url: req.originalUrl,
            body: req.body,
            timestamp: new Date().toISOString(),
            user: id_usuario // Captura información del usuario si está disponible
        };
        console.log(logData);
        
        // Registra la información en los logs
        logger.info(`Request received`, logData); 
    }

    next();
};

module.exports = requestLogger;