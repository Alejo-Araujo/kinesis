const jwt = require('jsonwebtoken');
const crearLogger = require('../../plugins/logger.plugin.js'); 
const logger = crearLogger('AuthMiddleware');

function authenticateToken(req, res, next) {
    // Obtener el token del header de autorización (Bearer Token)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        logger.warn('Acceso no autorizado: Token no proporcionado.');
        return res.status(401).json({ message: 'Acceso no autorizado: Token requerido.' }); // 401 Unauthorized
    }

    //Verifica si el token fue generado con la JWT_SECRET del server
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            logger.error(`Acceso prohibido: Token inválido o expirado. Error: ${err.message}`);
            return res.status(403).json({ message: 'Acceso prohibido: Token inválido o expirado.' }); // 403 Forbidden
        }
        req.user = user; 
        logger.debug(`Usuario autenticado: ${user.cedula}`);
        next(); // Pasa al siguiente middleware/controlador
    });
}

module.exports = {
    authenticateToken,
};