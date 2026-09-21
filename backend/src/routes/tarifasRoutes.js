const express = require('express');
const router = express.Router();
const tarifasController = require('../controllers/tarifasController');
const { authenticateToken, authorizeAdmin } = require('../middelwares/authMiddelware.js');

router.get('/', authenticateToken, authorizeAdmin, tarifasController.getTarifas);
router.get('/vigentes', authenticateToken, authorizeAdmin, tarifasController.getTarifasVigentes);

router.post('/', authenticateToken, authorizeAdmin, tarifasController.crearTarifa);
router.put('/', authenticateToken, authorizeAdmin, tarifasController.actualizarMonto);
router.delete('/', authenticateToken, authorizeAdmin, tarifasController.eliminarTarifa);

module.exports = router;
