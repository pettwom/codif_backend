const express = require("express");
const router = express.Router();
const {
  getListado,
  paso1,
  paso2,
  paso3,
  paso4,
  paso5,
  paso6,
} = require("../controllers/system/codificacion.controller");
router.get("/getListado", getListado);
router.get("/paso1", paso1);
router.get("/paso2", paso2);
router.get("/paso3", paso3);
router.get("/paso4", paso4);
router.get("/paso5", paso5);
router.get("/paso6", paso6);
module.exports = router;