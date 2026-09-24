const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.js'); 
const { authenticateToken } = require('../middelwares/authMiddelware.js'); 

router.get('/validateToken', authenticateToken, (req,res) => {
        res.status(200).json({ 
        message: 'Token válido',
        user: { 
            cedula: req.user.cedula,
        } 
    });
});
router.post('/login', authController.login);

router.get('/isAdministrador', authenticateToken, authController.isAdministrador);

router.get('/me', authenticateToken, authController.me);
router.put('/password', authenticateToken, authController.cambiarPassword);

module.exports = router;