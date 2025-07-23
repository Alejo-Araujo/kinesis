const crearLogger = require('../../plugins/logger.plugin.js'); 
const logger = crearLogger('AuthMiddleware');

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Error específico de Multer
        logger.error('Multer Error:', err.message);
        return res.status(400).json({ message: err.message });
    } else if (err) {
        // Otros errores durante la subida (ej. del fileFilter que no son MulterError)
        logger.error('Error desconocido durante la subida:', err.message);
        return res.status(500).json({ message: 'Error interno del servidor al subir la imagen.' });
    }
    next(); // Si no es un error de subida, pasa al siguiente middleware
});