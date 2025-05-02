/* eslint-disable no-useless-escape */
const { con } = require("../../config/db");
// const { userData } = require("../../lib/auth");

// ******* listar catalogos ******
const getListado = async (req, res) => {
  // var _user = await userData(req, res);
  try {
    var result = await con.query(`select row_number()over(order by cpt.depto)nro, cpt.depto, cpt.mpio, cpt.ag_unico, cpt.ae_unico, cpt.cuest_number, cpt.pre_num_pregunta, cpt.preguntas, cpt.respuesta,cpt.respuesta_normalizada, cpt.usucodificador 
from codificacion.cod_preguntas_temp cpt`);
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
};

const paso1 = async (req, res) => {
  try{
await con.query(`select * from codificacion.fn_generar_tabla_cod()`);
return res.status(200).json({
  title: 'Success',
  icon: 'success',
  text: 'Paso 1: Finalizo Satisfactoriamente!',
  data: 'Finalizo Satisfactoriamente!'
})
  }catch(e){
    return res.json({
      title: 'Error',
      icon: 'error',
      text: e.message
    })
  }
};
const paso2 = async(req, res)=>{
  try{
  await con.query(`update codificacion.cod_preguntas_temp set respuesta_normalizada = lower(respuesta)`)
  return res.status(200).json({
    title: 'Success',
    icon: 'success',
    data: 'Finalizo Satisfactoriamente!'
  })
    }catch(e){
      return res.json({
        title: 'Error',
        icon: 'error',
        text: e.message
      })
    }
}
const paso3 = async(req, res)=>{
  try{
  await con.query(`UPDATE codificacion.cod_preguntas_temp 
    SET respuesta_normalizada = REGEXP_REPLACE(unaccent(respuesta_normalizada), '[^[:alnum:]]+', '', 'g')`)
  return res.status(200).json({
    title: 'Success',
    icon: 'success',
    data: 'Finalizo Satisfactoriamente!'
  })
    }catch(e){
      return res.json({
        title: 'Error',
        icon: 'error',
        text: e.message
      })
    }
}
const paso4 = async(req, res)=>{
  try{
  await con.query(`update codificacion.cod_catalogo set descripcion_unida = lower(descripcion)`)
  return res.status(200).json({
    title: 'Success',
    icon: 'success',
    data: 'Finalizo Satisfactoriamente!'
  })
    }catch(e){
      return res.json({
        title: 'Error',
        icon: 'error',
        text: e.message
      })
    }
}
const paso5 = async(req, res)=>{
  try{
  await con.query(`UPDATE codificacion.cod_catalogo 
SET descripcion_unida = REGEXP_REPLACE(unaccent(descripcion_unida), '[^[:alnum:]]+', '', 'g'); `)
  return res.status(200).json({
    title: 'Success',
    icon: 'success',
    data: 'Finalizo Satisfactoriamente!'
  })
    }catch(e){
      return res.json({
        title: 'Error',
        icon: 'error',
        text: e.message
      })
    }
}
const paso6 = async(req, res)=>{
  try{
  await con.query(`update codificacion.cod_preguntas_temp cp
    SET codigocodif = x.codigo, estado='CODIFICADO', usucodificador='AUTOMATICO_NORMALIZADO', feccodificador =now()
    FROM
    (
      select id_cod, cuest_number, respuesta_normalizada, codigo, cec.descripcion_unida from codificacion.cod_preguntas_temp cec 
       join
      (select distinct  descripcion_unida, codigo, catalogo, descripcion from codificacion.cod_catalogo cc where  estado='ACTIVO') a
      on cec.respuesta_normalizada = a.descripcion_unida --and length(a.codigo)>=3
      where codigocodif isnull -- and cec.estado = 'ELABORADO' --AND carga = 27
      group by id_cod, cuest_number, respuesta_normalizada, codigo, cec.descripcion_unida 
    ) x
    WHERE cp.respuesta_normalizada=x.respuesta_normalizada`)
    return res.status(200).json({
      title: 'Success',
      icon: 'success',
      data: 'Finalizo Satisfactoriamente!'
    })
      }catch(e){
        return res.json({
          title: 'Error',
          icon: 'error',
          data: e.message
        })
      }
}
module.exports = {
  getListado,
  paso1,
  paso2,
  paso3,
  paso4,
  paso5,
  paso6,
};
