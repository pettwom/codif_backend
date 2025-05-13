const {con} = require("../../config/db");
const jwt = require("jsonwebtoken");
const { config } = require("../../common");
const GestorAsignaciones = require('../../services/gestorAsignaciones');

// Configuración de roles y permisos
const ROLES_CONFIG = {
    'GSP': ['JTMT'],
    'JTMT': ['SUP'],
    'SUP': ['COD']
};

const verificarRolOld = (rolRequerido) => {
    return async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(" ")[1];
            if (!token) {
                return res.status(401).json({
                    statusCode: 401,
                    message: "No autorizado: Token no proporcionado",
                    path: req.path
                });
            }

            const decoded = jwt.verify(token, config.auth.secret);

            const verificarRolUsuario = () => {
                return new Promise((resolve, reject) => {
                    con.query(
                        `SELECT a.id 
                         FROM asignacion.asignaciones a
                         JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                         WHERE a.usuario_id = $1 AND r.sistema = $2 AND a.activo = TRUE`,
                        [decoded.usuario.id_usuario, rolRequerido],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        }
                    );
                });
            };

            const tieneRol = await verificarRolUsuario();

            if (tieneRol.rowCount === 0) {
                return res.status(403).json({
                    statusCode: 403,
                    message: `Acceso denegado: Se requieren permisos de ${rolRequerido}`,
                    path: req.path
                });
            }

            req.usuario = decoded.usuario;
            req.rolActual = rolRequerido;
            next();
        } catch (error) {
            console.error(`Error en verificarRol(${rolRequerido}):`, error);
            return res.status(401).json({
                statusCode: 401,
                message: "Token inválido o expirado",
                path: req.path
            });
        }
    };
};

// Version modificada del middleware anterior es decir verificarRol
const verificarRolJerarquico = (rolesPermitidos) => {
    return async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(" ")[1];
            if (!token) {
                return res.status(401).json({
                    statusCode: 401,
                    message: "No autorizado: Token no proporcionado",
                    path: req.path
                });
            }

            const decoded = jwt.verify(token, config.auth.secret);

            // Verificar si el usuario tiene alguno de los roles permitidos
            const verificarRolesUsuario = () => {
                const listaRoles = rolesPermitidos.map(rol => `'${rol}'`).join(', ');
                return new Promise((resolve, reject) => {
                    con.query(
                        `SELECT a.id, r.sistema as rol_sistema
                         FROM asignacion.asignaciones a
                         JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                         WHERE a.usuario_id = $1 AND r.sistema IN (${listaRoles}) AND a.activo = TRUE`,
                        [decoded.usuario.id_usuario],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        }
                    );
                });
            };

            const tieneRoles = await verificarRolesUsuario();

            if (tieneRoles.rowCount === 0) {
                return res.status(403).json({
                    statusCode: 403,
                    message: `Acceso denegado: Se requieren permisos de ${rolesPermitidos.join(' o ')}`,
                    path: req.path
                });
            }

            // Asignar el rol mas alto que tiene el usuario (en orden de jerarquia ya definida)
            const jerarquiaRoles = ['GSP', 'JTMT', 'SUP', 'COD']; // Orden jerarquico
            let rolMasAlto = null;
            let indiceRolMasAlto = Number.MAX_SAFE_INTEGER;

            tieneRoles.rows.forEach(row => {
                const indice = jerarquiaRoles.indexOf(row.rol_sistema);
                if (indice !== -1 && indice < indiceRolMasAlto) {
                    indiceRolMasAlto = indice;
                    rolMasAlto = row.rol_sistema;
                }
            });

            req.usuario = decoded.usuario;
            req.rolActual = rolMasAlto;
            next();
        } catch (error) {
            console.error(`Error en verificarRolJerarquico:`, error);
            return res.status(401).json({
                statusCode: 401,
                message: "Token inválido o expirado",
                path: req.path
            });
        }
    };
};

const asignarRolOld = async (req, res) => {
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        const { usuario_id, rol_id, turno = 'N/A' } = req.body;
        const rolActual = req.rolActual; // Rol del usuario que esta haciendo la asignacion

        if (!usuario_id || !rol_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de usuario y ID de rol",
                path: `/roles/asignar`
            });
        }

        if (!['MAÑANA', 'TARDE', 'N/A'].includes(turno)) {
            return res.status(400).json({
                statusCode: 400,
                message: "El turno debe ser 'MAÑANA', 'TARDE' o 'N/A'",
                path: `/roles/asignar`
            });
        }

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
                path: `/roles/asignar`
            });
        }

        // Verifica que el rol a asignar este permitido para este usuario
        const verificarRol = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT id_rol, rol, sistema FROM autenticacion.rol WHERE id_rol = $1`,
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
                message: "Rol no encontrado o no permitido para asignación",
                path: `/roles/asignar`
            });
        }

        const rolAAsignar = rolExiste.rows[0].sistema;

        // Verificamos si el usuario tiene permiso para asignar este rol
        const rolesPermitidos = ROLES_CONFIG[rolActual] || [];

        if (!rolesPermitidos.includes(rolAAsignar)) {
            return res.status(403).json({
                statusCode: 403,
                message: `No tiene permiso para asignar el rol ${rolAAsignar}`,
                path: `/roles/asignar`
            });
        }

        // // Validaciones específicas por tipo de rol
        // if (rolAAsignar === 'JTM' && turno !== 'MAÑANA') {
        //     return res.status(400).json({
        //         statusCode: 400,
        //         message: "El rol JTM (Jefatura Turno Mañana) debe asignarse con turno 'MAÑANA'",
        //         path: `/roles/asignar`
        //     });
        // } else if (rolAAsignar === 'JTT' && turno !== 'TARDE') {
        //     return res.status(400).json({
        //         statusCode: 400,
        //         message: "El rol JTT (Jefatura Turno Tarde) debe asignarse con turno 'TARDE'",
        //         path: `/roles/asignar`
        //     });
        // }

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
                path: `/roles/asignar`
            });
        }

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
            const reactivarAsignacion = () => {
                return new Promise((resolve, reject) => {
                    client.query(
                        `UPDATE asignacion.asignaciones
                         SET activo = TRUE, 
                             turno = $1, 
                             asignado_por = $2, 
                             fecha_asignacion = CURRENT_TIMESTAMP,
                             motivo_cambio = $4
                         WHERE id = $3
                         RETURNING id`,
                        [
                            turno,
                            req.usuario.id_usuario,
                            asignacionInactiva.rows[0].id,
                            `REACTIVACION_POR_${rolActual}`
                        ],
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
                            `ASIGNACION_POR_${rolActual}`
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

        await client.query('COMMIT');

        let mensaje = esReactivacion
            ? `Rol de ${rolAAsignar} reactivado correctamente`
            : `Rol de ${rolAAsignar} asignado correctamente`;

        return res.status(200).json({
            statusCode: 200,
            message: mensaje,
            path: `/roles/asignar`,
            icon: "success",
            asignacion: {
                id: idAsignacion,
                usuario_id,
                nombre_usuario: usuarioExiste.rows[0].nombre,
                rol_id,
                nombre_rol: rolAAsignar,
                turno,
                tipo: esReactivacion ? "REACTIVACION" : "NUEVA_ASIGNACION"
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error en asignarRol:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al asignar rol',
            path: `/roles/asignar`
        });
    } finally {
        client.release();
    }
};

const asignarRol = async (req, res) => {
    try {
        const { usuario_id, rol_id, turno = 'N/A' } = req.body;
        const rolActual = req.rolActual; // Rol del usuario que esta haciendo la asignacion

        if (!usuario_id || !rol_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de usuario y ID de rol",
                path: `/roles/asignar`
            });
        }

        if (!['MAÑANA', 'TARDE', 'N/A'].includes(turno)) {
            return res.status(400).json({
                statusCode: 400,
                message: "El turno debe ser 'MAÑANA', 'TARDE' o 'N/A'",
                path: `/roles/asignar`
            });
        }

        // Usar el gestor de asignaciones para validar y crear la asignacion
        const gestorAsignaciones = new GestorAsignaciones();
        const resultado = await gestorAsignaciones.crearAsignacion(
            req.usuario.id_usuario,
            rolActual,
            usuario_id,
            rol_id,
            turno
        );

        if (!resultado.exitoso) {
            return res.status(400).json({
                statusCode: 400,
                message: resultado.mensaje,
                path: `/roles/asignar`
            });
        }

        // Obtener informacion del usuario y rol para la respuesta
        const usuarioInfo = await con.query(
            "SELECT aut_us_usuario FROM monitoreo.vw_usuarios WHERE aut_id_usuario = $1",
            [usuario_id]
        );

        const rolInfo = await con.query(
            "SELECT sistema FROM autenticacion.rol WHERE id_rol = $1",
            [rol_id]
        );

        let mensaje = resultado.tipo === "REACTIVACION"
            ? `Rol de ${rolInfo.rows[0].sistema} reactivado correctamente`
            : `Rol de ${rolInfo.rows[0].sistema} asignado correctamente`;

        return res.status(200).json({
            statusCode: 200,
            message: mensaje,
            path: `/roles/asignar`,
            icon: "success",
            asignacion: {
                id: resultado.id,
                usuario_id,
                nombre_usuario: usuarioInfo.rows[0].aut_us_usuario,
                rol_id,
                nombre_rol: rolInfo.rows[0].sistema,
                turno,
                tipo: resultado.tipo
            }
        });

    } catch (error) {
        console.error("Error en asignarRol:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al asignar rol',
            path: `/roles/asignar`
        });
    }
};

const desactivarRolOld = async (req, res) => {
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        const { asignacion_id, motivo_cambio } = req.body;
        const rolActual = req.rolActual;

        if (!asignacion_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de asignación",
                path: `/roles/desactivar`
            });
        }

        const verificarAsignacion = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `SELECT a.*, u.aut_us_usuario AS nombre_usuario, r.rol AS nombre_rol, r.sistema AS codigo_rol
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
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
                path: `/roles/desactivar`
            });
        }

        const asignacion = asignacionExiste.rows[0];

        const rolesPermitidos = ROLES_CONFIG[rolActual] || [];
        if (!rolesPermitidos.includes(asignacion.codigo_rol)) {
            return res.status(403).json({
                statusCode: 403,
                message: `No tiene permiso para desactivar el rol ${asignacion.codigo_rol}`,
                path: `/roles/desactivar`
            });
        }

        const motivoFinal = motivo_cambio || `DESACTIVACION_POR_${rolActual}`;

        const desactivarAsignacion = () => {
            return new Promise((resolve, reject) => {
                client.query(
                    `UPDATE asignacion.asignaciones
                     SET activo = FALSE, motivo_cambio = $2
                     WHERE id = $1`,
                    [asignacion_id, motivoFinal],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        await desactivarAsignacion();

        await client.query('COMMIT');

        return res.status(200).json({
            statusCode: 200,
            message: `Rol desactivado correctamente para ${asignacion.nombre_usuario}`,
            path: `/roles/desactivar`,
            icon: "success",
            asignacion: {
                id: asignacion.id,
                usuario_id: asignacion.usuario_id,
                nombre_usuario: asignacion.nombre_usuario,
                rol_id: asignacion.rol_id,
                nombre_rol: asignacion.nombre_rol,
                motivo_cambio: motivoFinal
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error en desactivarRol:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al desactivar rol',
            path: `/roles/desactivar`
        });
    } finally {
        client.release();
    }
};

const desactivarRol = async (req, res) => {
    try {
        const { asignacion_id, motivo_cambio } = req.body;
        const rolActual = req.rolActual;

        if (!asignacion_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere ID de asignación",
                path: `/roles/desactivar`
            });
        }

        // Obtener informacion de la asignacion antes de desactivarla
        const verificarAsignacion = () => {
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT a.*, u.aut_us_usuario AS nombre_usuario, r.rol AS nombre_rol, r.sistema AS codigo_rol
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
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
                path: `/roles/desactivar`
            });
        }

        const asignacion = asignacionExiste.rows[0];

        // Usar el gestor de asignaciones para validar y desactivar
        const gestorAsignaciones = new GestorAsignaciones();
        const resultado = await gestorAsignaciones.desactivarAsignacion(
            asignacion_id,
            req.usuario.id_usuario,
            rolActual,
            motivo_cambio
        );

        if (!resultado.exitoso) {
            return res.status(400).json({
                statusCode: 400,
                message: resultado.mensaje,
                path: `/roles/desactivar`
            });
        }

        return res.status(200).json({
            statusCode: 200,
            message: `Rol desactivado correctamente para ${asignacion.nombre_usuario}`,
            path: `/roles/desactivar`,
            icon: "success",
            asignacion: {
                id: asignacion.id,
                usuario_id: asignacion.usuario_id,
                nombre_usuario: asignacion.nombre_usuario,
                rol_id: asignacion.rol_id,
                nombre_rol: asignacion.nombre_rol,
                motivo_cambio: motivo_cambio || `DESACTIVACION_POR_${rolActual}`
            }
        });

    } catch (error) {
        console.error("Error en desactivarRol:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al desactivar rol',
            path: `/roles/desactivar`
        });
    }
};

const obtenerAsignacionesPorTipoOld = async (req, res) => {
    try {
        const rolActual = req.rolActual;
        const rolesPermitidos = ROLES_CONFIG[rolActual] || [];

        // Si no hay roles para este usuario, devolvemos un array vacío
        if (rolesPermitidos.length === 0) {
            return res.status(200).json({
                statusCode: 200,
                message: "No hay roles asignables para este usuario",
                path: `/roles/asignaciones`,
                icon: "info",
                asignaciones: {
                    mañana: [],
                    tarde: [],
                    na: [],
                    total: 0
                }
            });
        }

        // Consulta para obtener las asignaciones activas de los roles que este usuario puede gestionar
        const obtenerAsignaciones = () => {
            const rolesList = rolesPermitidos.map(rol => `'${rol}'`).join(', ');
            const {id_usuario} = req.usuario;
            console.log("rolesList", req.usuario);
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT a.id, a.usuario_id, u.aut_us_usuario AS nombre_usuario, 
                            a.rol_id, r.rol AS nombre_rol, a.turno, r.sistema AS codigo_rol,
                            a.fecha_asignacion, v.aut_us_usuario AS asignado_por_nombre
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     LEFT JOIN monitoreo.vw_usuarios v ON a.asignado_por = v.aut_id_usuario
                     WHERE a.activo = TRUE AND r.sistema IN (${rolesList}) AND a.asignado_por = $1 
                     ORDER BY r.rol, a.fecha_asignacion DESC`,
                    [id_usuario],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
        };

        const asignaciones = await obtenerAsignaciones();

        // Organizamos los resultados por turno
        const asignacionesMañana = asignaciones.rows.filter(a => a.turno === 'MAÑANA');
        const asignacionesTarde = asignaciones.rows.filter(a => a.turno === 'TARDE');
        const asignacionesNA = asignaciones.rows.filter(a => a.turno === 'N/A');

        // Agrupa por rol si hay varios roles permitidos
        // const agrupadoPorRol = {};
        // for (const rol of rolesPermitidos) {
        //     agrupadoPorRol[rol] = asignaciones.rows.filter(a => a.codigo_rol === rol);
        // }

        return res.status(200).json({
            statusCode: 200,
            message: "Asignaciones obtenidas correctamente",
            path: `/roles/asignaciones`,
            icon: "success",
            asignaciones: {
                mañana: asignacionesMañana,
                tarde: asignacionesTarde,
                sinTurno: asignacionesNA,
                total: asignaciones.rowCount,
                // por_rol: agrupadoPorRol
            }
        });

    } catch (error) {
        console.error("Error en obtenerAsignacionesPorTipo:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener asignaciones',
            path: `/roles/asignaciones`
        });
    }
};

const obtenerAsignacionesPorTipo = async (req, res) => {
    try {
        const rolActual = req.rolActual;
        // Obtener los roles subordinados que este rol puede gestionar
        const rolesPermitidos = GestorAsignaciones.JERARQUIA_ROLES[rolActual] || [];

        // Si no hay roles para este usuario, devolvemos un array vacío
        if (rolesPermitidos.length === 0) {
            return res.status(200).json({
                statusCode: 200,
                message: "No hay roles asignables para este usuario",
                path: `/roles/asignaciones`,
                icon: "info",
                asignaciones: {
                    mañana: [],
                    tarde: [],
                    sinTurno: [],
                    total: 0
                }
            });
        }

        // Consulta para obtener las asignaciones activas de los roles que este usuario puede gestionar
        const obtenerAsignaciones = () => {
            const rolesList = rolesPermitidos.map(rol => `'${rol}'`).join(', ');
            return new Promise((resolve, reject) => {
                con.query(
                    `SELECT a.id, a.usuario_id, u.aut_us_usuario AS nombre_usuario, 
                            a.rol_id, r.rol AS nombre_rol, a.turno, r.sistema AS codigo_rol,
                            a.fecha_asignacion, v.aut_us_usuario AS asignado_por_nombre
                     FROM asignacion.asignaciones a
                     JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     LEFT JOIN monitoreo.vw_usuarios v ON a.asignado_por = v.aut_id_usuario
                     WHERE a.activo = TRUE AND r.sistema IN (${rolesList})
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

        // Organizamos los resultados por turno
        const asignacionesMañana = asignaciones.rows.filter(a => a.turno === 'MAÑANA');
        const asignacionesTarde = asignaciones.rows.filter(a => a.turno === 'TARDE');
        const asignacionesNA = asignaciones.rows.filter(a => a.turno === 'N/A');

        // Titulo dinamico basado en el rol actual
        const titulos = {
            'GSP': 'jefaturas',
            'JTMT': 'supervisores',
            'SUP': 'codificadores'
        };

        return res.status(200).json({
            statusCode: 200,
            message: `Listado de ${titulos[rolActual] || 'asignaciones'} obtenido correctamente`,
            path: `/roles/asignaciones`,
            icon: "success",
            asignaciones: {
                mañana: asignacionesMañana,
                tarde: asignacionesTarde,
                sinTurno: asignacionesNA,
                total: asignaciones.rowCount
            }
        });

    } catch (error) {
        console.error("Error en el metodo obtenerAsignacionesPorTipo:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener asignaciones',
            path: `/roles/asignaciones`
        });
    }
};

const obtenerJerarquiaAsignaciones = async (req, res) => {
    try {
        const gestorAsignaciones = new GestorAsignaciones();
        const arbolAsignaciones = await gestorAsignaciones.obtenerArbolAsignaciones();

        return res.status(200).json({
            statusCode: 200,
            message: "Jerarquía de asignaciones obtenida correctamente",
            path: `/roles/jerarquia`,
            icon: "success",
            jerarquia: arbolAsignaciones
        });
    } catch (error) {
        console.error("Error en obtenerJerarquiaAsignaciones:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener jerarquía de asignaciones',
            path: `/roles/jerarquia`
        });
    }
};

module.exports = {
    verificarRolJerarquico,
    asignarRol,
    desactivarRol,
    obtenerAsignacionesPorTipo,
    obtenerJerarquiaAsignaciones
};