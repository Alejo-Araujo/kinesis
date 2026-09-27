const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { authenticateToken, authorizeAdmin } = require('../middelwares/authMiddelware.js');
const ah = require('../middelwares/asyncHandler.js');

router.get('/', authenticateToken, authorizeAdmin, ah(usuariosController.getUsuarios));
router.post('/', authenticateToken, authorizeAdmin, ah(usuariosController.crearUsuario));
router.put('/:id', authenticateToken, authorizeAdmin, ah(usuariosController.actualizarUsuario));
router.delete('/:id', authenticateToken, authorizeAdmin, ah(usuariosController.bajaUsuario));

module.exports = router;
