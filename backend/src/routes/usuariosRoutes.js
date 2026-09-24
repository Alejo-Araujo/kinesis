const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { authenticateToken, authorizeAdmin } = require('../middelwares/authMiddelware.js');

router.get('/', authenticateToken, authorizeAdmin, usuariosController.getUsuarios);
router.post('/', authenticateToken, authorizeAdmin, usuariosController.crearUsuario);
router.put('/:id', authenticateToken, authorizeAdmin, usuariosController.actualizarUsuario);
router.delete('/:id', authenticateToken, authorizeAdmin, usuariosController.bajaUsuario);

module.exports = router;
