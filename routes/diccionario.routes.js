const express = require("express");
const router = express.Router();
const {
  // ===============================================================
  // catalogos
  // ===============================================================
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
  getClasificador,
  getDatosClasificador
  
} = require("../controllers/system/diccionario.controller");

// ===============================================================
// catalogos
// ===============================================================

router.get("/getCatalogo/:cuest", getCatalogo);
router.get("/getDatos/:cuest/:cat", getDatos);
router.get("/getDatosCatalogo/:cod/:tipo", getDatosCatalogo);
router.put("/deleteRegister", deleteRegister);
router.post("/registerCatalogo", registerCatalogo);
router.put("/editRegister", editRegister);
//CORRECTORES
router.get("/getListarCorrector", getListarCorrector);
router.get("/getDatosCorrector/:ids", getDatosCorrector);
router.put("/updateCorrector", updateCorrector);
router.put("/deleteCorrector", deleteCorrector);
//clasificador
router.get("/getClasificador", getClasificador);
router.get("/getDatosClasificador/:clas_select", getDatosClasificador);

module.exports = router;
