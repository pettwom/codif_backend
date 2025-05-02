const express = require("express");
const router = express.Router();
const {
  getListUser,
  getListRoles
} = require("../controllers/system/administracion.controller");
router.get("/getListUser", getListUser);
router.get("/getListRoles", getListRoles);
module.exports = router;