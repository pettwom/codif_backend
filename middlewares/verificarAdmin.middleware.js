const jwt = require('jsonwebtoken');
const { config } = require("../common");

// Middleware para verificar si es administrador
const esAdministrador = async (req, res, next) => {
    try {
        // Obtenemos el token del header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                statusCode: 401,
                message: "No autorizado: Token no proporcionado",
                path: req.path
            });
        }

        // Verificamos el token
        // const decoded = jwt.verify(token, process.env.ENCRIPT_SECRET);
        const decoded = jwt.verify(token, config.auth.secret);

        // Verificamos si el usuario es administrador
        if (decoded.usuario.tipo_usuario !== "ADMINISTRADOR") {
            return res.status(403).json({
                statusCode: 403,
                message: "Acceso denegado: Se requieren permisos de administrador",
                path: req.path
            });
        }

        // Guardamos la info del usuario para usar en los controladores
        req.usuario = decoded.usuario;
        next();
    } catch (error) {
        console.error("Error en esAdministrador:", error);

        let mensaje = "Token inválido o expirado";
        if (error.name === "TokenExpiredError") {
            mensaje = "El token ha expirado";
        } else if (error.name === "JsonWebTokenError") {
            mensaje = "Token malformado o firma inválida";
        } else if (error.name === "NotBeforeError") {
            mensaje = "El token aún no es válido";
        }

        return res.status(401).json({
            statusCode: 401,
            message: mensaje,
            path: req.path
        });
    }
};

module.exports = {
    esAdministrador
}
