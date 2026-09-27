const express = require('express');
const router = express.Router();
const tarifasController = require('../controllers/tarifasController');
const { authenticateToken, authorizeAdmin } = require('../middelwares/authMiddelware.js');
const ah = require('../middelwares/asyncHandler.js');

router.get('/', authenticateToken, authorizeAdmin, ah(tarifasController.getTarifas));
router.get('/vigentes', authenticateToken, authorizeAdmin, ah(tarifasController.getTarifasVigentes));

router.post('/', authenticateToken, authorizeAdmin, ah(tarifasController.crearTarifa));
router.put('/', authenticateToken, authorizeAdmin, ah(tarifasController.actualizarMonto));
router.delete('/', authenticateToken, authorizeAdmin, ah(tarifasController.eliminarTarifa));

module.exports = router;
