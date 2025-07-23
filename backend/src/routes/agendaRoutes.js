const express = require('express');
const router = express.Router(); 
const agendaController = require('../controllers/agendaController');
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 

router.get('/horariosCompletos', authenticateToken, agendaController.getAllHorariosCompletos);
router.post('/horario', authenticateToken, agendaController.addHorario);
router.get('/horario', authenticateToken, agendaController.getHorarioByCompositeKey);

router.put('/agregarPacienteGrupo', authenticateToken, agendaController.agregarPacienteGrupo);
router.put('/agregarFisioGrupo', authenticateToken, agendaController.agregarFisioGrupo);
router.put('/eliminarPacienteGrupo', authenticateToken, agendaController.eliminarPacienteGrupo);
router.put('/eliminarFisioGrupo', authenticateToken, agendaController.eliminarFisioGrupo);
router.put('/eliminarGrupo', authenticateToken, agendaController.eliminarGrupo);

module.exports = router;