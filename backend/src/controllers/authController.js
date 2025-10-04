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

        const secret = '8a85b2ffde80d0538a4419c5fd773bd4dfe212a226c91c77838c54d1fcc659f75ff30560e4dca169b3a603daf2e633235a10bfd6b87c93bd2400d4850776af5f'; 
        //console.log(`secret es ${secret}`);
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

async function isAdministrador(req, res) {
    const {idUsuario} = req.user;

    const id = parseInt(idUsuario, 10);
    if(isNaN(id)){
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }

    try {
        const [rows] = await db.execute(
            `SELECT COUNT(*) as count
            FROM administrador
            WHERE idUsuario = ? AND fechaBaja IS NULL`,
            [id]);
    
        if (rows[0].count > 0) {
            return res.status(200).json({ resultado: true });
        } else {
            return res.status(201).json({ resultado: false });
        }

    } catch (error) {
        logger.error(`Error en authController.isAdministrador: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al comprobar administrador.' });
    }
}


module.exports = {
    login,
    isAdministrador
};



