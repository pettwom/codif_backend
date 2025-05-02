/* eslint-disable no-useless-escape */
const { con } = require("../../config/db");
const { userData } = require("../../lib/auth");

// ******* listar catalogos ******
const getListUser = async (req, res) => {
  var _user = await userData(req, res);
  console.log('datos');
  
  try {
    var result = await con.query(`SELECT row_number()over(order by vu.aut_id_usuario)nro, vu.aut_id_usuario ,concat(coalesce(vu.aut_us_nombres,''),' ',coalesce(vu.aut_us_paterno,''),' ', coalesce(vu.aut_us_materno ,'')) nombres, vu.aut_us_ci, vu.aut_us_rol, vu.rol, vu.nombre_corto_nivel
                                  FROM monitoreo.vw_usuarios vu 
                                  where vu.nombre_corto_nivel = 'Codificación' and aut_us_estado = 1`);
    var userDatos = await con.query(`SELECT row_number()over(order by vu.aut_id_usuario)nro, vu.aut_id_usuario ,concat(coalesce(vu.aut_us_nombres,''),' ',coalesce(vu.aut_us_paterno,''),' ', coalesce(vu.aut_us_materno ,'')) nombres, vu.aut_us_ci, vu.aut_us_rol, vu.rol, vu.nombre_corto_nivel
                                  FROM monitoreo.vw_usuarios vu 
                                  where vu.nombre_corto_nivel = 'Codificación' and aut_us_estado = 1 and vu.aut_id_usuario = ${_user.id_usuario}`)                                  
    return res.status(200).json({
      success: true,
      title: "Correcto",
      icon: "success",
      text: result.rowCount > 0 ? "Listado correctamente" : "No se encontraron datos",
      data: result.rowCount > 0 ? result.rows : "",
      userData: userDatos.rowCount>0? userDatos.rows: ''
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "error",
      text: e.message
    });
  }
};

const getListRoles = async(req, res)=>{
  try {
    var _user = await userData(req, res);
    console.log('user =>> ', _user);
    
    var result = await con.query(`select r.id_rol, r.rol, r.descripcion, r.nivel , r.id_estado
                                  from monitoreo.rol r 
                                  where nombre_corto_nivel = 'Codificación' and id_estado = 1 and (id_rol > ${_user.aut_us_rol} or id_rol = 1) 
                                  order by r.nivel asc`);
    return res.status(200).json({
      success: true,
      title: "Correcto",
      icon: "success",
      text: result.rowCount > 0 ? "Listado correctamente" : "No se encontraron datos",
      data: result.rowCount > 0 ? result.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "error",
      text: e.message
    });
  }
}
const saveRol = async (req, res)=>{
  try {
    var result = await con.query(`select r.id_rol, r.rol, r.descripcion
                                  from monitoreo.rol r 
                                  where sistema = 'CODIFICACION' and id_estado = 1`);
    return res.status(200).json({
      success: true,
      title: "Correcto",
      icon: "success",
      text: result.rowCount > 0 ? "Listado correctamente" : "No se encontraron datos",
      data: result.rowCount > 0 ? result.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "error",
      text: e.message
    });
  }
}
module.exports = {
  getListUser,
  getListRoles,
  saveRol
};
