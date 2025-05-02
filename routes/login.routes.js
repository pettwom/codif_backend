const express = require('express')
const router = express.Router();
const { 
    signin,
    resetear ,
    logout
    } = require('../controllers/public/login.controller');

router.post('/signin', signin)
router.post('/resetear', resetear)
router.get('/logout/:id', logout)

module.exports = router;