/* eslint-disable curly */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const { con } = require("../../config/db");
const { userData } = require("../../lib/auth");

// Controlador de notificaciones
let ioInstance;

// Función para inicializar WebSocket en el controlador
const initWebSocket = io => {
  ioInstance = io;

  io.on("connection", socket => {
    // Enviar actualizaciones automáticas cada 10 segundos
    const intervalId = setInterval(() => {
      const timestamp = new Date().toISOString();
      socket.emit("update", { message: "Actualización automática del servidor", timestamp });
    }, 10000); // 10 segundos

    // Escuchar eventos personalizados del cliente
    socket.on("mensajeCliente", data => {
      // Responder al cliente inmediatamente
      socket.emit("mensajeServidor", {
        mensaje: "Mensaje recibido en el servidor",
        dataRecibida: data
      });
    });

    // Manejar la desconexión del cliente
    socket.on("disconnect", () => {
      console.log(`Cliente desconectado: ${socket.id}`);
      clearInterval(intervalId); // Detener el envío de actualizaciones
    });
  });
};

// Función para enviar notificaciones a través de WebSocket
const enviarNotificacion = notificacion => {
  if (ioInstance) {
    ioInstance.emit("notificacion", notificacion); // Enviar notificación a todos los clientes conectados
  } else {
    console.error("Error: WebSocket no está inicializado.");
  }
};

// Función para la ruta REST de obtener notificaciones
const obtenerNotificaciones = async (req, res) => {
  try {
    let _user = await userData(req, res);

    if (!_user || !_user.id_usuario) {
      // console.error("Error: id_usuario no está definido.");
      return res.status(400).json({
        title: "Error",
        icon: "error",
        text: "No se pudo obtener el ID del usuario.",
      });
    }

    // Usando placeholders para evitar errores de sintaxis
    const notificaciones = await new Promise((resolve, reject) => {
      con.query(
        `SELECT * FROM autenticacion.notificacion 
         WHERE id_estado = 1 AND id_user_asig = $1
         ORDER BY id`,
        [_user.id_usuario], // Usamos el placeholder $1 para id_usuario
        (err, result) => {
          if (err) return reject(err);
          resolve(result.rows);  // Asegúrate de que accedes a las filas correctamente
        }
      );
    });

    res.json(notificaciones);

    enviarNotificacion({
      mensaje: "Nueva consulta REST de notificaciones realizada.",
      total: notificaciones.length,
    });
  } catch (error) {
    // console.error("Error al obtener notificaciones:", error);
    res.status(500).json({ error: "Error al obtener notificaciones." });
  }
};

const notificacion_t = async (req, res) => {
  let _user = await userData(req, res);

  await con.query(
    `select * from autenticacion.notificacion where id_estado = 1 and id_user_asig = ${_user.id_usuario} and id = ${
      req.params.ids
    } order by 1`,
    (err, result) => {
      if (err) {
        return res.status(401).json({
          title: "Error",
          icon: "error",
          text: err.message
        });
      }
      if (result.rowCount > 0) {
        return res.json({
          title: "Correcto",
          icon: "success",
          text: "Se listo correctamente",
          data: result.rows
        });
      }
    }
  );
};
const marcarVisto = async (req, res) => {
  var id_noti = req.body.ids;
  var result = await con.query(`update autenticacion.notificacion set id_estado= 5 where id=${id_noti}`);
  return res.json({
    data: result.rows
  });
};

const almacenarNoti = async (req, res, next) => {
  let _user = await userData(req, res);
  var fecha =  await fechas(req.body.fechaFin)
  console.log(typeof fecha)
  await con.query(
    `INSERT INTO "autenticacion"."notificacion" 
                  ("titulo_noti", "descripcion_larga", "id_estado", "fecre", "usucre", "fecha_fin", "id_user_asig", "tiempo_limite") 
                  VALUES ('${req.body.title}', '${req.body.comment}', 1, current_timestamp, ${_user.id_usuario} , '${fecha}', ${req.body.user}, '${req.body.switch}')`,
    (err, result) => {

      
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al insertar notificación." }); 
      } 
      if(result.rowCount > 0) { 
      return res.status(200).json({
        title: "Correcto",  
        icon: "success",
        text: "Notificación insertada correctamente.",      
        data: req.rows
      });
    }
});
};
const fechas = async (req, res) => { 
  const fecha = new Date(req);
  // Establece la fecha deseada
  const dia = fecha.getDate();
  const mes = fecha.getMonth(); // Obtiene el nombre del mes
  const anio = fecha.getFullYear();

  const formattedFecha = `${dia}-${mes}-${anio}`;
  return formattedFecha;
};

const getUser = async (req, res) => {
  var resultado = await con.query(`select distinct vu.aut_id_usuario id_usuario, vu.aut_us_nombres ||' '||vu.aut_us_paterno ||' ' ||vu.aut_us_materno nombres from monitoreo.vw_usuarios vu order by 1
    `);
  return res.json({
    title: "Correcto",
    icon: "success",
    text: "Se listo correctamente",
    data: resultado.rows
  });
};

module.exports = {
  notificacion_t,
  initWebSocket,
  obtenerNotificaciones,
  marcarVisto,
  almacenarNoti,
  getUser
};
