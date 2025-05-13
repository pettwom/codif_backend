const {con} = require("../config/db");

class GestorAsignaciones {

    // Establece la jerarquia de roles
    static JERARQUIA_ROLES = {
        'GSP': ['JTMT'],
        'JTMT': ['SUP'],
        'SUP': ['COD']
    };

    // Verifica que 1 usuario pueda asignar a otro segun jerarquía
    async validarJerarquiaAsignacion(asignadorId, rolAsignador, rolAAsignar) {
        try {
            // 1ro Verificar que el rol sea asignable segun jerarquía
            const rolesPermitidos = GestorAsignaciones.JERARQUIA_ROLES[rolAsignador] || [];
            if (!rolesPermitidos.includes(rolAAsignar)) {
                return {
                    valido: false,
                    mensaje: `El rol ${rolAsignador} no puede asignar el rol ${rolAAsignar}`
                };
            }

            // 2do Verificar que el asignador tenga una asignacion activa para su rol
            const tieneAsignacionActiva = await this.verificarAsignacionActiva(asignadorId, rolAsignador);
            if (!tieneAsignacionActiva) {
                return {
                    valido: false,
                    mensaje: `El usuario no tiene una asignación activa como ${rolAsignador}`
                };
            }

            // 3. Verificar la cadena completa de asignaciones
            const cadenaValida = await this.validarCadenaAsignaciones(asignadorId, rolAsignador);
            if (!cadenaValida.valido) {
                return cadenaValida;
            }

            return {valido: true};
        } catch (error) {
            console.error("Error al validar jerarquia:", error);
            return {
                valido: false,
                mensaje: "Error al validar la jerarquía de asignación"
            };
        }
    }

    // Verifica si un usuario tiene una asignacion activa para un rol especifico
    async verificarAsignacionActiva(usuarioId, rol) {
        return new Promise((resolve, reject) => {
            con.query(
                `SELECT a.id 
                 FROM asignacion.asignaciones a
                 JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                 WHERE a.usuario_id = $1 AND r.sistema = $2 AND a.activo = TRUE`,
                [usuarioId, rol],
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result.rowCount > 0);
                    }
                }
            );
        });
    }

    // Valida toda la cadena de asignaciones recursivamente
    async validarCadenaAsignaciones(usuarioId, rol) {
        // Para GSP no se verifica superior (es el mas alto en jerarquia)
        // Ademas ya esta definido
        if (rol === 'GSP') {
            return {valido: true};
        }

        // Obtener quien asigno a este usuario en su rol actual
        const asignadorInfo = await this.obtenerAsignador(usuarioId, rol);

        if (!asignadorInfo) {
            return {
                valido: false,
                mensaje: `No se encontró quién asignó el rol ${rol} al usuario`
            };
        }

        // Determinar que rol deberia tener el asignador segun la jerarquia
        const rolSuperior = this.obtenerRolSuperior(rol);

        if (asignadorInfo.sistema !== rolSuperior) {
            return {
                valido: false,
                mensaje: `El rol ${rol} debe ser asignado por un ${rolSuperior}, no por un ${asignadorInfo.sistema}`
            };
        }

        // Verificar recursivamente la cadena de asignaciones para el asignador
        return this.validarCadenaAsignaciones(asignadorInfo.asignador_id, rolSuperior);
    }

    // Obtiene el rol superior que debería asignar al rol actual
    obtenerRolSuperior(rol) {
        const jerarquiaInversa = {
            'JTMT': 'GSP',
            'SUP': 'JTMT',
            'COD': 'SUP'
        };
        return jerarquiaInversa[rol] || null;
    }

    // Obtiene informacion sobre quien asigno a un usuario en un rol especifico
    async obtenerAsignador(usuarioId, rol) {
        return new Promise((resolve, reject) => {
            con.query(
                `SELECT a.asignado_por as asignador_id, r_asignador.sistema 
                 FROM asignacion.asignaciones a
                 JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                 JOIN asignacion.asignaciones a_asignador ON a.asignado_por = a_asignador.usuario_id
                 JOIN autenticacion.rol r_asignador ON a_asignador.rol_id = r_asignador.id_rol
                 WHERE a.usuario_id = $1 AND r.sistema = $2 AND a.activo = TRUE
                     AND a_asignador.activo = TRUE
                 LIMIT 1`,
                [usuarioId, rol],
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result.rowCount > 0 ? result.rows[0] : null);
                    }
                }
            );
        });
    }

    // Crea una nueva asignacion despuus de validar la jerarquia
    async crearAsignacion(asignadorId, rolAsignador, usuarioId, rolAAsignarId, turno) {
        const client = await con.connect();

        try {
            await client.query('BEGIN');

            // Obtener el codigo del rol a asignar
            const rolAAsignarResult = await client.query(
                "SELECT sistema FROM autenticacion.rol WHERE id_rol = $1",
                [rolAAsignarId]
            );

            if (rolAAsignarResult.rowCount === 0) {
                throw new Error("Rol no encontrado");
            }

            const rolAAsignar = rolAAsignarResult.rows[0].sistema;

            // Validar la jerarquia
            const validacion = await this.validarJerarquiaAsignacion(
                asignadorId,
                rolAsignador,
                rolAAsignar
            );

            if (!validacion.valido) {
                throw new Error(validacion.mensaje);
            }

            // Verificar si ya existe una asignacion inactiva
            const asignacionInactiva = await client.query(
                `SELECT id FROM asignacion.asignaciones 
                 WHERE usuario_id = $1 AND rol_id = $2 AND activo = FALSE
                 ORDER BY fecha_asignacion DESC LIMIT 1`,
                [usuarioId, rolAAsignarId]
            );

            let idAsignacion;
            let esReactivacion = false;

            if (asignacionInactiva.rowCount > 0) {
                // Reactivar asignacion existente
                const reactivacion = await client.query(
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
                        asignadorId,
                        asignacionInactiva.rows[0].id,
                        `REACTIVACION_POR_${rolAsignador}`
                    ]
                );

                idAsignacion = reactivacion.rows[0].id;
                esReactivacion = true;
            } else {
                // Crear nueva asignacion
                const nuevaAsignacion = await client.query(
                    `INSERT INTO asignacion.asignaciones
                     (usuario_id, rol_id, asignado_por, turno, motivo_cambio)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id`,
                    [
                        usuarioId,
                        rolAAsignarId,
                        asignadorId,
                        turno,
                        `ASIGNACION_POR_${rolAsignador}`
                    ]
                );

                idAsignacion = nuevaAsignacion.rows[0].id;
            }

            await client.query('COMMIT');

            return {
                exitoso: true,
                id: idAsignacion,
                tipo: esReactivacion ? "REACTIVACION" : "NUEVA_ASIGNACION"
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error en el metodo crearAsignacion:", error);

            return {
                exitoso: false,
                mensaje: error.message || 'Error al crear asignación'
            };
        } finally {
            client.release();
        }
    }

    // Verifica si es seguro desactivar una asignacion (no tiene que tener dependientes)
    async verificarDependientes(asignacionId) {
        return new Promise((resolve, reject) => {
            con.query(
                `WITH info_asignacion AS (
                    SELECT a.usuario_id, r.sistema 
                    FROM asignacion.asignaciones a
                    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                    WHERE a.id = $1
                )
                SELECT COUNT(*) as dependientes
                FROM asignacion.asignaciones a
                JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                JOIN info_asignacion i ON a.asignado_por = i.usuario_id
                WHERE a.activo = TRUE
                AND (
                    (i.sistema = 'GSP' AND r.sistema = 'JTMT') OR
                    (i.sistema = 'JTMT' AND r.sistema = 'SUP') OR
                    (i.sistema = 'SUP' AND r.sistema = 'COD')
                )`,
                [asignacionId],
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        const tieneDependientes = parseInt(result.rows[0].dependientes) > 0;
                        resolve(!tieneDependientes); // Es seguro si NO tiene dependientes
                    }
                }
            );
        });
    }

    // Desactiva una asignacion verificando que sea seguro hacerlo
    async desactivarAsignacion(asignacionId, desactivadorId, rolDesactivador, motivo) {
        const client = await con.connect();

        try {
            await client.query('BEGIN');

            // Obtener informacion de la asignacion
            const asignacionInfo = await client.query(
                `SELECT a.*, r.sistema as codigo_rol
                 FROM asignacion.asignaciones a
                 JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                 WHERE a.id = $1 AND a.activo = TRUE`,
                [asignacionId]
            );

            if (asignacionInfo.rowCount === 0) {
                throw new Error("Asignacion no encontrada o ya desactivada");
            }

            const asignacion = asignacionInfo.rows[0];

            // Verificar permisos para desactivar
            const rolesPermitidos = GestorAsignaciones.JERARQUIA_ROLES[rolDesactivador] || [];
            if (!rolesPermitidos.includes(asignacion.codigo_rol)) {
                throw new Error(`No tiene permiso para desactivar el rol ${asignacion.codigo_rol}`);
            }

            // Verificar si tiene dependientes
            const esSeguoDesactivar = await this.verificarDependientes(asignacionId);
            if (!esSeguoDesactivar) {
                throw new Error("No se puede desactivar esta asignacion porque tiene roles dependientes. Desactive primero esos roles.");
            }

            // Desactivar la asignación
            const motivoFinal = motivo || `DESACTIVACION_POR_${rolDesactivador}`;

            await client.query(
                `UPDATE asignacion.asignaciones
                 SET activo = FALSE, motivo_cambio = $2
                 WHERE id = $1`,
                [asignacionId, motivoFinal]
            );

            await client.query('COMMIT');

            return {
                exitoso: true,
                mensaje: "Asignación desactivada correctamente"
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Error en desactivarAsignacion:", error);

            return {
                exitoso: false,
                mensaje: error.message || 'Error al desactivar asignación'
            };
        } finally {
            client.release();
        }
    }

    // Obtiene todas las asignaciones activas en forma de arbol jerarquico
    async obtenerArbolAsignaciones() {
        return new Promise((resolve, reject) => {
            con.query(
                `WITH RECURSIVE jerarquia AS (
                    -- Base case: GSP (nivel superior)
                    SELECT 
                        a.id, 
                        a.usuario_id, 
                        u.aut_us_usuario AS nombre_usuario,
                        a.rol_id, 
                        r.rol AS nombre_rol,
                        r.sistema AS codigo_rol,
                        a.asignado_por,
                        NULL::INTEGER AS asignador_id,
                        NULL::VARCHAR AS asignador_nombre,
                        NULL::VARCHAR AS asignador_rol,
                        1 AS nivel
                    FROM asignacion.asignaciones a
                    JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                    WHERE r.sistema = 'GSP' AND a.activo = TRUE
                    
                    UNION ALL
                    
                    -- Casos recursivos: JTMT, SUP, COD
                    SELECT 
                        a.id, 
                        a.usuario_id, 
                        u.aut_us_usuario AS nombre_usuario,
                        a.rol_id, 
                        r.rol AS nombre_rol,
                        r.sistema AS codigo_rol,
                        a.asignado_por,
                        j.usuario_id AS asignador_id,
                        j.nombre_usuario AS asignador_nombre,
                        j.codigo_rol AS asignador_rol,
                        j.nivel + 1 AS nivel
                    FROM asignacion.asignaciones a
                    JOIN monitoreo.vw_usuarios u ON a.usuario_id = u.aut_id_usuario
                    JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                    JOIN jerarquia j ON a.asignado_por = j.usuario_id
                    WHERE a.activo = TRUE
                )
                SELECT * FROM jerarquia
                ORDER BY nivel, codigo_rol, nombre_usuario`,
                [],
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        // Convertir el resultado plano a estructura de arbol
                        const nodos = {};
                        const arbol = [];

                        // Primero, crear todos los nodos
                        result.rows.forEach(row => {
                            nodos[row.id] = {
                                id: row.id,
                                usuario_id: row.usuario_id,
                                nombre_usuario: row.nombre_usuario,
                                rol: row.codigo_rol,
                                nombre_rol: row.nombre_rol,
                                nivel: row.nivel,
                                asignador: {
                                    id: row.asignador_id,
                                    nombre: row.asignador_nombre,
                                    rol: row.asignador_rol
                                },
                                subordinados: []
                            };
                        });

                        // Luego, construir la jerarquia
                        result.rows.forEach(row => {
                            if (!row.asignador_id) {
                                // Es un nodo raíz (GSP)
                                arbol.push(nodos[row.id]);
                            } else {
                                // Buscar el asignador en los nodos
                                const asignadores = result.rows
                                    .filter(r => r.usuario_id === row.asignador_id)
                                    .map(r => nodos[r.id]);

                                if (asignadores.length > 0) {
                                    // Agregar este nodo como subordinado de su asignador
                                    asignadores[0].subordinados.push(nodos[row.id]);
                                }
                            }
                        });

                        resolve(arbol);
                    }
                }
            );
        });
    }
}

module.exports = GestorAsignaciones;