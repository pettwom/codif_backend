const jwt = require('jsonwebtoken');
const { config } = require("../common");

const tienePermiso = (rolesPermitidos = []) => {
    return async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(" ")[1];
            if (!token) {
                return res.status(401).json({
                    statusCode: 401,
                    message: "No autorizado:: Token no proporcionado",
                    path: req.path
                });
            }

            const decoded = jwt.verify(token, config.auth.secret);
            const rolUsuario = decoded.usuario.tipo_usuario;

            // Verificar si el rol del usuario está en los permitidos
            if (!rolesPermitidos.includes(rolUsuario)) {
                return res.status(403).json({
                    statusCode: 403,
                    message: `Acceso denegado: Rol ${rolUsuario} no autorizado`,
                    path: req.path
                });
            }

            req.usuario = decoded.usuario;
            next();
        } catch (error) {
            // Manejo de errores (igual que en esAdministrador)
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
};

module.exports = {
    tienePermiso
}
