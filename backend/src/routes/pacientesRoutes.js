const express = require('express');
const router = express.Router(); 
const pacienteController = require('../controllers/pacientesController');
const fichaMedicaController = require('../controllers/fichaMedicaController.js');
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 
const ah = require('../middelwares/asyncHandler.js');

// router.get('/') se mapea a /api/pacientes/ (cuando se use app.use('/api/pacientes', ...))
router.get('/', authenticateToken, ah(pacienteController.getAllPacientes));
router.post('/', authenticateToken, ah(pacienteController.createPaciente)); 
router.put('/modificarPaciente/:id', authenticateToken, ah(pacienteController.modifyPacienteById));
router.put('/eliminarPaciente', authenticateToken, ah(pacienteController.deletePaciente));

router.put('/diagnosticos/:diagnosticoEntryId', authenticateToken, ah(fichaMedicaController.updateDiagnosticoObservaciones));
router.get('/:id', authenticateToken, ah(fichaMedicaController.getPacienteById));

module.exports = router;