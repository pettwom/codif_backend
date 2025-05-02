/* eslint-disable no-unused-vars */
// const { exceptions } = require("winston");
const { con } = require("../../config/db");
const { userData } = require("../../lib/auth");

// ******* listar catalogos ******
const getCatalogo = async (req, res) => {
  // console.log('getCatalogo request', req);

  let _user = await userData(req, res);
  if (_user) {
    let query = `SELECT distinct
    ccl.id_catalogo codigo,ccl.catalogo, ccl.cat_desc descripcion
    FROM codificacion.cod_catalogo cc
    join codificacion.cod_catologo_ls ccl on ccl.catalogo = cc.catalogo 
    WHERE lower(cc.cat_cuest) = lower('${req.params.cuest}')and cc.estado='ACTIVO' ORDER BY 2`;
    // console.log('getCatalogo ==> ', query);

    await con.query(query, (err, result) => {
      if (err) {
        return res.json({
          title: "Error",
          icon: "error",
          message: "Error al obtener el catalogo"
        });
      }
      if (result.rowCount > 0) {
        return res.json({
          title: "Correcto",
          icon: "success",
          message: "Se obtuvo el catalogo correctamente",
          data: result.rows
        });
      }
    });
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario"
    });
  }
};

const getDatos = async (req, res) => {
  // console.log('getDatos req.params' , req.params);

  let _user = await userData(req, res);
  if (_user) {
    const { cuest, cat } = req.params;
    let query = `SELECT distinct row_number() over(order by cc.id_catalogo)number, cc.id_catalogo,cc.catalogo,
  cc.codigo, cc.descripcion, to_char(cc.feccre,  'dd-mm-yyyy') fecha_creacion, 
  cc.usucre creador, to_char(cc.fecmod, 'dd-mm-yyyy') fecha_modificacion, 
  cc.usumod modificador, cc.estado
  FROM codificacion.cod_catalogo cc
  join codificacion.cod_catologo_ls ccl on ccl.catalogo = cc.catalogo 
  WHERE lower(cc.cat_cuest) = lower('${cuest}') and ccl.id_catalogo = '${cat}' and cc.estado='ACTIVO' ORDER BY 1;`;
    // console.log('getDatos ===> ',query);

    await con.query(query, (err, result) => {
      if (err) {
        return res.json({
          title: "Error",
          icon: "error",
          message: "Error al obtener los datos"
        });
      }
      if (result.rowCount > 0) {
        return res.json({
          title: "Correcto",
          icon: "success",
          message: "Se obtuvieron los datos correctamente",
          data: result.rows
        });
      }
    });
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario"
    });
  }
};
const getDatosCatalogo = async (req, res) => {
  // console.log('req-params getDatosCatalogo', req.params);

  let _user = await userData(req, res);
  if (_user) {
    let query = `
  SELECT distinct row_number() over(order by cc.id_catalogo)number, cc.id_catalogo,
  cc.codigo, cc.descripcion, to_char(cc.feccre,  'dd-mm-yyyy') fecha_creacion, 
  cc.usucre creador, to_char(cc.fecmod, 'dd-mm-yyyy') fecha_modificacion, 
  cc.usumod modificador, cc.estado
  FROM codificacion.cod_catalogo cc
  join codificacion.cod_catologo_ls ccl on ccl.catalogo = cc.catalogo 
  WHERE cc.id_catalogo = ${req.params.cod} and cc.estado='ACTIVO' ORDER BY 1;
  `;
    // console.log('getDatosCatalogo ===> ',query);

    await con.query(query, (err, result) => {
      if (err) {
        return res.json({
          title: "Error",
          icon: "error",
          message: "Error al obtener los datos"
        });
      }
      if (result.rowCount > 0) {
        return res.json({
          title: "Correcto",
          icon: "success",
          message: "Se obtuvieron los datos correctamente",
          data: result.rows
        });
      }
    });
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario"
    });
  }
};

const deleteRegister = async (req, res) => {
  let _user = await userData(req, res);
  if (_user) {
    const { cod } = req.body;
    let query = `UPDATE codificacion.cod_catalogo SET estado='INACTIVO', fecmod=NOW(), usumod='${
      _user.login
    }' WHERE id_catalogo=${cod}`;
    await con.query(query, (err, result) => {
      if (err) {
        return res.json({
          title: "Error",
          icon: "error",
          message: "Error al eliminar el registro"
        });
      }
      if (result.rowCount > 0) {
        return res.json({
          title: "Correcto",
          icon: "success",
          message: "Se eliminó el registro correctamente"
        });
      }
    });
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario"
    });
  }
};

const registerCatalogo = async (req, res) => {
  let _user = await userData(req, res);
  if (_user) {
    const { codigo, descripcion, cuestionario, catalogo } = req.body;
    let duplicados = `
        select count(1)cant
        from codificacion.cod_catalogo ca
        where trim(upper(descripcion)) ilike trim(upper('${descripcion}'))
      `;
    const d = await con.query(duplicados);

    if (d.rows[0].cant > 0) {
      return res.json({
        title: "Error",
        icon: "error",
        message: "Ya existe un registro con esa descripción"
      });
    } else {
      let query = `
                  INSERT INTO "codificacion"."cod_catalogo" ("cat_cuest", "cat_desc", "catalogo", "codigo", "descripcion", "estado", "usucre", "feccre", "usumod", "fecmod", "descripcion_unida", "unico") 
                  VALUES ('${cuestionario}', null, lower('${catalogo}'), lower('${codigo}'), trim('${descripcion}'), 'ACTIVO', '${
        _user.login
      }', current_timestamp, NULL, NULL, NULL, 0);
      `;
      await con.query(query, (err, result) => {
        if (err) {
          console.log(err);
          return res.json({
            title: "Error",
            icon: "error",
            message: "Error al guardar el registro"
          });
        }
        return res.status(200).json({
          title: "Correcto",
          icon: "success",
          message: "Se guardó el registro correctamente",
          data: result.rows[0]
        });
      });
    }
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario"
    });
  }
};
const editRegister = async (req, res) => {
  let _user = await userData(req, res);
  if (_user) {
    const { codigo, descripcion, id_catalogo } = req.body;
    console.log(req.body, "req.body");
    let query = `
        UPDATE "codificacion"."cod_catalogo" 
        SET "codigo" = '${codigo}', "descripcion" = '${descripcion}', "usumod" = '${_user.login}', "fecmod" = CURRENT_TIMESTAMP 
        WHERE "id_catalogo" = ${id_catalogo};
    `;
    await con.query(query, (err, result) => {
      if (err) {
        console.log(err);
        return res.json({
          title: "Error",
          icon: "error",
          message: "Error al guardar el registro"
        });
      }
      return res.status(200).json({
        title: "Correcto",
        icon: "success",
        message: "Se guardó el registro correctamente",
        data: result.rows[0]
      });
    });
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario"
    });
  }
};

// ? ***************** CORRECTOR *****************
// LISTAR
const getListarCorrector = async (_req, res) => {
  try {
    const catalogos = await con.query(`
        SELECT id_err_corr,	erradas,	corregidas,	usucre,	to_char(feccre, 'dd-mm-yyyy') feccre,	usumod,	to_char(fecmod,'dd-mm-yyyy') fecmod,	estado 
        FROM codificacion.cod_err_corr 
        WHERE estado='ACTIVO' 
        ORDER BY 1 DESC`);
    res.status(200).json({
      success: true,
      data: catalogos.rows,
      message: " listado correctamente"
    });
  } catch (error) {
    console.log("🚫 Error al listar", error);
    res.status(200).json({
      success: false,
      data: [],
      message: "Error al listar"
    });
  }
};

// obtener datos del editar
const getDatosCorrector = async (req, res) => {
  try {
    var result = await con.query(
      `select erradas, corregidas from codificacion.cod_err_corr coc where id_err_corr = ${req.params.ids} order by 1`
    );
    console.log(result.rows);

    return res.status(200).json({
      success: true,
      data: result.rows,
      message: "datos obtenidos correctamente"
    });
  } catch (e) {
    return res.status(200).json({
      success: false,
      data: "",
      message: e.message
    });
  }
};

// update corrector
const updateCorrector = async (req, res) => {
  let _user = await userData(req, res);
  if (_user) {
    try {
      if (req.body.tipo == "edit") {
        await con.query(`
      UPDATE "codificacion"."cod_err_corr" 
      SET "erradas" = '${req.body.erradas}', 
      "corregidas" = '${req.body.corregidas}', 
      "usumod" = '${_user.login}', 
      "fecmod" = CURRENT_TIMESTAMP 
      WHERE "id_err_corr" = ${req.body.ids};
  `);
      } else {
        await con.query(`
          INSERT INTO "codificacion"."cod_err_corr" ("erradas", "corregidas", "usucre", "feccre", "estado")
          VALUES ('${req.body.erradas}', '${req.body.corregidas}', '${_user.login}', CURRENT_TIMESTAMP, 'ACTIVO');`);
      }
      
      return res.status(200).json({
        title: "Correcto",
        icon: "success",
        success: true,
        data: "",
        message: "Registro actualizado correctamente"
      });
    } catch (e) {
      return res.status(404).json({
        title: "Error",
        icon: "error",
        message: e.message,
        success: false
      });
    }
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario",
      success: false
    });
  }
};

const deleteCorrector = async (req, res) => {
  let _user = await userData(req, res);
  if (_user) {
    try {
      await con.query(`
        UPDATE "codificacion"."cod_err_corr" 
        SET "estado" = 'INACTIVO', 
        "usumod" = '${_user.login}', 
        "fecmod" = CURRENT_TIMESTAMP 
        WHERE "id_err_corr" = ${req.body.ids};
    `);
      return res.status(200).json({
        title: "Correcto",
        icon: "success",
        message: "Se elimino correctamente los datos",
        success: true
      });
    } catch (e) {
      return res.status(404).json({
        title: "Error",
        icon: "error",
        message: e.message,
        success: false
      });
    }
  } else {
    return res.status(404).json({
      title: "Error",
      icon: "error",
      message: "No se pudo validar el usuario",
      success: false
    });
  }
};

module.exports = {
  getCatalogo,
  getDatos,
  getDatosCatalogo,
  deleteRegister,
  registerCatalogo,
  editRegister,
  //CORRECTORES
  getListarCorrector,
  getDatosCorrector,
  updateCorrector,
  deleteCorrector,
};
