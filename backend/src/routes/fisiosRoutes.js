const express = require('express');
const router = express.Router(); 
const fisiosController = require('../controllers/fisiosController.js')
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 

router.get('/', authenticateToken, fisiosController.getAllFisios)


module.exports = router;