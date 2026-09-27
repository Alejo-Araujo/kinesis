const express = require('express');
const router = express.Router(); 
const agendaController = require('../controllers/agendaController');
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 
const ah = require('../middelwares/asyncHandler.js');

router.get('/horariosCompletos', authenticateToken, ah(agendaController.getAllHorariosCompletos));
router.post('/horario', authenticateToken, ah(agendaController.addHorario));
router.get('/horario', authenticateToken, ah(agendaController.getHorarioByCompositeKey));
router.get('/fijarseHorario', authenticateToken, ah(agendaController.getHorariosForPaciente));

router.put('/agregarPacienteGrupo', authenticateToken, ah(agendaController.agregarPacienteGrupo));
router.put('/agregarFisioGrupo', authenticateToken, ah(agendaController.agregarFisioGrupo));
router.put('/eliminarPacienteGrupo', authenticateToken, ah(agendaController.eliminarPacienteGrupo));
router.put('/eliminarFisioGrupo', authenticateToken, ah(agendaController.eliminarFisioGrupo));
router.put('/eliminarGrupo', authenticateToken, ah(agendaController.eliminarGrupo));

module.exports = router;