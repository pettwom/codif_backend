const express = require("express");
const router = express.Router();
const {
  // ===============================================================
  // frecuencia
  // ===============================================================
  getDepto,
  getMpio,
  getAg,
  getAe,
  searchFrec,
  saveCat
} = require("../controllers/system/frecuencia.controller");


router.get("/getDepto", getDepto);
router.get("/getMpio/:depto", getMpio);
router.get("/getAg/:depto/:mpio", getAg);
router.get("/getAe/:depto/:mpio/:ag", getAe);
router.post("/searchFrec", searchFrec);
router.post("/saveCat", saveCat);



module.exports = router;
