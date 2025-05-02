/* eslint-disable no-unused-vars */
const bcrypt = require("bcrypt");
const { con } = require("../../config/db");

var ActiveDirectory = require("activedirectory2");
const { adSetting } = require("../../config");

const { generateToken } = require("../../lib/auth");
const { log } = require("winston");

const configAD = {
  url: adSetting.url,
  baseDN: adSetting.baseDN,
  username: adSetting.usernameAccess,
  password: adSetting.password
};

var ad = new ActiveDirectory(configAD);

const signin = async (req, res) => {
  let usuario = req.body.login.usuario.trim();
  let usernameC = usuario + "@ine.gov.bo";
  let pass = req.body.login.password;
  if (!usuario || !pass) {
    return res.status(400).json({
      statusCode: 400,
      message: "Porfavor introduzca el Usuario y Contraseña",
      path: "/login"
    });
  }
console.log(!contieneNumero(usuario) &&
!["admin", "contratos"].includes(usuario),'<=== datos');

  // if (
  //   !contieneNumero(usuario) &&
  //   !["admin", "contratos"].includes(usuario)
    
  // ) {
  // if (
  //   !contieneNumero(usuario) &&
  //   !["admin", "contratos"].includes(usuario) &&
  //   (!usuario.includes("@") || usuario.includes("@ine"))
  // ) {
    // =====================================================================
    // BASE DE DATOS ACTIVE DIRECTORY
    // =====================================================================
  //   ad.authenticate(usernameC, pass, async function(err, auth) {
  //     console.log(err,'<== error');
  //     console.log(auth,'<=== auth');
      
  //     if (err) {

        
  //       return res.status(400).json({
  //         statusCode: 400,
  //         message: `El usuario '${usuario}' no ingreso sus datos correctamente`,
  //         path: "/login"
  //       });
  //     } else {
        
        
  //       if (auth) {
  //         //por true se verifica si el usuario esta registrado en ActiveDirectory
  //         ad.findUser(usuario, async function(errAD, users) {
  //           if (!users) {
  //             return res.status(400).json({
  //               statusCode: 400,
  //               message: `El usuario '${usuario}' no se encuentra registrado`,
  //               path: "/login"
  //             });
  //           }
  //           await con.query(
  //             `SELECT * 
  //             FROM monitoreo.vw_usuarios vwu
  //             where vwu.aut_us_usuario ilike  substring('${usernameC}', 1, (position('@' in '${usernameC}')-1)) `,
  //             async (error, result) => {
  //               console.log(`SELECT *
  //             FROM monitoreo.vw_usuarios vwu
  //             where vwu.aut_us_usuario ilike  substring('${usernameC}', 1, (position('@' in '${usernameC}')-1)) `);
                
  //               if (error) {
  //                 console.log(error);
  //               }

  //               if (!result.rowCount == 0) {
  //                 let menu = await generarMenu(result.rows[0]);

  //                 if (menu == "false") {
  //                   return res.json({
  //                     ok: false,
  //                     icon: "error",
  //                     message: "El Carnet de Identidad no tiene asignado un rol ",
  //                     path: "/login" 
  //                   });
  //                 }

  //                 const userJSON = {
  //                   login: result.rows[0].aut_us_usuario,
  //                   nombre:
  //                     result.rows[0].aut_us_nombres + " " + result.rows[0].aut_us_paterno + " " + result.rows[0].aut_us_materno,
  //                   inicial:
  //                     result.rows[0].aut_us_nombres.charAt(0).toUpperCase() +
  //                     result.rows[0].aut_us_paterno.charAt(0).toUpperCase(),
  //                   id_usuario: result.rows[0].aut_id_usuario,
  //                   tipo_usuario: result.rows[0].rol,
  //                   ruta_defecto: menu[0].ruta_defecto,
  //                   estado: true,
  //                   id_rol: result.rows[0].aut_us_rol,
  //                   correo: result.rows[0].aut_us_correo_personal,
  //                   grupoUsuario: result.rows[0].rol
  //                 };

  //                 let permissions = [result.rows[0].grupo];
  //                 let generador = userJSON;
  //                 let token = await generateToken({}, { ...generador }, permissions);
  //                 return res.status(200).json({
  //                   token,
  //                   menu,
  //                   estado: true,
  //                   users: userJSON,
  //                   username: usuario,
  //                   sistema: "GESTION PERSONAL",
  //                   statusCode: 200,
  //                   message: "Sesión Iniciada",
  //                   path: "/login"
  //                 });
  //               } else {
  //                 return res.status(400).json({
  //                   statusCode: 400,
  //                   title: "Error",
  //                   icon: "info",
  //                   message: "El usuario ya ingreso o no esta habilitado en el sistema, consulte con el Administrador.",
  //                   path: "/login"
  //                 });
  //               }
  //             }
  //           );
  //         });
  //       }
  //     }
  //   });
  // } else {
console.log(`select *
        from monitoreo.vw_usuarios vau
        where lower(vau.aut_us_usuario) ilike lower('${usuario}')`,'<==== datos');

    await con.query(
      `select *
        from monitoreo.vw_usuarios vau
        where lower(vau.aut_us_usuario) ilike lower('${usuario}')`,
      async (err, result) => {
        if (err) {
          return res.status(400).json({
            statusCode: 400,
            message: `${err.message}`,
            path: "/login"
          });
        } else {
          if (!result.rowCount == 0) {
            // await con.query(
            //   `
            //     update autenticacion.aut_usuario 
            //     set aut_us_ultimo_ingreso = current_timestamp,
            //     aut_us_ingreso = false, 
            //     aut_us_navegador = '${req.body.navegador}'
            //     where aut_id_usuario = ${result.rows[0].aut_id_usuario}
            //     `
            // );

            if (!bcrypt.compare(req.body.login.password, result.rows[0].aut_us_password)) {
              return res.status(400).json({
                statusCode: 400,
                message: "Contraseña no válida",
                path: "/login"
              });
            }

            let menu = await generarMenu(result.rows[0]);

            let permissions = [result.rows[0].grupo];
            let userJSON;
            if (menu != "false") {
              userJSON = {
                login: result.rows[0].aut_us_usuario,
                nombre:
                  result.rows[0].aut_us_nombres + " " + result.rows[0].aut_us_paterno + " " + result.rows[0].aut_us_materno,
                inicial:
                  result.rows[0].aut_us_nombres.charAt(0).toUpperCase() + result.rows[0].aut_us_paterno.charAt(0).toUpperCase(),
                id_usuario: result.rows[0].aut_id_usuario,
                tipo_usuario: result.rows[0].rol,
                ruta_defecto: menu[0].ruta_defecto,
                estado: true,
                id_rol: result.rows[0].aut_us_rol,
                correo: result.rows[0].aut_us_correo_personal,
                grupoUsuario: result.rows[0].rol
              };
            } else {
              return res.json({
                ok: false,
                icon: "info",
                message: "El Usuario no tiene Asignado ningun Rol"
              });
            }

            let generador = userJSON;

            let token = await generateToken({}, { ...generador }, permissions);

            return res.status(200).json({
              token,
              menu,
              icon: "success",
              users: userJSON,
              username: usuario,
              sistema: "CONTEO Y LIMPIEZA",
              statusCode: 200,
              message: "Sesión Iniciada",
              path: "/login"
            });
          } else {
            return res.status(400).json({
              statusCode: 400,
              icon: "error",
              message: `El usuario '${usuario}' no existe.`,
              path: "/login"
            });
          }
        }
      }
    );
  // }
};

function contieneNumero(str) {
  return /\d/.test(str);
}

async function generarMenu(usuario) {
  const resultado = await con.query(
    `
    select distinct
    m.id_menu,
    m.descripcion_menu descripcion,
    m.icono, 
    m.ruta,
    m.orden,
    au.aut_id_usuario,
    (select ruta from autenticacion.menu sm where sm.id_rol @> array[au.aut_us_rol] LIMIT 1) ruta_defecto,
    (select STRING_AGG(descripcion_menu||','||ruta,'*|*') from autenticacion.menu sm where sm.id_menu_padre = m.id_menu and m.estado ='ACTIVO' and visible= 't' order by m.orden_sub ) hijos
    from monitoreo.vw_usuarios au 
    join monitoreo.rol r on au.aut_us_rol = r.id_rol
    join autenticacion.menu m ON m.id_rol @> array[ r.id_rol] AND m.id_menu_padre IS NULL
    WHERE au.aut_id_usuario = $1 and m.visible = true and m.estado = 'ACTIVO'  and m.sistema IN('CODIFICACION','ALL')
    order by m.orden  
  `,
    [usuario.aut_id_usuario]
  );
  if (resultado.rowCount > 0) {
    return resultado.rows;
  } else {
    return "false";
  }
}

const resetear = async (req, res) => {
  var ci = req.body.carnet;
  var pass = req.body.pass;
  // var id;
  var ci_verificado = await con.query(`select * from monitoreo.vw_usuarios where aut_us_ci = '${ci}'`);

  if (ci_verificado.rowCount > 0) {
    // id = ci_verificado.rows.id_usuario;
    bcrypt.hash(pass, 10, (err, result) => {
      con.query(`update monitoreo.vw_usuarios set aut_us_password = '${result}' where aut_us_ci = '${ci}'`, () => {
        return res.status(200).json({
          title: "Correcto",
          icon: "success",
          message: "las Contraseñas se cambiaron correctamente!!"
        });
      });
    });
  }
};
const logout = async (req, res) => {
  // localStorage.clear();
  return res.status(200).json({
    title: "Adios",
    icon: "success",
    text: '<h4><img src="assets/icon/logout.png" width="50"></img>&nbsp;Vuelve pronto!! </h4>'
  });
};

module.exports = {
  signin,
  resetear,
  logout
};
