const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js'); 
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 
const ah = require('../middelwares/asyncHandler.js');

router.get('/validateToken', authenticateToken, (req,res) => {
        res.status(200).json({ 
        message: 'Token válido',
        user: { 
            cedula: req.user.cedula,
        } 
    });
});
router.post('/login', ah(authController.login));

router.get('/isAdministrador', authenticateToken, ah(authController.isAdministrador));

router.get('/me', authenticateToken, ah(authController.me));
router.put('/password', authenticateToken, ah(authController.cambiarPassword));

module.exports = router;