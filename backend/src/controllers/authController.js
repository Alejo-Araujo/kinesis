const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('authController.js');

// Función para INICIAR SESIÓN
async function login(req, res) {
    const { cedula, password, rememberMe } = req.body;

    try {
        const [users] = await db.execute('SELECT * FROM usuario WHERE cedula = ?', [cedula]);
        const user = users[0];

        if (!user) {
            logger.warn(`Intento de login fallido: Cédula no encontrada: ${cedula}`);
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        // Verifica si la password coincide con la hasheada en la DB
        const isMatch = await bcrypt.compare(password, user.passwordUser);

        if (!isMatch) {
            logger.warn(`Intento de login fallido: Contraseña incorrecta para ${cedula}`);
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        if(user.fechaBaja){
            logger.warn(`Intento de login fallido: Usuario dado de baja`);
            return res.status(400).json({ message: 'Usuario dado de baja.' });
        }

        const payload = {
            idUsuario: user.id,
            cedula: user.cedula,
        };

        const secret = process.env.JWT_SECRET; 
        const expiresIn = rememberMe ? '14d' : '2h';
        const token = jwt.sign(payload, secret, { expiresIn });

        logger.log(`Login exitoso para el usuario: ${cedula} `);
        res.json({ success: true, token, user: { idUsuario: user.id, nomyap:user.nomyap, cedula: user.cedula } });

    } catch (error) {
        logger.error(`Error en authController.login: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al iniciar sesión.' });
    }
}


module.exports = {
    login,
};



