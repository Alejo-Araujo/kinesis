const express = require('express');
const router = express.Router(); 
const pacienteController = require('../controllers/pacientesController');
const fichaMedicaController = require('../controllers/fichaMedicaController.js');
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 

// router.get('/') se mapea a /api/pacientes/ (cuando se use app.use('/api/pacientes', ...))
router.get('/', authenticateToken, pacienteController.getAllPacientes);
router.post('/', authenticateToken, pacienteController.createPaciente); 
router.put('/modificarPaciente/:id', authenticateToken, pacienteController.modifyPacienteById);
router.put('/eliminarPaciente', authenticateToken, pacienteController.deletePaciente);

router.put('/diagnosticos/:diagnosticoEntryId', authenticateToken, fichaMedicaController.updateDiagnosticoObservaciones);
router.get('/:id', authenticateToken, fichaMedicaController.getPacienteById);

module.exports = router;