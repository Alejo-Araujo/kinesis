const express = require('express');
const router = express.Router();
const diagnosticosController = require('../controllers/diagnosticosController.js'); 
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 
const ah = require('../middelwares/asyncHandler.js');

router.get('/', authenticateToken, ah(diagnosticosController.getAllNombresDiagnosticos));
router.post('/agregarNombreDiagnostico', authenticateToken, ah(diagnosticosController.agregarNombreDiagnostico));
router.post('/agregarDiagnostico', authenticateToken, ah(diagnosticosController.agregarDiagnostico));
router.delete('/eliminarDiagnostico/:idDiagnostico', authenticateToken, ah(diagnosticosController.eliminarDiagnostico));

router.put('/modificarNombreDiagnostico/:id', authenticateToken, ah(diagnosticosController.modifyNombreDiagnosticoById));

router.delete('/eliminarNombreDiagnostico/:id', authenticateToken, ah(diagnosticosController.eliminarNombreDiagnostico));



module.exports = router;

