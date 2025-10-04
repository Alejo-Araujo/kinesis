const express = require('express');
const router = express.Router(); 
const cuotasController = require('../controllers/cuotasController');
const { authenticateToken, authorizeAdmin } = require('../middelwares/authMiddelware.js'); 

router.get('/', authenticateToken, authorizeAdmin, cuotasController.getAllCuotas);
router.get('/getCuota', authenticateToken, authorizeAdmin, cuotasController.getCuota);
router.get('/getMonto', authenticateToken, authorizeAdmin, cuotasController.getMonto);
router.get('/generarBalance', authenticateToken, authorizeAdmin, cuotasController.generarBalance);

router.post('/agregarCuota', authenticateToken, authorizeAdmin, cuotasController.addCuota);
router.post('/registrarPago', authenticateToken, authorizeAdmin, cuotasController.registrarPago);
router.post('/bajaCuota', authenticateToken, authorizeAdmin, cuotasController.bajaCuota);


module.exports = router;