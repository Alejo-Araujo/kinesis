const express = require('express');
const router = express.Router();
const diagnosticosController = require('../controllers/diagnosticosController.js'); 
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 

router.get('/', authenticateToken, diagnosticosController.getAllNombresDiagnosticos);
router.post('/agregarNombreDiagnostico', authenticateToken,diagnosticosController.agregarNombreDiagnostico );
router.post('/agregarDiagnostico', authenticateToken,diagnosticosController.agregarDiagnostico );
router.delete('/eliminarDiagnostico/:idDiagnostico', authenticateToken, diagnosticosController.eliminarDiagnostico);

router.put('/modificarNombreDiagnostico/:id', authenticateToken, diagnosticosController.modifyNombreDiagnosticoById);

router.delete('/eliminarNombreDiagnostico/:id', authenticateToken, diagnosticosController.eliminarNombreDiagnostico);



module.exports = router;

