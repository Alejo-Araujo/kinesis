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
            return res.status(200).json({ resultado: false });
        }

    } catch (error) {
        logger.error(`Error en authController.isAdministrador: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al comprobar administrador.' });
    }
}


// Datos del usuario logueado (para el menú de perfil): nombre + roles.
async function me(req, res) {
    const id = parseInt(req.user.idUsuario, 10);
    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }
    try {
        const [rows] = await db.execute(
            `SELECT u.id AS idUsuario, u.nomyap, u.cedula,
                EXISTS(SELECT 1 FROM fisioterapeuta f WHERE f.idUsuario = u.id AND f.fechaBaja IS NULL) AS esFisio,
                EXISTS(SELECT 1 FROM administrador a WHERE a.idUsuario = u.id AND a.fechaBaja IS NULL) AS esAdmin
             FROM usuario u
             WHERE u.id = ? AND u.fechaBaja IS NULL`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const u = rows[0];
        res.status(200).json({
            idUsuario: u.idUsuario,
            nomyap: u.nomyap,
            cedula: u.cedula,
            esFisio: !!u.esFisio,
            esAdmin: !!u.esAdmin
        });
    } catch (error) {
        logger.error(`Error en authController.me: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener el perfil.' });
    }
}

// Cambio de contraseña self-service: cualquier usuario logueado cambia la suya.
async function cambiarPassword(req, res) {
    const { passwordActual, passwordNueva } = req.body;
    const id = parseInt(req.user.idUsuario, 10);

    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }
    if (!passwordActual || !passwordNueva) {
        return res.status(400).json({ message: 'La contraseña actual y la nueva son requeridas.' });
    }
    if (String(passwordNueva).length < 4) {
        return res.status(400).json({ message: 'La contraseña nueva debe tener al menos 4 caracteres.' });
    }

    try {
        const [rows] = await db.execute('SELECT passwordUser FROM usuario WHERE id = ? AND fechaBaja IS NULL', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const coincide = await bcrypt.compare(passwordActual, rows[0].passwordUser);
        if (!coincide) {
            logger.warn(`Cambio de contraseña rechazado: contraseña actual incorrecta (usuario ${id}).`);
            return res.status(400).json({ message: 'La contraseña actual es incorrecta.' });
        }

        const hash = await bcrypt.hash(passwordNueva, 10);
        await db.execute('UPDATE usuario SET passwordUser = ? WHERE id = ?', [hash, id]);
        logger.log(`Contraseña actualizada para el usuario ${id}.`);
        res.status(200).json({ message: 'Contraseña actualizada exitosamente.' });
    } catch (error) {
        logger.error(`Error en authController.cambiarPassword: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al cambiar la contraseña.' });
    }
}

module.exports = {
    login,
    isAdministrador,
    me,
    cambiarPassword
};



