/* eslint-disable no-unused-vars */
// const { exceptions } = require("winston");
const { con } = require("../../config/db");
const { userData } = require("../../lib/auth");

// ******* listar catalogos ******
const getDepto = async (req, res) => {
  try {
    var depto = await con.query(`select distinct  cpt.depto 
                  from codificacion.cod_encuesta_codificacion cpt`);
    return res.status(200).json({
      title: "Correcto",
      icon: "success",
      text: depto.rowCount > 0 ? "Se listaron Correctamente" : "No se encontraron Datos",
      data: depto.rowCount > 0 ? depto.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "Error",
      text: e.messege
    });
  }
};
const getMpio = async (req, res) => {
  try {
    var mpio = await con.query(`select distinct  cpt.mpio 
    from codificacion.cod_encuesta_codificacion cpt 
    where cpt.depto = '${req.params.depto}' `);
    return res.status(200).json({
      title: "Correcto",
      icon: "success",
      text: mpio.rowCount > 0 ? "Se listaron Correctamente" : "No se encontraron Datos",
      data: mpio.rowCount > 0 ? mpio.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "Error",
      text: e.messege
    });
  }
};
const getAg = async (req, res) => {
  try {
    var ag = await con.query(`select distinct ag_unico 
    from codificacion.cod_encuesta_codificacion cpt 
    where cpt.depto = '${req.params.depto}' and cpt.mpio = '${req.params.mpio}' `);

    console.log(`select distinct ag_unico 
    from codificacion.cod_encuesta_codificacion cpt 
    where cpt.depto = '${req.params.depto}' and cpt.mpio = '${req.params.mpio}' `);

    return res.status(200).json({
      title: "Correcto",
      icon: "success",
      text: ag.rowCount > 0 ? "Se listaron Correctamente" : "No se encontraron Datos",
      data: ag.rowCount > 0 ? ag.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "Error",
      text: e.messege
    });
  }
};
const getAe = async (req, res) => {
  try {
    var ae = await con.query(`select distinct ae_unico
    from codificacion.cod_encuesta_codificacion cpt 
    where cpt.depto = '${req.params.depto}' and cpt.mpio = '${req.params.mpio}' and cpt.ag_unico = '${req.params.ag
      }' `);
    return res.status(200).json({
      title: "Correcto",
      icon: "success",
      text: ae.rowCount > 0 ? "Se listaron Correctamente" : "No se encontraron Datos",
      data: ae.rowCount > 0 ? ae.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "Error",
      text: e.messege
    });
  }
};

const searchFrec = async (req, res) => {
  try {
    var params = req.body;
    var query = "";
    query += params.depto != "" ? ` depto = '${params.depto}' ` : "";
    query += params.mpio != "" ? ` and mpio = '${params.mpio}' ` : "";
    query += params.ag != "" ? ` and ag_unico = '${params.ag}' ` : "";
    query += params.ae != "" ? ` and ae_unico = '${params.ae}' ` : "";

    var resultado = await con.query(`select cpt.depto, cpt.mpio, cpt.ag_unico , cpt.ae_unico, trim(respuesta) respuesta, count(trim(respuesta)) cant
                  from codificacion.cod_encuesta_codificacion cpt 
                  where ${query}
                  group by cpt.depto, cpt.mpio, cpt.ag_unico , cpt.ae_unico, respuesta
                  having count(trim(respuesta))>1`);
    return res.status(200).json({
      title: "Correcto",
      icon: "success",
      text: resultado.rowCount > 0 ? "Se listaron Correctamente" : "No se encontraron Datos",
      data: resultado.rowCount > 0 ? resultado.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "error",
      text: e.messege
    });
  }
};

const saveCat = async (req, res) => {
  try {
    let _user = await userData(req, res);
    var params = req.body;
    var resultado = await con.query(`INSERT INTO "codificacion"."cod_catalogo" 
    ("cat_cuest", "cat_desc", "catalogo", "codigo", "descripcion", "estado", "usucre", "feccre") 
    VALUES ('${params.cat_cuest}', '${params.desc_model}', '${params.catalogo}', '${params.codigo}', '${params.result}', 'ACTIVO', '${_user.login}', CURRENT_TIMESTAMP);
`)
    return res.status(200).json({
      title: 'Correcto',
      icon: 'success',
      text: 'Se Registro Correctamente el Catálogo'
    });
  } catch (e) {
    return res.json({
      title: 'Error',
      icon: 'error',
      text: e.messege
    });
  }
};
const getSearchCodif = async (req, res) => {
  try {
    var params = req.body;
    var query = "";
    query += params.depto != "" ? ` depto = '${params.depto}' ` : "";
    query += params.mpio != "" ? ` and mpio = '${params.mpio}' ` : "";
    query += params.ag != "" ? ` and ag_unico = '${params.ag}' ` : "";
    query += params.ae != "" ? ` and ae_unico = '${params.ae}' ` : "";

    var resultado = await con.query(`  
      select row_number()over(order by cec.depto)nro,  cec.depto, cec.mpio, cec.ag_unico, cec.ae_unico, cec.estado, cec.respuesta, cec.respuesta_normalizada, cec.id_encuesta, cec.id_pregunta , cec.codigo_respuesta, ap.pre_numero_pregunta
      from codificacion.cod_encuesta_codificacion cec 
      join cuestionarios.apk_preguntas ap on ap.pre_id = cec.id_pregunta
      where ${query} and estado = 'CODIFICACION_AUTOMATICA' `);
    return res.status(200).json({
      title: "Correcto",
      icon: "success",
      text: resultado.rowCount > 0 ? "Se listaron Correctamente" : "No se encontraron Datos",
      data: resultado.rowCount > 0 ? resultado.rows : ""
    });
  } catch (e) {
    return res.json({
      title: "Error",
      icon: "error",
      text: e.messege
    });
  }
}
module.exports = {
  getDepto,
  getMpio,
  getAg,
  getAe,
  searchFrec,
  saveCat,
  getSearchCodif
};
