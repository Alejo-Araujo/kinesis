const express = require('express');
const router = express.Router(); 
const fisiosController = require('../controllers/fisiosController.js')
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 
const ah = require('../middelwares/asyncHandler.js');

router.get('/', authenticateToken, ah(fisiosController.getAllFisios))


module.exports = router;