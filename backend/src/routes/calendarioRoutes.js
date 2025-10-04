const express = require('express');
const router = express.Router(); 
const calendarioController = require('../controllers/calendarioController');
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 

router.get('/getSesiones', authenticateToken, calendarioController.getSesionesByAnioMes);
router.get('/getSesion', authenticateToken, calendarioController.getSesion);
router.get('/sesionPorFisio', authenticateToken, calendarioController.getSesionPorFisio);

router.post('/agregarSesion', authenticateToken, calendarioController.addSesion);
router.put('/modificarSesion', authenticateToken, calendarioController.modifySesion);
router.delete('/eliminarSesion', authenticateToken, calendarioController.deleteSesion);

module.exports = router;