const jwt = require('jsonwebtoken');
const crearLogger = require('../../plugins/logger.plugin.js'); 
const logger = crearLogger('authMiddelware.js');
const db = require('../db');

function authenticateToken(req, res, next) {
    // Obtener el token del header de autorización (Bearer Token)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn(`Acceso no autorizado: token no proporcionado (${req.method} ${req.originalUrl}).`);
        return res.status(401).json({ message: 'Acceso no autorizado: Token requerido.' }); // 401 Unauthorized
    }

    //Verifica si el token fue generado con la JWT_SECRET del server
    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            // Token vencido o adulterado: no es un error del servidor, es un aviso.
            logger.warn(`Acceso prohibido: token inválido o expirado (${req.method} ${req.originalUrl}): ${err.message}`);
            return res.status(403).json({ message: 'Acceso prohibido: Token inválido o expirado.' }); // 403 Forbidden
        }

        // El token por sí solo no alcanza: el usuario pudo ser dado de baja después de
        // emitirlo (los tokens duran hasta 14 días). Se confirma contra la base en cada request.
        // PENDIENTE (ver CLAUDE.md): un usuario activo SIN rol (ni fisio ni admin) sigue pasando.
        try {
            const id = parseInt(user.idUsuario, 10);
            const [rows] = isNaN(id) ? [[]] : await db.execute(
                'SELECT 1 FROM usuario WHERE id = ? AND fechaBaja IS NULL LIMIT 1',
                [id]
            );
            if (rows.length === 0) {
                // El token es auténtico (firmado por el server): el intento queda a nombre de ese usuario.
                if (req.contexto && !isNaN(id)) {
                    req.contexto.idUsuario = id;
                }
                logger.auditar('ACCESO_USUARIO_DADO_DE_BAJA', {
                    idUsuarioToken: user.idUsuario, cedula: user.cedula, metodo: req.method, ruta: req.originalUrl
                }, 'warn');
                return res.status(401).json({ message: 'Acceso no autorizado: el usuario fue dado de baja o no existe.' });
            }
        } catch (error) {
            logger.error('Error al verificar el usuario del token:', error);
            return res.status(500).json({ message: 'Error interno de autenticación.' });
        }

        req.user = user;
        // Desde acá todos los logs del request (acceso, controllers, auditoría) llevan el usuario.
        if (req.contexto) {
            req.contexto.idUsuario = parseInt(user.idUsuario, 10);
        }
        logger.debug(`Usuario autenticado: ${user.idUsuario}`);
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
            logger.auditar('ACCESO_DENEGADO_NO_ADMIN', { metodo: req.method, ruta: req.originalUrl }, 'warn');
            return res.status(403).json({ message: 'Acceso prohibido: No tiene permisos de administrador.' });
        }

        next();
    } catch (error) {
        logger.error('Error en el middleware de autorización de admin:', error);
        return res.status(500).json({ message: 'Error interno de autorización de admin.' });
    }
}

module.exports = {
    authenticateToken,
    authorizeAdmin
};