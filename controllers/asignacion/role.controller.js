const {con} = require("../../config/db");

const obtenerRolesPorJerarquia = async (req, res) => {
    try {
        const {tipo_usuario} = req.usuario;

        const jerarquia = {
            'ADMINISTRADOR': ['GSP', 'JTMT', 'SUP', 'COD'], // ADMINISTRADOR PUEDE VER TODOS LOS ROLES
            'ESPECIALISTA': ['JTMT'], // ESPECIALISTA(GSP) SOLO EL ROL JEFE DE TURNO(JTMT)
            'JEFE DE TURNO': ['SUP'], // JEFE DE TURNO(JTMT) SOLO EL ROL SUPERVISOR(SUP)
            'SUPERVISOR': ['COD'], // SUPERVISOR(SUP) SOLO EL ROL CODIFICADOR(COD)
            'CODIFICADOR': [] // CODIFICADOR(COD) NO VE NADA
        };

        const sistemasPermitidos = jerarquia[tipo_usuario] || [];

        // Si no tiene permisos para el sistema, retornar lista vacia
        if (sistemasPermitidos.length === 0) {
            return res.status(200).json({
                roles: [],
                icon: "info",
                statusCode: 200,
                message: `No tiene permisos para asignar roles`,
                path: `/roles/jerarquia/sistemas`
            });
        }

        // Construir query con placeholders para los sistemas permitidos
        const placeholders = sistemasPermitidos.map((_, i) => `$${i + 1}`).join(', ');

        const sqlQuery = `
            SELECT id_rol, rol, descripcion, nivel, sistema
            FROM autenticacion.rol
            WHERE sistema IN (${placeholders})
            ORDER BY id_rol
        `;

        // Función para ejecutar la consulta
        const consultarRoles = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    sqlQuery,
                    sistemasPermitidos,
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        // Ejecutar la consulta
        const result = await consultarRoles();

        // Verificar si hay resultados
        if (result.rowCount > 0) {
            return res.status(200).json({
                roles: result.rows,
                icon: "success",
                statusCode: 200,
                message: `Roles disponibles para ${tipo_usuario}`,
                path: `/roles/jerarquia/sistemas`
            });
        } else {
            return res.status(200).json({
                roles: [],
                icon: "info",
                statusCode: 200,
                message: `No se encontraron roles asignables para ${tipo_usuario}`,
                path: `/roles/jerarquia/sistemas`
            });
        }
    } catch (error) {
        console.error("Error en obtenerRolesPorJerarquia:", error);
        return res.status(error.sql ? 400 : 500).json({
            statusCode: error.sql ? 400 : 500,
            message: error.message || 'Error al obtener roles por jerarquía',
            path: `/roles/jerarquia/sistemas`
        });
    }
};

const obtenerUsuariosPorJerarquia = async (req, res) => {
    try {
        const {nombre_corto} = req.params;

        // Extraer el tipo de usuario del token
        const {tipo_usuario} = req.usuario;

        // Jerarquía de roles y qué roles puede ver cada tipo de usuario
        const jerarquia = {
            'ADMINISTRADOR': ['ESPECIALISTA', 'JEFE DE TURNO', 'SUPERVISOR', 'CODIFICADOR'], // ADMINISTRADOR PUEDE VER TODOS LOS USUARIOS SIN IMPORTAR EL ROL
            'ESPECIALISTA': ['JEFE DE TURNO'], // ESPECIALISTA(GSP) SOLO PUEDE VER A LOS USUARIOS CON ROL JEFE DE TURNO(JTMT)
            'JEFE DE TURNO': ['SUPERVISOR'], // JEFE DE TURNO(JTMT) SOLO PUEDE VER A LOS USUARIOS CON EL ROL SUPERVISOR(SUP)
            'SUPERVISOR': ['CODIFICADOR'], // SUPERVISOR(SUP) SOLO PUEDE VER A LOS USUARIOS CON EL ROL CODIFICADOR(COD)
            'CODIFICADOR': [] // CODIFICADOR(COD) NO VE NINGUN USUARIO
        };

        // Verificar si el tipo de usuario es valido
        if (!jerarquia[tipo_usuario]) {
            return res.status(403).json({
                icon: "error",
                statusCode: 403,
                message: "Tipo de usuario no autorizado",
                path: "/roles/jerarquia"
            });
        }

        // Si el usuario no puede ver a nadie, retornar lista vacia
        if (jerarquia[tipo_usuario].length === 0) {
            return res.status(200).json({
                roles: [],
                icon: "info",
                statusCode: 200,
                message: "No tiene permisos para ver usuarios",
                path: "/roles/jerarquia"
            });
        }

        // Construir la condicion IN para la consulta SQL
        const rolesVisibles = jerarquia[tipo_usuario];
        const condicionRoles = rolesVisibles.map(rol => `'${rol}'`).join(', ');

        // Mapeo de tipos de usuario a códigos de sistema
        const tipoUsuarioASistema = {
            'ESPECIALISTA': 'GSP',
            'JEFE DE TURNO': 'JTMT',
            'SUPERVISOR': 'SUP',
            'CODIFICADOR': 'COD'
        };

        // Obtener el código de sistema para el usuario actual
        const sistemaUsuarioActual = tipoUsuarioASistema[tipo_usuario];

        // Metodo para obtener usuarios filtrados por roles con información de asignación
        const obtenerUsuariosFiltrados = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT 
                        u.aut_id_usuario,
                        u.aut_us_usuario,
                        u.aut_us_nombres,
                        u.aut_us_paterno,
                        u.aut_us_materno,
                        u.aut_us_ci,
                        u.per_correo_electronico,
                        u.aut_us_rol,
                        u.rol,
                        u.aut_us_estado,
                        -- Nuevos campos de asignación
                        CASE WHEN a.id IS NOT NULL THEN TRUE ELSE FALSE END AS esta_asignado,
                        a.fecha_asignacion,
                        a.turno,
                        asignador.aut_us_usuario AS asignador_nombre,
                        -- Relación con la tabla rol para obtener el sistema/código
                        r2.sistema AS codigo_rol, asignador.rol AS asignador_rol
                        FROM monitoreo.vw_usuarios u
                        -- Join con la tabla rol para filtrar por nombre_corto_nivel
                        JOIN autenticacion.rol r ON u.aut_us_rol = r.id_rol
                        -- Left join con asignaciones para saber si está asignado
                        LEFT JOIN asignacion.asignaciones a ON 
                            u.aut_id_usuario = a.usuario_id AND 
                            a.activo = TRUE
                        -- Left join para obtener información del asignador
                        LEFT JOIN monitoreo.vw_usuarios asignador ON 
                            a.asignado_por = asignador.aut_id_usuario
                        -- Join para obtener el código/sistema del rol
                        LEFT JOIN autenticacion.rol r2 ON 
                            a.rol_id = r2.id_rol
                        WHERE u.rol IN (${condicionRoles})
                        AND r.nombre_corto_nivel ILIKE $1
                        ORDER BY u.aut_us_usuario`,
                            [nombre_corto],
                            (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            }
                        );
            });
        };

        // Obtener los usuarios segun la jerarquía
        const usuarios = await obtenerUsuariosFiltrados();

        // Verificar si hay resultados
        if (usuarios.rowCount > 0) {
            return res.status(200).json({
                roles: usuarios.rows,
                icon: "success",
                statusCode: 200,
                message: `Lista de usuarios visibles para ${tipo_usuario}`,
                path: "/roles/jerarquia"
            });
        } else {
            return res.status(204).json({
                icon: "info",
                statusCode: 204,
                message: "No se encontraron usuarios",
                path: "/roles/jerarquia"
            });
        }
    } catch (error) {
        console.error("Error en el metodo obtenerUsuariosPorJerarquia:", error);
        return res.status(error.sql ? 400 : 500).json({
            statusCode: error.sql ? 400 : 500,
            message: error.message || 'Error al obtener usuarios por jerarquía',
            path: "/roles/jerarquia"
        });
    }
};

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

                    // await moverAHistorial();

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
        const {usuario_id} = req.params;

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

        const {asignacion_id, motivo_cambio} = req.body;

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

        // await moverAHistorial();

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

        const {asignacion_id, motivo_cambio = 'BAJA'} = req.body;

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

        const {usuario_id, rol_id, turno = 'N/A'} = req.body;

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

const obtenerUsuariosAsignadosPorMi = async (req, res) => {
    try {
        // Extraer el ID del usuario actual y su rol actual
        const usuarioActualId = req.usuario.id_usuario;
        const rolActual = req.rolActual;

        // Mapeo de roles del sistema a nombres más descriptivos
        const rolSistemaANombre = {
            'GSP': 'ESPECIALISTA',
            'JTMT': 'JEFE DE TURNO',
            'SUP': 'SUPERVISOR',
            'COD': 'CODIFICADOR'
        };

        // Obtener el nombre descriptivo del rol actual
        const nombreRolActual = rolSistemaANombre[rolActual] || rolActual;

        // Jerarquía de roles y qué roles puede ver cada tipo de usuario
        const jerarquia = {
            'GSP': ['JTMT'],
            'JTMT': ['SUP'],
            'SUP': ['COD'],
            'COD': []
        };

        // Verificar si el rol del usuario es válido
        if (!jerarquia[rolActual]) {
            return res.status(403).json({
                icon: "error",
                statusCode: 403,
                message: "Rol no autorizado",
                path: "/roles/mis-asignaciones"
            });
        }

        // Si el usuario no puede ver a nadie, retornar lista vacía
        if (jerarquia[rolActual].length === 0) {
            return res.status(200).json({
                roles: [],
                icon: "info",
                statusCode: 200,
                message: "No tiene permisos para ver usuarios",
                path: "/roles/mis-asignaciones"
            });
        }

        // Obtener los roles que este usuario puede ver
        const rolesVisibles = jerarquia[rolActual];

        // Método para obtener usuarios asignados por el usuario actual
        const obtenerUsuariosAsignados = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT 
                        u.aut_id_usuario,
                        u.aut_us_usuario,
                        u.aut_us_nombres,
                        u.aut_us_paterno,
                        u.aut_us_materno,
                        u.aut_us_ci,
                        u.per_correo_electronico,
                        u.aut_us_rol,
                        u.rol,
                        u.aut_us_estado,
                        a.id AS id_asignacion,
                        a.fecha_asignacion,
                        a.turno,
                        r.sistema AS codigo_rol,
                        r.rol AS nombre_rol
                    FROM asignacion.asignaciones a
                    JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                    WHERE a.asignado_por = $1
                    AND a.activo = TRUE
                    AND r.sistema IN (${rolesVisibles.map(rol => `'${rol}'`).join(',')})
                    ORDER BY a.fecha_asignacion DESC, u.aut_us_usuario`,
                    [usuarioActualId],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        // Obtener los usuarios asignados
        const usuariosAsignados = await obtenerUsuariosAsignados();

        // Organizar los resultados por turno
        const usuariosPorTurno = {
            mañana: usuariosAsignados.rows.filter(u => u.turno === 'MAÑANA'),
            tarde: usuariosAsignados.rows.filter(u => u.turno === 'TARDE'),
            sinTurno: usuariosAsignados.rows.filter(u => u.turno === 'N/A')
        };

        // Crear un objeto con información adicional para cada turno
        const resultadoPorTurno = Object.keys(usuariosPorTurno).map(turno => {
            const usuarios = usuariosPorTurno[turno];
            return {
                turno: turno === 'sinTurno' ? 'Sin turno asignado' : turno.toUpperCase(),
                usuarios: usuarios,
                total: usuarios.length
            };
        });

        // Verificar si hay resultados
        if (usuariosAsignados.rowCount > 0) {
            return res.status(200).json({
                icon: "success",
                statusCode: 200,
                message: `Personal asignado por usted (${nombreRolActual})`,
                path: "/roles/mis-asignaciones",
                turnos: resultadoPorTurno,
                total: usuariosAsignados.rowCount
            });
        } else {
            return res.status(200).json({
                icon: "info",
                statusCode: 200,
                message: "No ha asignado personal aún",
                path: "/roles/mis-asignaciones",
                turnos: resultadoPorTurno,
                total: 0
            });
        }
    } catch (error) {
        console.error("Error en el método obtenerUsuariosAsignadosPorMi:", error);
        return res.status(error.sql ? 400 : 500).json({
            statusCode: error.sql ? 400 : 500,
            message: error.message || 'Error al obtener usuarios asignados',
            path: "/roles/mis-asignaciones"
        });
    }
};

// Método para obtener usuarios sin asignaciones de preguntas (disponibles para asignar)
const obtenerUsuariosDisponibles = async (req, res) => {
    try {
        // Extraer el ID del usuario actual y su rol actual
        const usuarioActualId = req.usuario.id_usuario;
        const rolActual = req.rolActual;

        // Mapeo de roles del sistema a nombres más descriptivos
        const rolSistemaANombre = {
            'GSP': 'ESPECIALISTA',
            'JTMT': 'JEFE DE TURNO',
            'SUP': 'SUPERVISOR',
            'COD': 'CODIFICADOR'
        };

        // Obtener el nombre descriptivo del rol actual
        const nombreRolActual = rolSistemaANombre[rolActual] || rolActual;

        // Jerarquía de roles y qué roles puede ver cada tipo de usuario
        const jerarquia = {
            'GSP': ['JTMT'],
            'JTMT': ['SUP'],
            'SUP': ['COD'],
            'COD': []
        };

        // Verificar si el rol del usuario es válido
        if (!jerarquia[rolActual]) {
            return res.status(403).json({
                icon: "error",
                statusCode: 403,
                message: "Rol no autorizado",
                path: "/roles/usuarios-disponibles"
            });
        }

        // Si el usuario no puede ver a nadie, retornar lista vacía
        if (jerarquia[rolActual].length === 0) {
            return res.status(200).json({
                usuarios: [],
                icon: "info",
                statusCode: 200,
                message: "No tiene permisos para ver usuarios",
                path: "/roles/usuarios-disponibles"
            });
        }

        // Obtener los roles que este usuario puede ver
        const rolesVisibles = jerarquia[rolActual];

        // Método para obtener usuarios asignados por el usuario actual y que NO tienen preguntas asignadas
        const obtenerUsuariosDisponibles = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT 
                        u.aut_id_usuario,
                        u.aut_us_usuario,
                        u.aut_us_nombres,
                        u.aut_us_paterno,
                        u.aut_us_materno,
                        u.aut_us_ci,
                        u.per_correo_electronico,
                        u.aut_us_rol,
                        u.rol,
                        u.aut_us_estado,
                        a.id AS id_asignacion,
                        a.fecha_asignacion,
                        a.turno,
                        r.sistema AS codigo_rol,
                        r.rol AS nombre_rol,
                        FALSE AS tiene_preguntas_asignadas,
                        0 AS cantidad_preguntas_asignadas,
                        0 AS total_codificaciones_asignadas
                    FROM asignacion.asignaciones a
                    JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                    LEFT JOIN (
                        SELECT DISTINCT codificador_id
                        FROM asignacion.asignacion_preguntas
                        WHERE esta_asignada = TRUE
                    ) ap ON u.aut_id_usuario = ap.codificador_id
                    WHERE a.asignado_por = $1
                    AND a.activo = TRUE
                    AND r.sistema IN (${rolesVisibles.map(rol => `'${rol}'`).join(',')})
                    AND ap.codificador_id IS NULL  -- Solo incluir usuarios SIN preguntas asignadas
                    ORDER BY a.fecha_asignacion DESC, u.aut_us_usuario`,
                    [usuarioActualId],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        // Obtener los usuarios disponibles
        const usuariosDisponibles = await obtenerUsuariosDisponibles();

        // Organizar los resultados por turno
        const usuariosPorTurno = {
            mañana: usuariosDisponibles.rows.filter(u => u.turno === 'MAÑANA'),
            tarde: usuariosDisponibles.rows.filter(u => u.turno === 'TARDE'),
            sinTurno: usuariosDisponibles.rows.filter(u => u.turno === 'N/A')
        };

        // Crear un objeto con información adicional para cada turno
        const resultadoPorTurno = Object.keys(usuariosPorTurno).map(turno => {
            const usuarios = usuariosPorTurno[turno];
            return {
                turno: turno === 'sinTurno' ? 'Sin turno asignado' : turno.toUpperCase(),
                usuarios: usuarios,
                total: usuarios.length
            };
        });

        // Verificar si hay resultados
        if (usuariosDisponibles.rowCount > 0) {
            return res.status(200).json({
                icon: "success",
                statusCode: 200,
                message: `Codificadores disponibles para asignar preguntas (${nombreRolActual})`,
                path: "/roles/usuarios-disponibles",
                turnos: resultadoPorTurno,
                total: usuariosDisponibles.rowCount
            });
        } else {
            return res.status(200).json({
                icon: "info",
                statusCode: 200,
                message: "No hay codificadores disponibles para asignar preguntas",
                path: "/roles/usuarios-disponibles",
                turnos: resultadoPorTurno,
                total: 0
            });
        }
    } catch (error) {
        console.error("Error en el método obtenerUsuariosDisponibles:", error);
        return res.status(error.sql ? 400 : 500).json({
            statusCode: error.sql ? 400 : 500,
            message: error.message || 'Error al obtener usuarios disponibles',
            path: "/roles/usuarios-disponibles"
        });
    }
};

// ----- NUEVOS METODOS --------

// Método para obtener todos los usuarios asignados por mí y su estado de asignación de preguntas
const obtenerTodosUsuariosAsignados = async (req, res) => {
    try {
        // Extraer el ID del usuario actual y su rol actual
        const usuarioActualId = req.usuario.id_usuario;
        const rolActual = req.rolActual;

        // Mapeo de roles del sistema a nombres más descriptivos
        const rolSistemaANombre = {
            'GSP': 'ESPECIALISTA',
            'JTMT': 'JEFE DE TURNO',
            'SUP': 'SUPERVISOR',
            'COD': 'CODIFICADOR'
        };

        // Obtener el nombre descriptivo del rol actual
        const nombreRolActual = rolSistemaANombre[rolActual] || rolActual;

        // Jerarquía de roles y qué roles puede ver cada tipo de usuario
        const jerarquia = {
            'GSP': ['JTMT'],
            'JTMT': ['SUP'],
            'SUP': ['COD'],
            'COD': []
        };

        // Verificar si el rol del usuario es válido
        if (!jerarquia[rolActual]) {
            return res.status(403).json({
                icon: "error",
                statusCode: 403,
                message: "Rol no autorizado",
                path: "/roles/usuarios-asignados"
            });
        }

        // Si el usuario no puede ver a nadie, retornar lista vacía
        if (jerarquia[rolActual].length === 0) {
            return res.status(200).json({
                usuarios: [],
                icon: "info",
                statusCode: 200,
                message: "No tiene permisos para ver usuarios",
                path: "/roles/usuarios-asignados"
            });
        }

        // Obtener los roles que este usuario puede ver
        const rolesVisibles = jerarquia[rolActual];

        // Método para obtener TODOS los usuarios asignados por el usuario actual
        // con información sobre si tienen preguntas asignadas o no
        const obtenerTodosUsuariosConEstado = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT 
                        u.aut_id_usuario,
                        u.aut_us_usuario,
                        u.aut_us_nombres,
                        u.aut_us_paterno,
                        u.aut_us_materno,
                        u.aut_us_ci,
                        u.per_correo_electronico,
                        u.aut_us_rol,
                        u.rol,
                        u.aut_us_estado,
                        a.id AS id_asignacion,
                        a.fecha_asignacion,
                        a.turno,
                        r.sistema AS codigo_rol,
                        r.rol AS nombre_rol,
                        -- Información sobre asignación de preguntas
                        CASE 
                            WHEN ap.codificador_id IS NOT NULL THEN TRUE 
                            ELSE FALSE 
                        END AS tiene_preguntas_asignadas,
                        COALESCE(ap.cantidad_preguntas, 0) AS cantidad_preguntas_asignadas,
                        COALESCE(ap.total_codificaciones, 0) AS total_codificaciones_asignadas
                    FROM asignacion.asignaciones a
                    JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                    LEFT JOIN (
                        SELECT 
                            codificador_id,
                            COUNT(DISTINCT pregunta_id) AS cantidad_preguntas,
                            SUM(cantidad_asignada) AS total_codificaciones
                        FROM asignacion.asignacion_preguntas
                        WHERE esta_asignada = TRUE
                        GROUP BY codificador_id
                    ) ap ON u.aut_id_usuario = ap.codificador_id
                    WHERE a.asignado_por = $1
                    AND a.activo = TRUE
                    AND r.sistema IN (${rolesVisibles.map(rol => `'${rol}'`).join(',')})
                    ORDER BY a.fecha_asignacion DESC, u.aut_us_usuario`,
                    [usuarioActualId],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        // Obtener todos los usuarios asignados con su estado
        const todosUsuarios = await obtenerTodosUsuariosConEstado();

        // Organizar los resultados por turno
        const usuariosPorTurno = {
            mañana: todosUsuarios.rows.filter(u => u.turno === 'MAÑANA'),
            tarde: todosUsuarios.rows.filter(u => u.turno === 'TARDE'),
            sinTurno: todosUsuarios.rows.filter(u => u.turno === 'N/A')
        };

        // Crear un objeto con información adicional para cada turno
        const resultadoPorTurno = Object.keys(usuariosPorTurno).map(turno => {
            const usuarios = usuariosPorTurno[turno];

            // Calcular estadísticas para este turno
            const usuariosConPreguntas = usuarios.filter(u => u.tiene_preguntas_asignadas).length;
            const usuariosSinPreguntas = usuarios.length - usuariosConPreguntas;

            return {
                turno: turno === 'sinTurno' ? 'Sin turno asignado' : turno.toUpperCase(),
                usuarios: usuarios,
                total: usuarios.length,
                con_preguntas: usuariosConPreguntas,
                sin_preguntas: usuariosSinPreguntas
            };
        });

        // Obtener las estadísticas generales
        const totalUsuarios = todosUsuarios.rowCount;
        const usuariosConPreguntas = todosUsuarios.rows.filter(u => u.tiene_preguntas_asignadas).length;
        const usuariosSinPreguntas = totalUsuarios - usuariosConPreguntas;

        // Verificar si hay resultados
        if (todosUsuarios.rowCount > 0) {
            return res.status(200).json({
                icon: "success",
                statusCode: 200,
                message: `Personal asignado por usted (${nombreRolActual})`,
                path: "/roles/usuarios-asignados",
                turnos: resultadoPorTurno,
                total: totalUsuarios,
                estadisticas: {
                    total_usuarios: totalUsuarios,
                    con_preguntas: usuariosConPreguntas,
                    sin_preguntas: usuariosSinPreguntas,
                    porcentaje_con_asignacion: Math.round((usuariosConPreguntas / totalUsuarios) * 100) || 0
                }
            });
        } else {
            return res.status(200).json({
                icon: "info",
                statusCode: 200,
                message: "No ha asignado personal aún",
                path: "/roles/usuarios-asignados",
                turnos: resultadoPorTurno,
                total: 0,
                estadisticas: {
                    total_usuarios: 0,
                    con_preguntas: 0,
                    sin_preguntas: 0,
                    porcentaje_con_asignacion: 0
                }
            });
        }
    } catch (error) {
        console.error("Error en el método obtenerTodosUsuariosAsignados:", error);
        return res.status(error.sql ? 400 : 500).json({
            statusCode: error.sql ? 400 : 500,
            message: error.message || 'Error al obtener usuarios asignados',
            path: "/roles/usuarios-asignados"
        });
    }
};

// Obtener usuarios que YA tienen preguntas asignadas
const obtenerUsuariosConAsignaciones = async (req, res) => {
    try {
        // Extraer el ID del usuario actual y su rol actual
        const usuarioActualId = req.usuario.id_usuario;
        const rolActual = req.rolActual;

        // Mapeo de roles del sistema a nombres más descriptivos
        const rolSistemaANombre = {
            'GSP': 'ESPECIALISTA',
            'JTMT': 'JEFE DE TURNO',
            'SUP': 'SUPERVISOR',
            'COD': 'CODIFICADOR'
        };

        // Obtener el nombre descriptivo del rol actual
        const nombreRolActual = rolSistemaANombre[rolActual] || rolActual;

        // Jerarquía de roles y qué roles puede ver cada tipo de usuario
        const jerarquia = {
            'GSP': ['JTMT'],
            'JTMT': ['SUP'],
            'SUP': ['COD'],
            'COD': []
        };

        // Verificar si el rol del usuario es válido
        if (!jerarquia[rolActual]) {
            return res.status(403).json({
                icon: "error",
                statusCode: 403,
                message: "Rol no autorizado",
                path: "/roles/usuarios-con-asignaciones"
            });
        }

        // Si el usuario no puede ver a nadie, retornar lista vacía
        if (jerarquia[rolActual].length === 0) {
            return res.status(200).json({
                usuarios: [],
                icon: "info",
                statusCode: 200,
                message: "No tiene permisos para ver usuarios",
                path: "/roles/usuarios-con-asignaciones"
            });
        }

        // Obtener los roles que este usuario puede ver
        const rolesVisibles = jerarquia[rolActual];

        // Método para obtener usuarios asignados por el usuario actual y que TIENEN preguntas asignadas
        const obtenerUsuariosConAsignaciones = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT 
                        u.aut_id_usuario,
                        u.aut_us_usuario,
                        u.aut_us_nombres,
                        u.aut_us_paterno,
                        u.aut_us_materno,
                        u.aut_us_ci,
                        u.per_correo_electronico,
                        u.aut_us_rol,
                        u.rol,
                        u.aut_us_estado,
                        a.id AS id_asignacion,
                        a.fecha_asignacion,
                        a.turno,
                        r.sistema AS codigo_rol,
                        r.rol AS nombre_rol,
                        TRUE AS tiene_preguntas_asignadas,
                        COUNT(ap.pregunta_id) AS cantidad_preguntas_asignadas,
                        SUM(ap.cantidad_asignada) AS total_codificaciones_asignadas
                    FROM asignacion.asignaciones a
                    JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                    JOIN asignacion.asignacion_preguntas ap ON u.aut_id_usuario = ap.codificador_id AND ap.esta_asignada = TRUE
                    WHERE a.asignado_por = $1
                    AND a.activo = TRUE
                    AND r.sistema IN (${rolesVisibles.map(rol => `'${rol}'`).join(',')})
                    GROUP BY 
                        u.aut_id_usuario,
                        u.aut_us_usuario,
                        u.aut_us_nombres,
                        u.aut_us_paterno,
                        u.aut_us_materno,
                        u.aut_us_ci,
                        u.per_correo_electronico,
                        u.aut_us_rol,
                        u.rol,
                        u.aut_us_estado,
                        a.id,
                        a.fecha_asignacion,
                        a.turno,
                        r.sistema,
                        r.rol
                    ORDER BY a.fecha_asignacion DESC, u.aut_us_usuario`,
                    [usuarioActualId],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        // Obtener los usuarios con asignaciones
        const usuariosConAsignaciones = await obtenerUsuariosConAsignaciones();

        // Organizar los resultados por turno
        const usuariosPorTurno = {
            mañana: usuariosConAsignaciones.rows.filter(u => u.turno === 'MAÑANA'),
            tarde: usuariosConAsignaciones.rows.filter(u => u.turno === 'TARDE'),
            sinTurno: usuariosConAsignaciones.rows.filter(u => u.turno === 'N/A')
        };

        // Crear un objeto con información adicional para cada turno
        const resultadoPorTurno = Object.keys(usuariosPorTurno).map(turno => {
            const usuarios = usuariosPorTurno[turno];
            return {
                turno: turno === 'sinTurno' ? 'Sin turno asignado' : turno.toUpperCase(),
                usuarios: usuarios,
                total: usuarios.length
            };
        });

        // Verificar si hay resultados
        if (usuariosConAsignaciones.rowCount > 0) {
            return res.status(200).json({
                icon: "success",
                statusCode: 200,
                message: `Codificadores con preguntas asignadas (${nombreRolActual})`,
                path: "/roles/usuarios-con-asignaciones",
                turnos: resultadoPorTurno,
                total: usuariosConAsignaciones.rowCount
            });
        } else {
            return res.status(200).json({
                icon: "info",
                statusCode: 200,
                message: "No hay codificadores con preguntas asignadas",
                path: "/roles/usuarios-con-asignaciones",
                turnos: resultadoPorTurno,
                total: 0
            });
        }
    } catch (error) {
        console.error("Error en el método obtenerUsuariosConAsignaciones:", error);
        return res.status(error.sql ? 400 : 500).json({
            statusCode: error.sql ? 400 : 500,
            message: error.message || 'Error al obtener usuarios con asignaciones',
            path: "/roles/usuarios-con-asignaciones"
        });
    }
};

module.exports = {
    asignarRoles,
    obtenerHistorialRoles,
    desactivarAsignacionRol,
    reasignarRol,
    obtenerUsuariosPorJerarquia,
    obtenerRolesPorJerarquia,
    obtenerUsuariosAsignadosPorMi,
    obtenerUsuariosDisponibles,
    obtenerTodosUsuariosAsignados,
    obtenerUsuariosConAsignaciones
};