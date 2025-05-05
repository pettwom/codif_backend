const {con} = require("../../config/db");

// Para obtener todos los usuarios
const obtenerTodosLosRoles = async (req, res) => {

    try {
        // crea una promesa con la consulta para usar async/await
        const consultarRoles = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT id_rol, rol, descripcion, nivel, sistema 
                     FROM autenticacion.rol 
                     ORDER BY id_rol`,
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        // ejecuta la consulta
        const result = await consultarRoles();

        // verifica si hay resultados
        if (result.rowCount > 0) {
            return res.status(200).json({
                roles: result.rows,
                icon: "success",
                statusCode: 200,
                message: "Lista de todos los roles",
                path: "/roles"
            });
        } else {
            return res.status(204).json({
                icon: "info",
                statusCode: 204,
                message: "No se encontraron roles",
                path: "/roles"
            });
        }
    } catch (error) {
        console.error("Error en obtenerTodosLosRoles:", error);
        return res.status(error.sql ? 400 : 500).json({
            statusCode: error.sql ? 400 : 500,
            message: error.message || 'Error al obtener roles',
            path: "/roles"
        });
    }

};

// Para asignar roles a un usuario
const asignarRoles = async (req, res) => {
    // Creamos una promesa para realizar una transacción
    const realizarTransaccion = async () => {
        const client = await con.connect();
        try {
            // Iniciamos una transacción
            await client.query('BEGIN');

            const {usuario_id, roles} = req.body;

            if (!usuario_id || !roles || !Array.isArray(roles) || roles.length === 0) {
                throw {
                    statusCode: 400,
                    message: "Datos inválidos. Se requiere ID de usuario y al menos un rol"
                };
            }

            // Verificamos si el usuario existe
            const verificarUsuario = () => {
                return new Promise((resolve, reject) => {
                    client.query(
                        `SELECT aut_id_usuario FROM monitoreo.vw_usuarios WHERE aut_id_usuario = $1`,
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
                throw {
                    statusCode: 404,
                    message: "Usuario no encontrado"
                };
            }

            // Procesamos cada rol a asignar
            const resultados = [];

            for (const rolData of roles) {
                const {rol_id, turno = 'N/A'} = rolData;

                // Verificamos si el rol existe
                const verificarRol = () => {
                    return new Promise((resolve, reject) => {
                        client.query(
                            `SELECT id_rol FROM autenticacion.rol WHERE id_rol = $1`,
                            [rol_id],
                            (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            }
                        );
                    });
                };

                const rolExiste = await verificarRol();

                if (rolExiste.rowCount === 0) {
                    throw {
                        statusCode: 404,
                        message: `El rol con ID ${rol_id} no existe`
                    };
                }

                // Verificamos si ya existe una asignación activa
                const verificarAsignacion = () => {
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

                const asignacionExistente = await verificarAsignacion();

                if (asignacionExistente.rowCount > 0) {
                    // Desactivamos la asignación actual y la movemos al historial
                    const asignacionId = asignacionExistente.rows[0].id;

                    // Obtenemos los datos de la asignación actual
                    const obtenerAsignacionActual = () => {
                        return new Promise((resolve, reject) => {
                            client.query(
                                `SELECT * FROM asignacion.asignaciones WHERE id = $1`,
                                [asignacionId],
                                (err, result) => {
                                    if (err) reject(err);
                                    else resolve(result);
                                }
                            );
                        });
                    };

                    const asignacionActual = await obtenerAsignacionActual();

                    // Movemos la asignación actual al historial
                    const moverAHistorial = () => {
                        return new Promise((resolve, reject) => {
                            client.query(
                                `INSERT INTO asignacion.historial_asignaciones
                                 (usuario_id, rol_id, asignado_por, fecha_asignacion, fecha_finalizacion, turno, motivo_cambio)
                                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)`,
                                [
                                    usuario_id,
                                    rol_id,
                                    asignacionActual.rows[0].asignado_por,
                                    asignacionActual.rows[0].fecha_asignacion,
                                    asignacionActual.rows[0].turno,
                                    'Actualización de rol por administrador'
                                ],
                                (err, result) => {
                                    if (err) reject(err);
                                    else resolve(result);
                                }
                            );
                        });
                    };

                    await moverAHistorial();

                    // Actualizamos la asignación existente
                    const actualizarAsignacion = () => {
                        return new Promise((resolve, reject) => {
                            client.query(
                                `UPDATE asignacion.asignaciones
                                 SET turno = $1, asignado_por = $2, fecha_asignacion = CURRENT_TIMESTAMP
                                 WHERE id = $3`,
                                [turno, req.usuario.id_usuario, asignacionId],
                                (err, result) => {
                                    if (err) reject(err);
                                    else resolve(result);
                                }
                            );
                        });
                    };

                    await actualizarAsignacion();

                    resultados.push({
                        rol_id,
                        status: 'actualizado',
                        turno
                    });
                } else {
                    // Creamos una nueva asignación
                    const crearAsignacion = () => {
                        return new Promise((resolve, reject) => {
                            client.query(
                                `INSERT INTO asignacion.asignaciones
                                 (usuario_id, rol_id, asignado_por, turno)
                                 VALUES ($1, $2, $3, $4)`,
                                [usuario_id, rol_id, req.usuario.id_usuario, turno],
                                (err, result) => {
                                    if (err) reject(err);
                                    else resolve(result);
                                }
                            );
                        });
                    };

                    await crearAsignacion();

                    resultados.push({
                        rol_id,
                        status: 'asignado',
                        turno
                    });
                }
            }

            // Confirmamos la transacción
            await client.query('COMMIT');

            return {
                statusCode: 200,
                message: "Roles asignados correctamente",
                resultados,
                icon: "success"
            };
        } catch (error) {
            // En caso de error, rollback
            await client.query('ROLLBACK');
            throw error;
        } finally {
            // Liberar el cliente
            client.release();
        }
    };

    try {
        const resultado = await realizarTransaccion();
        return res.status(resultado.statusCode).json({
            ...resultado,
            path: "/roles/asignar"
        });
    } catch (error) {
        console.error("Error en asignarRoles:", error);
        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al asignar roles',
            path: "/roles/asignar"
        });
    }
};

// Para obtener el historial de roles de un usuario
const obtenerHistorialRoles = async (req, res) => {
    try {
        const { usuario_id } = req.params;

        if (!usuario_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de usuario",
                path: "/roles/historial"
            });
        }

        // Verificamos si el usuario existe
        const verificarUsuario = () => {
            return new Promise((resolve, reject) => {
                con.query(
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
                path: "/roles/historial"
            });
        }

        // Obtenemos las asignaciones actuales
        const obtenerAsignacionesActuales = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT a.id, a.rol_id, r.rol, r.descripcion, a.fecha_asignacion, a.turno,
                            u.aut_us_usuario AS asignado_por_nombre
                     FROM asignacion.asignaciones a
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     LEFT JOIN monitoreo.vw_usuarios u ON a.asignado_por = u.aut_id_usuario
                     WHERE a.usuario_id = $1 AND a.activo = TRUE
                     ORDER BY a.fecha_asignacion DESC`,
                    [usuario_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const asignacionesActuales = await obtenerAsignacionesActuales();

        // Obtenemos el historial de asignaciones
        const obtenerHistorialAsignaciones = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT h.id, h.rol_id, r.rol, r.descripcion, 
                            h.fecha_asignacion, h.fecha_finalizacion, h.turno,
                            u.aut_us_usuario AS asignado_por_nombre, h.motivo_cambio
                     FROM asignacion.historial_asignaciones h
                     JOIN autenticacion.rol r ON h.rol_id = r.id_rol
                     LEFT JOIN monitoreo.vw_usuarios u ON h.asignado_por = u.aut_id_usuario
                     WHERE h.usuario_id = $1
                     ORDER BY h.fecha_finalizacion DESC`,
                    [usuario_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const historialAsignaciones = await obtenerHistorialAsignaciones();

        return res.status(200).json({
            statusCode: 200,
            message: "Historial de roles obtenido correctamente",
            path: "/roles/historial",
            icon: "success",
            usuario: usuarioExiste.rows[0],
            asignacionesActuales: asignacionesActuales.rows,
            historialAsignaciones: historialAsignaciones.rows
        });

    } catch (error) {
        console.error("Error en obtenerHistorialRoles:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener historial de roles',
            path: "/roles/historial"
        });
    }
};

// Para desactivar una asignación de rol
const desactivarAsignacionRolInsertarManualEnElHistorial = async (req, res) => {
    const client = await con.connect();

    try {
        // Iniciamos una transacción
        await client.query('BEGIN');

        const { asignacion_id, motivo_cambio } = req.body;

        if (!asignacion_id || !motivo_cambio) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de asignación y motivo de cambio",
                path: "/roles/desactivar"
            });
        }

        // Verificamos si la asignación existe y está activa
        const verificarAsignacion = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT a.*, u.aut_us_usuario AS nombre_usuario
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                     WHERE a.id = $1 AND a.activo = TRUE`,
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
                message: "Asignación no encontrada o ya desactivada",
                path: "/roles/desactivar"
            });
        }

        const asignacion = asignacionExiste.rows[0];

        // Movemos la asignación al historial
        const moverAHistorial = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `INSERT INTO asignacion.historial_asignaciones
                     (usuario_id, rol_id, asignado_por, fecha_asignacion, fecha_finalizacion, turno, motivo_cambio)
                     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)`,
                    [
                        asignacion.usuario_id,
                        asignacion.rol_id,
                        asignacion.asignado_por,
                        asignacion.fecha_asignacion,
                        asignacion.turno,
                        motivo_cambio
                    ],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        await moverAHistorial();

        // Desactivamos la asignación
        const desactivarAsignacion = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `UPDATE asignacion.asignaciones
                     SET activo = FALSE
                     WHERE id = $1`,
                    [asignacion_id],
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
            message: `Rol desactivado correctamente para ${asignacion.nombre_usuario}`,
            path: "/roles/desactivar",
            icon: "success",
            asignacion: {
                id: asignacion.id,
                usuario_id: asignacion.usuario_id,
                nombre_usuario: asignacion.nombre_usuario,
                rol_id: asignacion.rol_id,
                motivo_cambio
            }
        });

    } catch (error) {
        // En caso de error, hacemos rollback
        await client.query('ROLLBACK');
        console.error("Error en desactivarAsignacionRol:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al desactivar asignación de rol',
            path: "/roles/desactivar"
        });
    } finally {
        // Liberamos el cliente
        client.release();
    }
};

// Método para desactivar una asignación de rol
const desactivarAsignacionRol = async (req, res) => {
    const client = await con.connect();

    try {
        // Iniciamos una transacción
        await client.query('BEGIN');

        const { asignacion_id, motivo_cambio = 'BAJA' } = req.body;

        if (!asignacion_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de asignación",
                path: "/roles/desactivar"
            });
        }

        // Verificamos si la asignación existe y está activa
        const verificarAsignacion = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT a.*, u.aut_us_usuario AS nombre_usuario
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                     WHERE a.id = $1 AND a.activo = TRUE`,
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
                message: "Asignación no encontrada o ya desactivada",
                path: "/roles/desactivar"
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
            message: `Rol desactivado correctamente para ${asignacion.nombre_usuario}`,
            path: "/roles/desactivar",
            icon: "success",
            asignacion: {
                id: asignacion.id,
                usuario_id: asignacion.usuario_id,
                nombre_usuario: asignacion.nombre_usuario,
                rol_id: asignacion.rol_id,
                motivo_cambio
            }
        });

    } catch (error) {
        // En caso de error, hacemos rollback
        await client.query('ROLLBACK');
        console.error("Error en desactivarAsignacionRol:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al desactivar asignación de rol',
            path: "/roles/desactivar"
        });
    } finally {
        // Liberamos el cliente
        client.release();
    }
};

// Para reasignar un rol previamente desactivado
const reasignarRol = async (req, res) => {
    const client = await con.connect();

    try {
        // Iniciamos una transacción
        await client.query('BEGIN');

        const { usuario_id, rol_id, turno = 'N/A' } = req.body;

        if (!usuario_id || !rol_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de usuario y ID de rol",
                path: "/roles/reasignar"
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
                path: "/roles/reasignar"
            });
        }

        // Verificamos si el rol existe
        const verificarRol = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT id_rol, rol FROM autenticacion.rol WHERE id_rol = $1`,
                    [rol_id],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const rolExiste = await verificarRol();

        if (rolExiste.rowCount === 0) {
            return res.status(404).json({
                statusCode: 404,
                message: "Rol no encontrado",
                path: "/roles/reasignar"
            });
        }

        // Verificamos si hay una asignación activa para este usuario y rol
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
                path: "/roles/reasignar"
            });
        }

        // Verificamos si hay asignaciones desactivadas para este rol
        const verificarAsignacionesAnteriores = () => {
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

        const asignacionesAnteriores = await verificarAsignacionesAnteriores();
        let idAsignacion;
        let esReactivacion = false;

        if (asignacionesAnteriores.rowCount > 0) {
            // Reactivamos la asignación existente
            const reactivarAsignacion = () => {
                return new Promise((resolve, reject) => {
                    client.query(
                        `UPDATE asignacion.asignaciones
                         SET activo = TRUE, 
                             turno = $1, 
                             asignado_por = $2, 
                             fecha_asignacion = CURRENT_TIMESTAMP,
                             motivo_cambio = 'REACTIVACION'
                         WHERE id = $3
                         RETURNING id`,
                        [turno, req.usuario.id_usuario, asignacionesAnteriores.rows[0].id],
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
            // Creamos una nueva asignación si no hay una anterior
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
                            'NUEVA_ASIGNACION'
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
            ? "Rol reactivado correctamente"
            : "Rol asignado correctamente (primera asignación)";

        return res.status(200).json({
            statusCode: 200,
            message: mensaje,
            path: "/roles/reasignar",
            icon: "success",
            asignacion: {
                id: idAsignacion,
                usuario_id,
                nombre_usuario: usuarioExiste.rows[0].nombre,
                rol_id,
                nombre_rol: rolExiste.rows[0].rol,
                turno,
                tipo: esReactivacion ? "REACTIVACION" : "NUEVA_ASIGNACION"
            }
        });

    } catch (error) {
        // En caso de error, hacemos rollback
        await client.query('ROLLBACK');
        console.error("Error en reasignarRol:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al reasignar rol',
            path: "/roles/reasignar"
        });
    } finally {
        // Liberamos el cliente
        client.release();
    }
};

module.exports = {
    obtenerTodosLosRoles,
    asignarRoles,
    obtenerHistorialRoles,
    desactivarAsignacionRol,
    reasignarRol
};