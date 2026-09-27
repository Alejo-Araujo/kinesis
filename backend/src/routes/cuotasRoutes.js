const express = require('express');
const router = express.Router(); 
const cuotasController = require('../controllers/cuotasController');
const { authenticateToken, authorizeAdmin } = require('../middelwares/authMiddelware.js'); 
const ah = require('../middelwares/asyncHandler.js');

router.get('/', authenticateToken, authorizeAdmin, ah(cuotasController.getAllCuotas));
router.get('/getCuota', authenticateToken, authorizeAdmin, ah(cuotasController.getCuota));
router.get('/getMonto', authenticateToken, authorizeAdmin, ah(cuotasController.getMonto));
router.get('/generarBalance', authenticateToken, authorizeAdmin, ah(cuotasController.generarBalance));

router.post('/agregarCuota', authenticateToken, authorizeAdmin, ah(cuotasController.addCuota));
router.post('/registrarPago', authenticateToken, authorizeAdmin, ah(cuotasController.registrarPago));
router.post('/bajaCuota', authenticateToken, authorizeAdmin, ah(cuotasController.bajaCuota));
router.post('/restaurarGrupos', authenticateToken, authorizeAdmin, ah(cuotasController.restaurarGrupos));

module.exports = router;