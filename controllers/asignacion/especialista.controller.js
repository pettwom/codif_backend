const { con } = require("../../config/db");
const jwt = require("jsonwebtoken");

// Para verificar si es especialista (GSP) - middleware
const esEspecialista = async (req, res, next) => {
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
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        // Verificamos si el usuario tiene asignado el rol de GSP
        const verificarRolGSP = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT a.id 
                     FROM asignacion.asignaciones a
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     WHERE a.usuario_id = $1 AND r.rol = 'Especialista Codificador' AND a.activo = TRUE`,
                     // WHERE a.usuario_id = $1 AND r.rol = 'GSP' AND a.activo = TRUE`,
                    [decoded.usuario.id_usuario],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const esGSP = await verificarRolGSP();

        if (esGSP.rowCount === 0) {
            return res.status(403).json({
                statusCode: 403,
                message: "Acceso denegado: Se requieren permisos de Especialista (GSP)",
                path: req.path
            });
        }

        // Guardamos la info del usuario para usar en los controladores
        req.usuario = decoded.usuario;
        next();
    } catch (error) {
        console.error("Error en esEspecialista:", error);
        return res.status(401).json({
            statusCode: 401,
            message: "Token inválido o expirado",
            path: req.path
        });
    }
};

// Para asignar roles de jefatura (JTM o JTT) para especialistas
const asignarRolesJefatura = async (req, res) => {
    const client = await con.connect();

    try {
        // Iniciamos una transacción
        await client.query('BEGIN');

        const { usuario_id, rol_id, turno } = req.body;

        if (!usuario_id || !rol_id || !turno) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de usuario, ID de rol y turno",
                path: "/especialista/asignar"
            });
        }

        // Verificamos que el turno sea válido
        if (!['MAÑANA', 'TARDE'].includes(turno)) {
            return res.status(400).json({
                statusCode: 400,
                message: "El turno debe ser 'MAÑANA' o 'TARDE'",
                path: "/especialista/asignar"
            });
        }

        // Verificamos si el usuario existe
        const verificarUsuario = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT aut_id_usuario, aut_us_usuario FROM monitoreo.vw_usuarios WHERE aut_id_usuario = $1`,
                    [usuario_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const usuarioExiste = await verificarUsuario();

        if (usuarioExiste.rowCount === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Usuario no encontrado",
                path: "/especialista/asignar"
            });
        }

        // Verificamos que el rol sea JTM o JTT
        const verificarRol = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT id_rol, rol FROM autenticacion.rol 
                     WHERE id_rol = $1 AND rol IN ('Jefe Nacional Temática', 'Sub Jefe Temática')`,
                     // WHERE id_rol = $1 AND rol IN ('JTM', 'JTT')`,
                    [rol_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const rolValido = await verificarRol();

        if (rolValido.rowCount === 0) {
            return res.status(400).json({
                statusCode: 400,
                message: "El especialista solo puede asignar roles de jefatura (JTM o JTT)",
                path: "/especialista/asignar"
            });
        }

        // Verificamos que el turno coincida con el rol
        const rolAsignado = rolValido.rows[0].rol;

        if ((rolAsignado === 'JTM' && turno !== 'MAÑANA') ||
            (rolAsignado === 'JTT' && turno !== 'TARDE')) {
            return res.status(400).json({
                statusCode: 400,
                message: `El turno debe ser 'MAÑANA' para JTM y 'TARDE' para JTT`,
                path: "/especialista/asignar"
            });
        }

        // Verificamos si ya existe una asignación activa
        const verificarAsignacionActiva = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT id FROM asignacion.asignaciones 
                     WHERE usuario_id = $1 AND rol_id = $2 AND activo = TRUE`,
                    [usuario_id, rol_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const asignacionActiva = await verificarAsignacionActiva();

        if (asignacionActiva.rowCount > 0) {
            return res.status(400).json({
                statusCode: 400,
                message: "El usuario ya tiene este rol asignado y activo",
                path: "/especialista/asignar"
            });
        }

        // Verificamos si hay asignaciones desactivadas para reactivar
        const verificarAsignacionInactiva = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT id FROM asignacion.asignaciones 
                     WHERE usuario_id = $1 AND rol_id = $2 AND activo = FALSE
                     ORDER BY fecha_asignacion DESC LIMIT 1`,
                    [usuario_id, rol_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const asignacionInactiva = await verificarAsignacionInactiva();
        let idAsignacion;
        let esReactivacion = false;

        if (asignacionInactiva.rowCount > 0) {
            // Reactivamos la asignación existente
            const reactivarAsignacion = () => {
                return new Promise((resolve, reject) => {
                    client.query(
                        `UPDATE asignacion.asignaciones
                         SET activo = TRUE, 
                             turno = $1, 
                             asignado_por = $2, 
                             fecha_asignacion = CURRENT_TIMESTAMP,
                             motivo_cambio = 'REACTIVACION_POR_GSP'
                         WHERE id = $3
                         RETURNING id`,
                        [turno, req.usuario.id_usuario, asignacionInactiva.rows[0].id],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        }
                    );
                });
            };

            const asignacionReactivada = await reactivarAsignacion();
            idAsignacion = asignacionReactivada.rows[0].id;
            esReactivacion = true;
        } else {
            // Creamos una nueva asignación
            const crearAsignacion = () => {
                return new Promise((resolve, reject) => {
                    client.query(
                        `INSERT INTO asignacion.asignaciones
                         (usuario_id, rol_id, asignado_por, turno, motivo_cambio)
                         VALUES ($1, $2, $3, $4, $5)
                         RETURNING id`,
                        [
                            usuario_id,
                            rol_id,
                            req.usuario.id_usuario,
                            turno,
                            'ASIGNACION_POR_GSP'
                        ],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        }
                    );
                });
            };

            const nuevaAsignacion = await crearAsignacion();
            idAsignacion = nuevaAsignacion.rows[0].id;
        }

        // Confirmamos la transacción
        await client.query('COMMIT');

        // Preparamos la respuesta
        let mensaje = esReactivacion
            ? "Rol de jefatura reactivado correctamente"
            : "Rol de jefatura asignado correctamente";

        return res.status(200).json({
            statusCode: 200,
            message: mensaje,
            path: "/especialista/asignar",
            icon: "success",
            asignacion: {
                id: idAsignacion,
                usuario_id,
                nombre_usuario: usuarioExiste.rows[0].nombre,
                rol_id,
                nombre_rol: rolValido.rows[0].rol,
                turno,
                tipo: esReactivacion ? "REACTIVACION" : "NUEVA_ASIGNACION"
            }
        });

    } catch (error) {
        // En caso de error, hacemos rollback
        await client.query('ROLLBACK');
        console.error("Error en asignarRolesJefatura:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al asignar rol de jefatura',
            path: "/especialista/asignar"
        });
    } finally {
        // Liberamos el cliente
        client.release();
    }
};

// Para desactivar roles de jefatura
const desactivarRolJefatura = async (req, res) => {
    const client = await con.connect();

    try {
        // Iniciamos una transacción
        await client.query('BEGIN');

        const { asignacion_id, motivo_cambio = 'DESACTIVACION_POR_GSP' } = req.body;

        if (!asignacion_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de asignación",
                path: "/especialista/desactivar"
            });
        }

        // Verificamos si la asignación existe, está activa y es de jefatura
        const verificarAsignacion = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT a.*, u.nombre AS nombre_usuario, r.rol AS nombre_rol
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.id_usuario
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     WHERE a.id = $1 AND a.activo = TRUE AND r.rol IN ('Jefe Nacional Temática', 'Sub Jefe Temática')`,
                     // WHERE a.id = $1 AND a.activo = TRUE AND r.rol IN ('JTM', 'JTT')`,
                    [asignacion_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const asignacionExiste = await verificarAsignacion();

        if (asignacionExiste.rowCount === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Asignación no encontrada, ya desactivada o no es de jefatura",
                path: "/especialista/desactivar"
            });
        }

        const asignacion = asignacionExiste.rows[0];

        // Desactivamos la asignación y definimos el motivo
        const desactivarAsignacion = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `UPDATE asignacion.asignaciones
                     SET activo = FALSE, motivo_cambio = $2
                     WHERE id = $1`,
                    [asignacion_id, motivo_cambio],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        await desactivarAsignacion();

        // Confirmamos la transacción
        await client.query('COMMIT');

        return res.status(200).json({
            statusCode: 200,
            message: `Rol de jefatura desactivado correctamente para ${asignacion.nombre_usuario}`,
            path: "/especialista/desactivar",
            icon: "success",
            asignacion: {
                id: asignacion.id,
                usuario_id: asignacion.usuario_id,
                nombre_usuario: asignacion.nombre_usuario,
                rol_id: asignacion.rol_id,
                nombre_rol: asignacion.nombre_rol,
                motivo_cambio
            }
        });

    } catch (error) {
        // En caso de error, hacemos rollback
        await client.query('ROLLBACK');
        console.error("Error en desactivarRolJefatura:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al desactivar rol de jefatura',
            path: "/especialista/desactivar"
        });
    } finally {
        // Liberamos el cliente
        client.release();
    }
};

// Método para obtener jefaturas asignadas
const obtenerJefaturasAsignadas = async (req, res) => {
    console.log("sd");
    try {
        // Consulta para obtener las asignaciones de jefatura activas
        const obtenerAsignaciones = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT a.id, a.usuario_id, u.aut_us_usuario AS nombre_usuario, 
                            a.rol_id, r.rol AS nombre_rol, a.turno, 
                            a.fecha_asignacion, v.nombre AS asignado_por_nombre
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.id_usuario
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     LEFT JOIN monitoreo.vw_usuarios v ON a.asignado_por = v.aut_id_usuario
                     WHERE a.activo = TRUE AND r.rol IN ('Jefe Nacional Temática', 'Sub Jefe Temática')
                     ORDER BY r.rol, a.fecha_asignacion DESC`,
                    [],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const asignaciones = await obtenerAsignaciones();

        // Organizamos los resultados por tipo de jefatura
        // const jefaturasMañana = asignaciones.rows.filter(a => a.nombre_rol === 'JTM');
        // const jefaturasTarde = asignaciones.rows.filter(a => a.nombre_rol === 'JTT');
        const jefaturasMañana = asignaciones.rows.filter(a => a.nombre_rol === 'Jefe Nacional Temática');
        const jefaturasTarde = asignaciones.rows.filter(a => a.nombre_rol === 'Sub Jefe Temática');

        return res.status(200).json({
            statusCode: 200,
            message: "Jefaturas asignadas obtenidas correctamente",
            path: "/especialista/jefaturas",
            icon: "success",
            jefaturas: {
                mañana: jefaturasMañana,
                tarde: jefaturasTarde,
                total: asignaciones.rowCount
            }
        });

    } catch (error) {
        console.error("Error en obtenerJefaturasAsignadas:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener jefaturas asignadas',
            path: "/especialista/jefaturas"
        });
    }
};

module.exports = {
    esEspecialista,
    asignarRolesJefatura,
    desactivarRolJefatura,
    obtenerJefaturasAsignadas
};