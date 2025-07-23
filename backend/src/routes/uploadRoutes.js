const express = require('express');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const path = require('path');
const { authenticateToken } = require('../middelwares/authMiddelware.js');

// Directorio donde se guardarán las imágenes
const uploadImagesDir = path.join(__dirname, '..', 'public', 'upload', 'image');

// Crea el directorio si no existe
if (!fs.existsSync(uploadImagesDir)) {
    fs.mkdirSync(uploadImagesDir, { recursive: true });
}

// Configuración de Multer para el almacenamiento de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadImagesDir); // Define el directorio de destino
    },
    filename: (req, file, cb) => {
        // Genera un nombre de archivo único usando la marca de tiempo y el nombre original
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Configuración de Multer para la subida de archivos
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limita el tamaño del archivo a 5MB
    fileFilter: (req, file, cb) => {
        // Filtra los tipos de archivo permitidos (solo imágenes jpeg, jpg, png)
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true); // Acepta el archivo
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png)!')); // Rechaza el archivo con un error
    }
});

// Ruta POST para subir una sola imagen
// Se usa `authenticateToken` para asegurar que solo usuarios autenticados pueden subir
router.post('/upload/image', authenticateToken, upload.single('image'), (req, res) => {
    // Si llegamos aquí, Multer ya ha procesado el archivo.
    // Si hubo un error en Multer, el middleware de manejo de errores (definido abajo) lo capturará.
    // Esta parte solo se ejecuta si la subida fue exitosa (no hubo errores de Multer).

    if (!req.file) {
        // En un caso ideal, Multer ya habría manejado esto si la razón es un archivo no válido.
        // Pero se mantiene como una precaución general.
        return res.status(400).json({ message: 'No se ha subido ningún archivo o el formato no es válido.' });
    }

    // Construye la URL pública de la imagen
    // ¡Asegúrate de que esta URL siempre tenga la barra diagonal!
    const imageUrl = `/upload/image/${req.file.filename}`;

    // Envía la respuesta con la URL de la imagen. El `return` es crucial aquí.
    return res.json({ url: imageUrl });
});

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



module.exports = router;