const {con} = require("../config/db");

class GestorCodificaciones {

    // Obtiene todas las codificaciones en estado de codificación asistida
    // agrupadas por cuestionario, sección y pregunta
    async obtenerCodificacionesAsistidasOld(pEstadoNombre) {
        return new Promise((resolve, reject) => {
            con.query(
                `SELECT 
                    cue.cue_id AS id_cuestionario, 
                    cue.cue_titulo AS titulo_cuestionario, 
                    sec.sec_id AS id_seccion, 
                    sec.sec_nombre AS nombre_seccion, 
                    sec.sec_orden AS orden_seccion, 
                    cec.id_pregunta, 
                    ap.pre_numero_pregunta, 
                    ap.pre_pregunta, 
                    COUNT(cec.id_cod_encuesta) AS total_codificaciones 
                FROM codificacion.cod_encuesta_codificacion cec 
                JOIN cuestionarios.apk_preguntas ap ON ap.pre_id = cec.id_pregunta 
                JOIN cuestionarios.apk_secciones sec ON ap.fk_sec_id = sec.sec_id 
                JOIN cuestionarios.apk_cuestionarios cue ON sec.fk_cue_id = cue.cue_id 
                WHERE cec.estado = $1 
                GROUP BY 
                    cue.cue_id, 
                    cue.cue_titulo, 
                    sec.sec_id, 
                    sec.sec_nombre, 
                    sec.sec_orden, 
                    cec.id_pregunta, 
                    ap.pre_numero_pregunta, 
                    ap.pre_pregunta 
                ORDER BY 
                    cue.cue_titulo, 
                    sec.sec_orden, 
                    ap.pre_numero_pregunta`,
                [pEstadoNombre],
                (err, result) => {
                    if (err) {
                        console.error("Error al obtener codificaciones asistidas:", err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }

    // Obtiene todas las codificaciones en estado de codificación asistida con información de asignación
    async obtenerCodificacionesAsistidas(usuarioId = null, esSupervisor = false, nombre_corto) {
        return new Promise((resolve, reject) => {
            // Construir la consulta base
            let query = `
                WITH preguntas_asistidas AS (
                    SELECT 
                        cue.cue_id AS id_cuestionario, 
                        cue.cue_titulo AS titulo_cuestionario, 
                        sec.sec_id AS id_seccion, 
                        sec.sec_nombre AS nombre_seccion, 
                        sec.sec_orden AS orden_seccion,     
                        cec.id_pregunta, 
                        ap.pre_numero_pregunta, 
                        ap.pre_pregunta, 
                        COUNT(cec.id_cod_encuesta) AS total_codificaciones 
                    FROM codificacion.cod_encuesta_codificacion cec 
                    JOIN cuestionarios.apk_preguntas ap ON ap.pre_id = cec.id_pregunta 
                    JOIN cuestionarios.apk_secciones sec ON ap.fk_sec_id = sec.sec_id 
                    JOIN cuestionarios.apk_cuestionarios cue ON sec.fk_cue_id = cue.cue_id 
                    WHERE cec.estado = $2 
                    GROUP BY 
                        cue.cue_id, 
                        cue.cue_titulo, 
                        sec.sec_id, 
                        sec.sec_nombre, 
                        sec.sec_orden, 
                        cec.id_pregunta, 
                        ap.pre_numero_pregunta, 
                        ap.pre_pregunta
                ),
                
                -- Subconsulta para obtener asignaciones de codificadores
                asignaciones_preguntas AS (
                    SELECT 
                        ap.pregunta_id,
                        SUM(ap.cantidad_asignada) AS total_asignadas,
                        SUM(CASE WHEN ap.esta_asignada = TRUE THEN 1 ELSE 0 END) > 0 AS esta_asignada,
                        SUM(CASE WHEN ap.esta_asignada = TRUE THEN ap.cantidad_asignada ELSE 0 END) AS cantidad_asignada_activa,
                        SUM(ap.total_asignaciones) AS total_posibles,
                        -- Información del supervisor que asignó
                        MAX(ap.supervisor_id) AS supervisor_id,
                        MAX(sup.aut_us_usuario) AS nombre_usuario_supervisor,
                        -- Información sobre los codificadores asignados    
                        json_agg(json_build_object(
                            'id', cod.aut_id_usuario,
                            'nombre', cod.aut_us_usuario,
                            'cantidad_asignada', ap.cantidad_asignada,
                            'esta_asignada', ap.esta_asignada
                        )) AS codificadores,
                        string_agg(cod.aut_us_usuario, ', ') AS lista_codificadores
                    FROM asignacion.asignacion_preguntas ap
                    JOIN monitoreo.vw_usuarios cod ON ap.codificador_id = cod.aut_id_usuario
                    JOIN monitoreo.vw_usuarios sup ON ap.supervisor_id = sup.aut_id_usuario
                    GROUP BY ap.pregunta_id
                ),
                
                -- Información de asignaciones específicas para el usuario actual (si es codificador)
                mis_asignaciones AS (
                    SELECT 
                        ap.pregunta_id,
                        ap.cantidad_asignada,
                        ap.esta_asignada
                    FROM asignacion.asignacion_preguntas ap
                    WHERE ap.codificador_id = $1
                    AND ap.esta_asignada = TRUE
                )
                
                -- Consulta principal que une las subconsultas
                SELECT 
                    pa.*,
                    COALESCE(ap.esta_asignada, FALSE) AS esta_asignada,
                    COALESCE(ap.total_asignadas, 0) AS total_asignaciones,
                    COALESCE(ap.cantidad_asignada_activa, 0) AS cantidad_asignada_activa,
                    COALESCE(ap.total_posibles, 0) AS total_posibles,
                    ap.supervisor_id,
                    ap.nombre_usuario_supervisor,
                    ap.codificadores,
                    ap.lista_codificadores,
                    -- Para codificadores, verificar si la pregunta está asignada a ellos
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 
                            FROM asignacion.asignacion_preguntas 
                            WHERE pregunta_id = pa.id_pregunta 
                            AND codificador_id = $1 
                            AND esta_asignada = TRUE
                        ) THEN COALESCE((
                            SELECT cantidad_asignada 
                            FROM asignacion.asignacion_preguntas 
                            WHERE pregunta_id = pa.id_pregunta 
                            AND codificador_id = $1 
                            AND esta_asignada = TRUE
                        ), 0)
                        ELSE 0
                    END AS mi_cantidad_asignada
                FROM preguntas_asistidas pa
                LEFT JOIN asignaciones_preguntas ap ON pa.id_pregunta = ap.pregunta_id
                LEFT JOIN mis_asignaciones ma ON pa.id_pregunta = ma.pregunta_id`;

            // Añadir condición de filtrado solo si no es supervisor
            if (!esSupervisor) {
                // query += ` WHERE ma.pregunta_id IS NOT NULL`;
                query += ` WHERE EXISTS (
                    SELECT 1 
                    FROM asignacion.asignacion_preguntas 
                    WHERE pregunta_id = pa.id_pregunta 
                    AND codificador_id = $1 
                    AND esta_asignada = TRUE
                )`;
            }

            // Añadir ordenamiento
            query += ` ORDER BY 
                pa.titulo_cuestionario, 
                pa.orden_seccion, 
                pa.pre_numero_pregunta`;

            // Parámetros para la consulta - solo necesitamos el ID del usuario
            const params = [usuarioId || 0, nombre_corto];

            con.query(query, params, (err, result) => {
                if (err) {
                    console.error("Error al obtener codificaciones asistidas:", err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    // Método para obtener detalles de una codificación específica
    async obtenerDetalleCodificacion(idPregunta) {
        return new Promise((resolve, reject) => {
            con.query(
                `SELECT 
                    cec.id_cod_encuesta AS id_codificacion,
                    cec.id_pregunta,
                    cec.texto_respuesta,
                    cec.estado,
                    cec.fecha_creacion,
                    cec.fecha_modificacion,
                    u.aut_us_usuario AS nombre_codificador
                FROM codificacion.cod_encuesta_codificacion cec
                LEFT JOIN monitoreo.vw_usuarios u ON cec.id_usuario = u.aut_id_usuario
                WHERE cec.id_pregunta = $1 AND cec.estado = 'CODIFICACION_ASISTIDA'
                ORDER BY cec.fecha_modificacion DESC`,
                [idPregunta],
                (err, result) => {
                    if (err) {
                        console.error("Error al obtener detalle de codificación:", err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }

    // Método para obtener estadísticas de codificación por usuario
    async obtenerEstadisticasCodificaciones() {
        return new Promise((resolve, reject) => {
            con.query(
                `SELECT 
                    u.aut_id_usuario AS id_usuario,
                    u.aut_us_usuario AS nombre_usuario,
                    COUNT(CASE WHEN cec.estado = 'CODIFICACION_ASISTIDA' THEN 1 END) AS pendientes,
                    COUNT(CASE WHEN cec.estado = 'CODIFICADA' THEN 1 END) AS completadas,
                    COUNT(*) AS total
                FROM codificacion.cod_encuesta_codificacion cec
                JOIN monitoreo.vw_usuarios u ON cec.id_usuario = u.aut_id_usuario
                GROUP BY u.aut_id_usuario, u.aut_us_usuario
                ORDER BY pendientes DESC`,
                [],
                (err, result) => {
                    if (err) {
                        console.error("Error al obtener estadísticas de codificación:", err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }

    // Asignar una pregunta a un codificador
    async asignarPreguntaACodificador(seccionId, preguntaId, supervisorId, codificadorId, cantidadAsignar, asignacionId) {
        return new Promise(async (resolve, reject) => {
            const client = await con.connect();

            try {
                await client.query('BEGIN');

                // Verificar que la pregunta exista y esté en estado de codificación asistida
                const verificacionPregunta = await client.query(
                    `SELECT COUNT(*) AS total
                     FROM codificacion.cod_encuesta_codificacion
                     WHERE id_pregunta = $1 AND estado = 'CODIFICACION_ASISTIDA'`,
                    [preguntaId]
                );

                if (parseInt(verificacionPregunta.rows[0].total) === 0) {
                    throw new Error("La pregunta no existe o no está en estado de codificación asistida");
                }

                // Verificar que el supervisor tenga el rol SUP
                const verificacionSupervisor = await client.query(
                    `SELECT COUNT(*) AS total
                     FROM asignacion.asignaciones a
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     WHERE a.usuario_id = $1 AND r.sistema = 'SUP' AND a.activo = TRUE`,
                    [supervisorId]
                );

                if (parseInt(verificacionSupervisor.rows[0].total) === 0) {
                    throw new Error("El usuario no tiene rol de supervisor activo");
                }

                // Verificar que el codificador tenga el rol COD
                const verificacionCodificador = await client.query(
                    `SELECT COUNT(*) AS total
                     FROM asignacion.asignaciones a
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     WHERE a.usuario_id = $1 AND r.sistema = 'COD' AND a.activo = TRUE`,
                    [codificadorId]
                );

                if (parseInt(verificacionCodificador.rows[0].total) === 0) {
                    throw new Error("El usuario no tiene rol de codificador activo");
                }

                // Verificar que la cantidad a asignar sea válida
                if (cantidadAsignar <= 0) {
                    throw new Error("La cantidad a asignar debe ser mayor a cero");
                }

                // Obtener el total disponible para asignar
                const totalDisponible = await client.query(
                    `SELECT COUNT(*) AS total
                     FROM codificacion.cod_encuesta_codificacion
                     WHERE id_pregunta = $1 AND estado = 'CODIFICACION_ASISTIDA'`,
                    [preguntaId]
                );

                const totalCodificaciones = parseInt(totalDisponible.rows[0].total);

                // Verificar si ya existe una asignación para este codificador y esta pregunta
                const verificacionExistente = await client.query(
                    `SELECT id, cantidad_asignada, total_asignaciones
                     FROM asignacion.asignacion_preguntas
                     WHERE pregunta_id = $1 AND codificador_id = $2`,
                    [preguntaId, codificadorId]
                );

                let resultado;

                if (verificacionExistente.rowCount > 0) {
                    // Actualizar la asignación existente
                    const asignacionExistente = verificacionExistente.rows[0];
                    const nuevaCantidad = cantidadAsignar;

                    resultado = await client.query(
                        `UPDATE asignacion.asignacion_preguntas
                         SET cantidad_asignada = $3,
                             supervisor_id = $4,
                             fecha_distribucion_de_carga = CURRENT_TIMESTAMP,
                             esta_asignada = TRUE,
                             fecha_desasignacion = NULL,
                             motivo_desasignacion = NULL
                         WHERE id = $1
                         RETURNING id`,
                        [
                            asignacionExistente.id,
                            preguntaId,
                            nuevaCantidad,
                            supervisorId
                        ]
                    );

                    await client.query('COMMIT');

                    resolve({
                        exitoso: true,
                        mensaje: "Asignación actualizada correctamente",
                        tipo: "ACTUALIZACION",
                        id: resultado.rows[0].id,
                        cantidad_asignada: nuevaCantidad
                    });
                } else {
                    // Crear una nueva asignación
                    resultado = await client.query(
                        `INSERT INTO asignacion.asignacion_preguntas
                         (seccion_id, pregunta_id, total_asignaciones, supervisor_id, codificador_id, 
                          cantidad_asignada, esta_asignada, asignacion_id)
                         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
                         RETURNING id`,
                        [
                            seccionId,
                            preguntaId,
                            totalCodificaciones,
                            supervisorId,
                            codificadorId,
                            cantidadAsignar,
                            asignacionId
                        ]
                    );

                    await client.query('COMMIT');

                    resolve({
                        exitoso: true,
                        mensaje: "Pregunta asignada correctamente",
                        tipo: "NUEVA_ASIGNACION",
                        id: resultado.rows[0].id,
                        cantidad_asignada: cantidadAsignar
                    });
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al asignar pregunta a codificador:", error);

                resolve({
                    exitoso: false,
                    mensaje: error.message || 'Error al asignar pregunta'
                });
            } finally {
                client.release();
            }
        });
    }

    async asignarMultiplesPreguntas(asignaciones, supervisorId) {
        return new Promise(async (resolve, reject) => {
            const client = await con.connect();
            const resultados = [];

            try {
                await client.query('BEGIN');

                // Procesar cada asignación
                for (const asignacion of asignaciones) {
                    const { seccion_id, pregunta_id, codificador_id, cantidad_asignada, asignacion_id = null } = asignacion;

                    // Verificar que la pregunta exista y esté en estado de codificación asistida
                    const verificacionPregunta = await client.query(
                        `SELECT COUNT(*) AS total
                     FROM codificacion.cod_encuesta_codificacion
                     WHERE id_pregunta = $1 AND estado = 'CODIFICACION_ASISTIDA'`,
                        [pregunta_id]
                    );

                    if (parseInt(verificacionPregunta.rows[0].total) === 0) {
                        throw new Error(`La pregunta ${pregunta_id} no existe o no está en estado de codificación asistida`);
                    }

                    // Verificar que el codificador tenga el rol COD
                    const verificacionCodificador = await client.query(
                        `SELECT COUNT(*) AS total
                     FROM asignacion.asignaciones a
                     JOIN autenticacion.rol r ON a.rol_id = r.id_rol
                     WHERE a.usuario_id = $1 AND r.sistema = 'COD' AND a.activo = TRUE`,
                        [codificador_id]
                    );

                    if (parseInt(verificacionCodificador.rows[0].total) === 0) {
                        throw new Error(`El usuario ${codificador_id} no tiene rol de codificador activo`);
                    }

                    // Obtener el total disponible para asignar
                    const totalDisponible = await client.query(
                        `SELECT COUNT(*) AS total
                     FROM codificacion.cod_encuesta_codificacion
                     WHERE id_pregunta = $1 AND estado = 'CODIFICACION_ASISTIDA'`,
                        [pregunta_id]
                    );

                    const totalCodificaciones = parseInt(totalDisponible.rows[0].total);

                    // Verificar si ya existe una asignación para este codificador y esta pregunta
                    const verificacionExistente = await client.query(
                        `SELECT id, cantidad_asignada, total_asignaciones
                     FROM asignacion.asignacion_preguntas
                     WHERE pregunta_id = $1 AND codificador_id = $2`,
                        [pregunta_id, codificador_id]
                    );

                    let resultado;

                    if (verificacionExistente.rowCount > 0) {
                        // Actualizar la asignación existente
                        const asignacionExistente = verificacionExistente.rows[0];
                        const nuevaCantidad = parseInt(cantidad_asignada);

                        resultado = await client.query(
                            `UPDATE asignacion.asignacion_preguntas
                         SET cantidad_asignada = $3,
                             supervisor_id = $4,
                             fecha_distribucion_de_carga = CURRENT_TIMESTAMP,
                             esta_asignada = TRUE,
                             fecha_desasignacion = NULL,
                             motivo_desasignacion = NULL
                         WHERE id = $1
                         RETURNING id`,
                            [
                                asignacionExistente.id,
                                pregunta_id,
                                nuevaCantidad,
                                supervisorId
                            ]
                        );

                        resultados.push({
                            exitoso: true,
                            mensaje: "Asignación actualizada correctamente",
                            tipo: "ACTUALIZACION",
                            id: resultado.rows[0].id,
                            pregunta_id,
                            codificador_id,
                            cantidad_asignada: nuevaCantidad
                        });
                    } else {
                        // Crear una nueva asignación
                        resultado = await client.query(
                            `INSERT INTO asignacion.asignacion_preguntas
                         (seccion_id, pregunta_id, total_asignaciones, supervisor_id, codificador_id, 
                          cantidad_asignada, esta_asignada, asignacion_id)
                         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
                         RETURNING id`,
                            [
                                seccion_id,
                                pregunta_id,
                                totalCodificaciones,
                                supervisorId,
                                codificador_id,
                                parseInt(cantidad_asignada),
                                asignacion_id
                            ]
                        );

                        resultados.push({
                            exitoso: true,
                            mensaje: "Pregunta asignada correctamente",
                            tipo: "NUEVA_ASIGNACION",
                            id: resultado.rows[0].id,
                            pregunta_id,
                            codificador_id,
                            cantidad_asignada: parseInt(cantidad_asignada)
                        });
                    }
                }

                await client.query('COMMIT');

                resolve({
                    exitoso: true,
                    mensaje: `Se han procesado ${asignaciones.length} asignaciones correctamente`,
                    resultados
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error al asignar múltiples preguntas:", error);

                resolve({
                    exitoso: false,
                    mensaje: error.message || 'Error al asignar preguntas'
                });
            } finally {
                client.release();
            }
        });
    }

    // Obtener las preguntas asignadas a un codificador específico
    async obtenerPreguntasAsignadasACodificador(codificadorId) {
        return new Promise((resolve, reject) => {
            con.query(
                `SELECT 
                    ap.id AS id_asignacion,
                    ap.pregunta_id,
                    ap.seccion_id,
                    ap.cantidad_asignada,
                    ap.total_asignaciones,
                    ap.fecha_distribucion_de_carga,
                    u.aut_us_usuario AS supervisor_nombre,
                    p.pre_numero_pregunta,
                    p.pre_pregunta,
                    s.sec_nombre AS nombre_seccion,
                    c.cue_titulo AS titulo_cuestionario,
                    a.id AS rol_asignacion_id,
                    a.turno
                FROM asignacion.asignacion_preguntas ap
                JOIN asignacion.asignaciones a on a.id = ap.asignacion_id
                JOIN monitoreo.vw_usuarios u ON ap.supervisor_id = u.aut_id_usuario
                JOIN cuestionarios.apk_preguntas p ON ap.pregunta_id = p.pre_id
                JOIN cuestionarios.apk_secciones s ON ap.seccion_id = s.sec_id
                JOIN cuestionarios.apk_cuestionarios c ON s.fk_cue_id = c.cue_id
                WHERE ap.codificador_id = $1 AND ap.esta_asignada = TRUE
                ORDER BY c.cue_titulo, s.sec_orden, p.pre_numero_pregunta`,
                [codificadorId],
                (err, result) => {
                    if (err) {
                        console.error("Error al obtener preguntas asignadas:", err);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }
}

module.exports = GestorCodificaciones;