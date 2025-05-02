/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
'use strict';

require('dotenv').config();
const debug = require('debug')('app:app');
require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const  requestLogger  = require('./middlewares/logger');
const  logger  = require('./middlewares/logMiddleware');
const fs = require('fs');
//! configurar socket para websocket de las notificaciones
const { Server } = require('socket.io');

const { obtenerNotificaciones, initWebSocket } = require('./controllers/system/dashboard.controller');

const { userData } = require('./lib/auth');
const phantomPath = path.join(__dirname, 'node_modules', 'phantomjs-prebuilt', 'lib', 'phantom', 'bin', 'phantomjs');
const port = process.env.PORT || '3033';

const app = express();

///Inicializacion

const server = http.createServer(app);

const helmet = require("helmet");

const routes = require('./routes');


const io = new Server(server, {
    cors: {
        origin: '*', // Permite todas las conexiones de origen (ajustar según tus necesidades)
    },
});

initWebSocket(io);

function middelwares() { 

    //CORS
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'token']
    }));
    // Configurar la carpeta pública para servir archivos
    app.use('/uti', express.static(path.join(__dirname, 'public/uti')));
    // Lectura y parseo del body
    app.use(bodyParser.json({ limit: '100gb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '100gb' }));
    app.use(express.json());
    app.use(requestLogger); 
    app.use('/api/uploads', express.static(path.join(__dirname, 'public/upload')));
    // Configuración de Multer para almacenar archivos en 'public/uti'
    const storage = multer.diskStorage({
        destination: (req, file, cb) => { 
            cb(null, 'public/upload/');
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    });
    const upload = multer({ storage });
    app.use(helmet());
    // app.use(logger);

}

function listen() {
    server.listen(port, () => {
        console.log('Servidor corriendo en puerto', port);
    });
}

middelwares();

app.get('/checkConnection', (req, res) => {
    res.sendStatus(200); // Se devuelve un estado 200 si la conexión está activa
});

app.use('/api', routes());

app.get('/userdata', userData);

    app.use((err, req, res, next) => {

        if (err.message) {
            if (err.message.match(/not found/)) {
                return res.status(404).send({
                    statusCode: 404,
                    message: err.message,
                    path: '/login/expired',
                });
            }

            if (err.message.match(/Permission denied/)) {
                return res.status(401).send({
                    statusCode: 401,
                    message: 'No tiene permisos para realizar esta operación.',
                    path: '/login/expired',
                });
            }
            if (err.message.match(/jwt expired/)) {
                return res.status(401).send({
                    statusCode: 401,
                    message: 'Su sesión ha expirado, ingrese nuevamente al sistema.',
                    path: '/login/expired',
                });
            }

            if (err.message.match(/invalid token/)) {
                return res.status(400).send({
                    statusCode: 400,
                    message: 'Token invalido.',
                    path: '/login/invalid',
                });
            }

            if (err.message.match(/No authorization/)) {
                return res.status(403).send({
                    statusCode: 403,
                    message: `No ingreso la cabecera de 'Autorizacion' para usar este servicio.`,
                    path: '/login/invalid',
                });
            }

            if (err.message.match(/EAI_AGAIN/)) {
                return res.status(400).send({
                    statusCode: 400,
                    message: 'Uno de los servicios no se encuentra activo en estos momentos, vuelva a intentar dentro de unos minutos.',
                    path: '/login/invalid',
                });
            }
        }

        return res.status(500).send({
            statusCode: 500,
            message: err.message,
            path: '/api/error'
        });
    });

listen();