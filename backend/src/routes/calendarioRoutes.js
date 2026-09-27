const express = require('express');
const router = express.Router(); 
const calendarioController = require('../controllers/calendarioController');
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 
const ah = require('../middelwares/asyncHandler.js');

router.get('/getSesiones', authenticateToken, ah(calendarioController.getSesionesByAnioMes));
router.get('/getSesion', authenticateToken, ah(calendarioController.getSesion));
router.get('/sesionPorFisio', authenticateToken, ah(calendarioController.getSesionPorFisio));

router.post('/agregarSesion', authenticateToken, ah(calendarioController.addSesion));
router.put('/modificarSesion', authenticateToken, ah(calendarioController.modifySesion));
router.delete('/eliminarSesion', authenticateToken, ah(calendarioController.deleteSesion));

module.exports = router;