/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
"use strict";

const jwt = require("jsonwebtoken");
const { config } = require("../common");
const ActiveDirectory = require("activedirectory2").promiseWrapper;
const { adSetting } = require("../config");
const { con } = require("../config/db");
const moment = require("moment");

const configAD = {
  url: adSetting.url,
  baseDN: adSetting.baseDN,
  username: adSetting.usernameAccess,
  password: adSetting.password
};

function sign(payload, secret, callback) {
  return jwt.sign(payload, secret, callback);
}

function verify(token, secret, callback) {
  return jwt.verify(token, secret, callback);
}

function permissions(context, permission) {
  if (context.permissions) {
    let type;
    permission = permission.split("|");

    for (let i in permission) {
      if (context.permissions.indexOf(permission[i]) !== -1) {
        return true;
      } else {
        type = permission[i].split(":")[1].toUpperCase();
      }
    }
    throw new Error(`NOT_AUTHORIZED:${type || "READ"}`);
  } else {
    throw new Error("NOT_AUTHORIZED:READ");
  }
}

async function generateToken(Parametro, usuario, permissions) {
  // Generando token
  let token;

  var now = moment();
  var time = now.hour();

  let horaRestante = 24 - time + 5;
  //let horaRestante = 24;
  // la duracion del token expirara hasta las 5:59am del dia siguiente.
  try {
    token = await sign(
      {
        usuario,
        permissions
      },
      config.auth.secret,
      {
        expiresIn: 8 + "h"
        // expiresIn: horaRestante + 'h'
        // expires in 24 hours
        // expiresIn: '365d' // expires in 365 days
      }
    );
    return token;
  } catch (error) {
    // Si ocurre algún error al firmar el token, se maneja aquí.
    console.error("Error al generar el token:", error);
    // Aquí podrías enviar un mensaje de error personalizado o realizar otras acciones según sea necesario.
    return res.status(500).json({ error: "Error al generar el token." });
  }
}

async function userDataToken(req) {
  const { headers } = req;
  if (headers.authorization) {
    try {
      if (!headers.authorization) {
        return res.status(403).send("Token no proporcionado");
      }
      let data = await verify(req.headers.authorization.replace("Bearer ", ""), config.auth.secret);

      return data;
    } catch (e) {
      throw new Error(`Error al crear el token: ${e.message}`);
    }
  }
}

const userData = async (req, res, next) => {
  const { headers } = req;
  // console.log(headers.authorization);

  if (headers.authorization) {
   
    try {
      // Verifica el token JWT
      const token = req.headers.authorization.replace("Bearer ", "");
      let data = await verify(token, config.auth.secret);

      // Verifica si el token contiene datos del usuario
      if (!data || !data.usuario) {
        throw new Error("Token inválido: No se encontró información del usuario.");
      }

      let datos = [];
      // Realiza la consulta a la base de datos
      let respuesta = await con.query(`
      select 
        vau.aut_id_usuario id_usuario, 
        vau.aut_us_usuario login, 
        vau.aut_us_password, 
        vau.aut_us_nombres, 
        vau.aut_us_paterno, 
        vau.aut_us_materno, 
        vau.aut_us_rol
      from monitoreo.vw_usuarios vau
      where vau.aut_us_estado = 1 and vau.aut_id_usuario = ${data.usuario.id_usuario}
    `);

      // Si hay una respuesta, asigna el primer registro
      if (respuesta && respuesta.rows.length > 0) {
        datos = respuesta.rows[0];
        return datos; 
      } else {
        throw new Error("Usuario no encontrado o no activo.");
      }

    } catch (err) {
      // Registra el error completo en los logs para facilitar la depuración
      console.error("Error al verificar la sesión o al realizar la consulta:", err);
      
      // Lanza un error más descriptivo
      console.log(err.name,'<=== error');
      
      if (err.name === "TokenExpiredError") {
        // throw new Error(`La sesión ha expirado: ${err.message}`);
        return res.status(401).json({
          statusCode: 401,
          message: `Token inválido: ${err.message}`,
          path: '/login',  // Puedes indicar la ruta para intentar nuevamente el login
        });
      } else if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
          statusCode: 401,
          message: `Token inválido: ${err.message}`,
        }); 
      } else {
         // Manejo de errores desconocidos
         return res.status(500).json({
          statusCode: 500,
          message: `Error desconocido: ${err.message}`,
        });
      }
    }
  }
}

async function PromesaAutenticacion(usuario, contrasenia) {
  return await new Promise((resolve, reject) => {
    let ad = new ActiveDirectory(configAD);
    ad.authenticate(usuario, contrasenia, (err, auth) => {
      if (err) {
        console.error("parte-111: " + err);
        reject(err.message + "parte-111");
      } else if (auth) {
        ad = new ActiveDirectory(configAD);
        //ad.findUser(usuario, (err, users) => {
        // let query = 'mail=' + usuario.replace('ine.gov.vo','gob.bo') + '';
        let query = "sAMAccountName=" + usuario.replace("@ine.gov.bo", "").replace("@ine.gob.bo", "") + "";
        ad.findUsers(query, (err, users) => {
          if (err) {
            reject(err.message + "parte-222");
          } else {
            if (!users) {
              reject("ERROR: No users found.-");
            } else {
              resolve(users[0]);
            }
          }
        });
      } else {
        console.log("Authenticated Faliled");
        reject("No Authenticated ");
      }
    });
  });
}

async function PromesaUsuario(buscar) {
  // let query = 'mail=' + buscar + '@ine.gob.bo';
  let query = "sAMAccountName=" + buscar.replace("@ine.gov.bo", "").replace("@ine.gob.bo", "") + "";
  return await new Promise((resolve, reject) => {
    let ad = new ActiveDirectory(configAD);
    ad.findUsers(query, (err, users) => {
      if (err) {
        console.error("parte--222aa" + err);
        reject(err.message + "parte-333-");
      } else {
        if (!users) {
          reject("ERROR: No users found.-");
        } else {
          resolve(users);
        }
      }
    });
  });
}

async function verificarLoginConActiveDirectory(usuario, contrasenia) {
  return await PromesaAutenticacion(usuario, contrasenia)
    .catch(async err => {
      if (err.includes("ECONNREFUSED")) {
        return await PromesaAutenticacion(usuario, contrasenia).catch(err2 => {
          return { estado: false, message: err2 };
        });
      } else {
        return { estado: false, message: err };
      }
    })
    .then(async users => {
      if (users.dn) {
        let datoUsuario = users.dn.split(",");
        return { estado: true, message: "Authenticated", users };
      }
      return { estado: false, message: "El usuario esta dado de baja" };
    });
}

async function buscarUsuarioConActiveDirectory(usuario) {
  return await PromesaUsuario(usuario)
    .catch(async err => {
      return { estado: false, message: err };
    })
    .then(async users => {
      let usuariosFiltadosActivos;
      // console.log(users);
      if (users && users.estado == undefined) {
        usuariosFiltadosActivos = users.filter(item => {
          let datoUsuario = item.dn.split(",");
          return true;
        });
      } else {
        usuariosFiltadosActivos = [];
      }

      return {
        estado: true,
        message: "Encontrado!",
        users: usuariosFiltadosActivos
      };
    });
}

module.exports = {
  sign,
  verify,
  permissions,
  generateToken,
  verificarLoginConActiveDirectory,
  buscarUsuarioConActiveDirectory,
  userData,
  userDataToken
};
