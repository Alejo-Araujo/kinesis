const jwt = require('jsonwebtoken');
const crearLogger = require('../../plugins/logger.plugin.js'); 
const logger = crearLogger('AuthMiddleware');
const db = require('../db');

function authenticateToken(req, res, next) {
    // Obtener el token del header de autorización (Bearer Token)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn('Acceso no autorizado: Token no proporcionado.');
        return res.status(401).json({ message: 'Acceso no autorizado: Token requerido.' }); // 401 Unauthorized
    }

    //Verifica si el token fue generado con la JWT_SECRET del server
    jwt.verify(token, '8a85b2ffde80d0538a4419c5fd773bd4dfe212a226c91c77838c54d1fcc659f75ff30560e4dca169b3a603daf2e633235a10bfd6b87c93bd2400d4850776af5f', (err, user) => {
        if (err) {
            logger.error(`Acceso prohibido: Token inválido o expirado. Error: ${err.message}`);
            return res.status(403).json({ message: 'Acceso prohibido: Token inválido o expirado.' }); // 403 Forbidden
        }
        req.user = user; 
        logger.debug(`Usuario autenticado: ${user.cedula}`);
        next(); // Pasa al siguiente middleware/controlador
    });
}

async function authorizeAdmin(req, res, next) {
    try {
        const { idUsuario } = req.user;
        
        const id = parseInt(idUsuario,10);
        if(isNaN(id)){
            logger.warn(`ID de usuario inválido. Usuario ID: ${idUsuario}`);
            return res.status(403).json({ message: 'ID de usuario inválido.' });
        }

        const [result] = await db.execute(
            `SELECT COUNT(*) AS esAdministrador 
            FROM administrador 
            WHERE idUsuario = ? AND fechaBaja IS NULL`,
            [id]
        );
        

        if (result[0].esAdministrador === 0) {
            logger.warn(`Intento de acceso de no administrador al recurso. Usuario ID: ${id}.`);
            return res.status(403).json({ message: 'Acceso prohibido: No tiene permisos de administrador.' });
        }

        next(); 
    } catch (error) {
        logger.error('Error en el middleware de autorización de admin:', error.message);
        return res.status(500).json({ message: 'Error interno de autorización de admin.' });
    }
}

module.exports = {
    authenticateToken,
    authorizeAdmin
};