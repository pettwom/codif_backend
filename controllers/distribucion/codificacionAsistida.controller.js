const GestorCodificaciones = require('../../services/gestorCodificaciones');

// Controlador para gestionar las operaciones de codificación asistida
const obtenerCodificacionesAsistidas = async (req, res) => {
    try {
        const {nombre_corto} = req.params;
        // Obtener el ID del usuario actual para verificar asignaciones propias
        const usuarioId = req.usuario?.id_usuario || null;
        const rolActual = req.rolActual || '';

        // Determinar si el usuario es supervisor o superior (para mostrar todas o solo asignadas)
        const esSupervisor = ['GSP', 'JTMT', 'SUP'].includes(rolActual);

        const gestorCodificaciones = new GestorCodificaciones();
        const resultado = await gestorCodificaciones.obtenerCodificacionesAsistidas(usuarioId, esSupervisor, nombre_corto);

        // Estructurar los datos jerárquicamente para una mejor respuesta
        const cuestionarios = {};

        resultado.rows.forEach(row => {
            // Si el cuestionario no existe en nuestro objeto, lo creamos
            if (!cuestionarios[row.id_cuestionario]) {
                cuestionarios[row.id_cuestionario] = {
                    id: row.id_cuestionario,
                    titulo: row.titulo_cuestionario,
                    secciones: {}
                };
            }

            // Si la sección no existe en este cuestionario, la creamos
            if (!cuestionarios[row.id_cuestionario].secciones[row.id_seccion]) {
                cuestionarios[row.id_cuestionario].secciones[row.id_seccion] = {
                    id: row.id_seccion,
                    nombre: row.nombre_seccion,
                    orden: row.orden_seccion,
                    preguntas: []
                };
            }

            // Preparar información sobre la asignación
            const infoAsignacion = {
                esta_asignada: row.esta_asignada || false,
                total_asignaciones: parseInt(row.total_asignaciones) || 0,
                cantidad_asignada_activa: parseInt(row.cantidad_asignada_activa) || 0,
                total_posibles: parseInt(row.total_posibles) || 0,
                supervisor_id: row.supervisor_id,
                nombre_usuario_supervisor: row.nombre_usuario_supervisor,
                mi_cantidad_asignada: parseInt(row.mi_cantidad_asignada) || 0,
                codificadores_asignados: row.codificadores || [],
                lista_codificadores: row.lista_codificadores || ''
            };

            // Agregamos la pregunta a la sección con información de asignación
            cuestionarios[row.id_cuestionario].secciones[row.id_seccion].preguntas.push({
                id: row.id_pregunta,
                numero: row.pre_numero_pregunta,
                texto: row.pre_pregunta,
                total_codificaciones: parseInt(row.total_codificaciones),
                asignacion: infoAsignacion
            });
        });

        // Convertir el objeto en un array y ordenar las secciones por orden
        const cuestionariosArray = Object.values(cuestionarios).map(cuestionario => {
            cuestionario.secciones = Object.values(cuestionario.secciones).sort((a, b) => a.orden - b.orden);
            return cuestionario;
        });

        // Estadísticas generales
        const totalPreguntas = resultado.rowCount;
        const totalAsignadas = resultado.rows.filter(row => row.esta_asignada).length;
        const totalSinAsignar = totalPreguntas - totalAsignadas;
        const porcentajeAsignadas = totalPreguntas > 0 ? Math.round((totalAsignadas / totalPreguntas) * 100) : 0;

        // Determinar el mensaje según el rol
        let mensaje = "Codificaciones asistidas obtenidas correctamente";
        if (rolActual === 'COD') {
            mensaje = "Listado de codificaciones asignadas a usted";
        } else if (rolActual === 'SUP') {
            mensaje = "Listado de codificaciones para distribuir carga";
        }

        return res.status(200).json({
            statusCode: 200,
            message: mensaje,
            path: `/codificacion/asistida`,
            icon: "success",
            data: cuestionariosArray,
            estadisticas: {
                total_preguntas: totalPreguntas,
                preguntas_asignadas: totalAsignadas,
                preguntas_sin_asignar: totalSinAsignar,
                porcentaje_asignadas: porcentajeAsignadas
            }
        });

    } catch (error) {
        console.error("Error en obtenerCodificacionesAsistidas:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener codificaciones asistidas',
            path: `/codificacion/asistida`
        });
    }
};

// Obtener detalle de codificaciones para una pregunta específica
const obtenerDetallePregunta = async (req, res) => {
    try {
        const { id_pregunta } = req.params;

        if (!id_pregunta) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere el ID de la pregunta",
                path: `/codificacion/asistida/detalle`
            });
        }

        const gestorCodificaciones = new GestorCodificaciones();
        const resultado = await gestorCodificaciones.obtenerDetalleCodificacion(id_pregunta);

        return res.status(200).json({
            statusCode: 200,
            message: "Detalle de codificaciones obtenido correctamente",
            path: `/codificacion/asistida/detalle/${id_pregunta}`,
            icon: "success",
            data: resultado.rows,
            total: resultado.rowCount
        });

    } catch (error) {
        console.error("Error en obtenerDetallePregunta:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener detalle de codificaciones',
            path: `/codificacion/asistida/detalle`
        });
    }
};

// Obtener estadísticas de codificación
const obtenerEstadisticas = async (req, res) => {
    try {
        const gestorCodificaciones = new GestorCodificaciones();
        const resultado = await gestorCodificaciones.obtenerEstadisticasCodificaciones();

        return res.status(200).json({
            statusCode: 200,
            message: "Estadísticas de codificación obtenidas correctamente",
            path: `/codificacion/asistida/estadisticas`,
            icon: "success",
            data: resultado.rows,
            total: resultado.rowCount
        });

    } catch (error) {
        console.error("Error en obtenerEstadisticas:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener estadísticas de codificación',
            path: `/codificacion/asistida/estadisticas`
        });
    }
};

// Asignar una pregunta a un codificador
const asignarPreguntaACodificador = async (req, res) => {
    try {
        const { seccion_id, pregunta_id, codificador_id, cantidad_asignada, asignacion_id } = req.body;

        if (!seccion_id || !pregunta_id || !codificador_id || !cantidad_asignada || !asignacion_id) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requieren todos los campos: seccion_id, pregunta_id, codificador_id y cantidad_asignada",
                path: `/codificacion/asistida/asignar`
            });
        }

        // Validar que la cantidad sea un número positivo
        if (isNaN(cantidad_asignada) || parseInt(cantidad_asignada) <= 0) {
            return res.status(400).json({
                statusCode: 400,
                message: "La cantidad a asignar debe ser un número mayor a cero",
                path: `/codificacion/asistida/asignar`
            });
        }

        const supervisorId = req.usuario.id_usuario;
        const rolActual = req.rolActual;

        // Solo SUP o superior pueden asignar preguntas
        if (!['GSP', 'JTMT', 'SUP'].includes(rolActual)) {
            return res.status(403).json({
                statusCode: 403,
                message: "No tiene permisos para asignar preguntas",
                path: `/codificacion/asistida/asignar`
            });
        }

        const gestorCodificaciones = new GestorCodificaciones();
        const resultado = await gestorCodificaciones.asignarPreguntaACodificador(
            seccion_id,
            pregunta_id,
            supervisorId,
            codificador_id,
            parseInt(cantidad_asignada),
            asignacion_id
        );

        if (!resultado.exitoso) {
            return res.status(400).json({
                statusCode: 400,
                message: resultado.mensaje,
                path: `/codificacion/asistida/asignar`
            });
        }

        return res.status(200).json({
            statusCode: 200,
            message: resultado.mensaje,
            path: `/codificacion/asistida/asignar`,
            icon: "success",
            tipo: resultado.tipo,
            id: resultado.id,
            cantidad_asignada: resultado.cantidad_asignada
        });

    } catch (error) {
        console.error("Error en asignarPreguntaACodificador:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al asignar pregunta',
            path: `/codificacion/asistida/asignar`
        });
    }
};

const asignarMultiplesPreguntas = async (req, res) => {
    try {
        const { asignaciones } = req.body;

        // Verificar que se haya enviado un array
        if (!Array.isArray(asignaciones) || asignaciones.length === 0) {
            return res.status(400).json({
                statusCode: 400,
                message: "Se requiere un array de asignaciones",
                path: `/codificacion/asistida/asignar-multiples`
            });
        }

        const supervisorId = req.usuario.id_usuario;
        const rolActual = req.rolActual;

        // Solo SUP o superior pueden asignar preguntas
        if (!['GSP', 'JTMT', 'SUP'].includes(rolActual)) {
            return res.status(403).json({
                statusCode: 403,
                message: "No tiene permisos para asignar preguntas",
                path: `/codificacion/asistida/asignar-multiples`
            });
        }

        // Verificar que cada asignación tenga los campos requeridos
        for (const asignacion of asignaciones) {

            const { seccion_id, pregunta_id, codificador_id, cantidad_asignada } = asignacion;

            if (!seccion_id || !pregunta_id || !codificador_id || !cantidad_asignada) {
                return res.status(400).json({
                    statusCode: 400,
                    message: "Se requieren todos los campos: seccion_id, pregunta_id, codificador_id y cantidad_asignada para cada asignación",
                    path: `/codificacion/asistida/asignar-multiples`
                });
            }

            // Validar que la cantidad sea un número positivo
            if (isNaN(cantidad_asignada) || parseInt(cantidad_asignada) <= 0) {
                return res.status(400).json({
                    statusCode: 400,
                    message: "La cantidad a asignar debe ser un número mayor a cero",
                    path: `/codificacion/asistida/asignar-multiples`
                });
            }
        }

        const gestorCodificaciones = new GestorCodificaciones();
        const resultados = await gestorCodificaciones.asignarMultiplesPreguntas(asignaciones, supervisorId);

        if (!resultados.exitoso) {
            return res.status(400).json({
                statusCode: 400,
                message: resultados.mensaje,
                path: `/codificacion/asistida/asignar-multiples`
            });
        }

        return res.status(200).json({
            statusCode: 200,
            message: resultados.mensaje,
            path: `/codificacion/asistida/asignar-multiples`,
            icon: "success",
            resultados: resultados.resultados
        });

    } catch (error) {
        console.error("Error en asignarMultiplesPreguntas:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al asignar preguntas',
            path: `/codificacion/asistida/asignar-multiples`
        });
    }
};

// USUARIO COD

// Obtener preguntas asignadas a un codificador específico
const obtenerMisPreguntas = async (req, res) => {
    try {
        const codificadorId = req.usuario.id_usuario;
        const rolActual = req.rolActual;

        // Solo un codificador puede ver sus preguntas asignadas
        if (rolActual !== 'COD') {
            return res.status(403).json({
                statusCode: 403,
                message: "Esta función es solo para codificadores",
                path: `/codificacion/asistida/mis-preguntas`
            });
        }

        const gestorCodificaciones = new GestorCodificaciones();
        const resultado = await gestorCodificaciones.obtenerPreguntasAsignadasACodificador(codificadorId);

        // Estructurar los datos por cuestionario y sección
        const cuestionarios = {};

        resultado.rows.forEach(row => {
            const cuestionarioId = row.titulo_cuestionario;
            const seccionId = row.seccion_id;

            if (!cuestionarios[cuestionarioId]) {
                cuestionarios[cuestionarioId] = {
                    titulo: row.titulo_cuestionario,
                    secciones: {}
                };
            }

            if (!cuestionarios[cuestionarioId].secciones[seccionId]) {
                cuestionarios[cuestionarioId].secciones[seccionId] = {
                    id: seccionId,
                    nombre: row.nombre_seccion,
                    preguntas: []
                };
            }

            cuestionarios[cuestionarioId].secciones[seccionId].preguntas.push({
                asignacion_pregunta_id: row.id_asignacion,
                seccion_id: row.seccion_id,
                pregunta_id: row.pregunta_id,
                numero: row.pre_numero_pregunta,
                texto: row.pre_pregunta,
                cantidad_asignada: row.cantidad_asignada,
                total_asignaciones: row.total_asignaciones,
                fecha_asignacion: row.fecha_distribucion_de_carga,
                supervisor: row.supervisor_nombre,
                rol_asignacion_id: row.rol_asignacion_id,
                rol_turno_asignacion: row.turno
            });
        });

        // Convertir a formato de array
        const respuesta = Object.keys(cuestionarios).map(key => {
            const cuestionario = cuestionarios[key];
            return {
                titulo: key,
                secciones: Object.values(cuestionario.secciones)
            };
        });

        return res.status(200).json({
            statusCode: 200,
            message: "Preguntas asignadas obtenidas correctamente",
            path: `/codificacion/asistida/mis-preguntas`,
            icon: "success",
            data: respuesta,
            total: resultado.rowCount
        });

    } catch (error) {
        console.error("Error en obtenerMisPreguntas:", error);

        return res.status(error.statusCode || 500).json({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error al obtener preguntas asignadas',
            path: `/codificacion/asistida/mis-preguntas`
        });
    }
};

module.exports = {
    obtenerCodificacionesAsistidas,
    obtenerDetallePregunta,
    obtenerEstadisticas,
    asignarPreguntaACodificador,
    asignarMultiplesPreguntas,
    obtenerMisPreguntas
};