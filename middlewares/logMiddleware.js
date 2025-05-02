/* eslint-disable no-undef */
const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Verificar si existe la carpeta de logs
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Configuración del logger
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.json() // Registra los logs en formato JSON
    ),
    transports: [
        new transports.File({ filename: path.join(logDir, 'logs.log') }), // Archivo de logs
        new transports.Console() // También muestra los logs en consola
    ]
});

module.exports = logger;