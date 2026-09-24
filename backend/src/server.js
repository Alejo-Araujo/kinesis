const path = require('path');

// Carga de variables de entorno desde backend/.env con ruta ABSOLUTA:
// funciona igual con nodemon, con `node` directo o en produccion, sin depender del cwd.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Entorno de ejecucion (development | production). Se define con NODE_ENV en el .env.
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduccion = NODE_ENV === 'production';

// Logs de depuracion de la conexion: solo fuera de produccion.
if (!isProduccion) {
    console.log('NODE_ENV:', NODE_ENV);
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
}

const express = require('express');
const app = express();
app.disable('x-powered-by');
// El puerto se toma de la variable de entorno PORT (ej: 3000 en desarrollo, 50001 en produccion).
const port = process.env.PORT || 3000;
const fs = require('fs');

const diagnosticosRoutes = require('./routes/diagnosticosRoutes.js')
const pacientesRoutes = require('./routes/pacientesRoutes');
const authRoutes = require('./routes/authRoutes.js');
const agendaRoutes = require('./routes/agendaRoutes.js');
const uploadRoutes = require('./routes/uploadRoutes.js');
const fisiosRoutes = require('./routes/fisiosRoutes.js');
const calendarioRoutes = require('./routes/calendarioRoutes.js');
const cuotasRoutes = require('./routes/cuotasRoutes.js')
const tarifasRoutes = require('./routes/tarifasRoutes.js')
const usuariosRoutes = require('./routes/usuariosRoutes.js')

const  crearLogger  = require('../plugins/logger.plugin.js');
const logger = crearLogger('server.js');


process.on('uncaughtException', (err, origin) => {
  logger.error('--- EXCEPCIÓN NO CAPTURADA (uncaughtException) ---');
  logger.error(`El error fue:   ${err.message}`);
  logger.error(`Stack trace:  ${err.stack}`);
  logger.error(`Origen:  ${origin}`);

  try {
    const fatalLogPath = path.join(__dirname, '..', '..', 'logs', 'fatal.log');
    const mensaje = `\n[${new Date().toISOString()}] Excepción no capturada: ${err.message}\nStack trace: ${err.stack}\nOrigen: ${origin}\n`;
    fs.appendFileSync(fatalLogPath, mensaje);
    } catch (fileErr) {
        console.error('Error al escribir en el archivo de logs:', fileErr.message);
}
  
  process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('--- ERROR EN PROMESA NO MANEJADA (unhandledRejection) ---');
  const error = reason || {}; 
  logger.error(`Razón del error: ${error.message || reason}`);
  logger.error(`Stack trace: ${error.stack || 'No stack trace'}`);

  try {
    const fatalLogPath = path.join(__dirname, '..', '..', 'logs', 'fatal.log');
    const mensaje = `\n[${new Date().toISOString()}] Error en promesa no manejada: ${error.message || reason}\nStack trace: ${error.stack || 'No stack trace'}\n`;
    fs.appendFileSync(fatalLogPath, mensaje);
    } catch (fileErr) {
        console.error("No se pudo escribir el log fatal", fileErr.message);
  }
  process.exit(1); 
});

const multer = require('multer'); 

const publicFilesDir = path.join(__dirname, '..', '..', 'public');


app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json()); 

app.get('/public/site.webmanifest', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(publicFilesDir, 'site.webmanifest'));
});

app.use('/public', express.static(publicFilesDir));

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        logger.error('Multer Error (GLOBAL):', err.message);
        return res.status(400).json({ message: err.message });
    } else if (err) {
        logger.error('Error desconocido (GLOBAL):', err.message); 
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
    next(); // Si no es un error, pasa al siguiente middleware/ruta
});

// PACIENTES Y FICHA MEDICA
app.use('/api/pacientes', pacientesRoutes);

//LOGIN
app.use('/api/auth', authRoutes);

//DIAGNOSTICOS Y NOMBRESDIAGNOSTICOS
app.use('/api/diagnosticos', diagnosticosRoutes);

//AGENDA
app.use('/api/agenda', agendaRoutes);

//FISIOS
app.use('/api/fisios', fisiosRoutes);

//CALENDARIO
app.use('/api/calendario', calendarioRoutes);

//PARA CUOTAS
app.use('/api/cuotas', cuotasRoutes);

//PARA TARIFAS (ABM de tarifagrupo)
app.use('/api/tarifas', tarifasRoutes);

//PARA USUARIOS (ABM de usuarios: roles fisio/admin)
app.use('/api/usuarios', usuariosRoutes);

//PARA IMAGENES
app.use('/api/public', uploadRoutes);


//Para servir al frontend
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
     res.sendFile(path.join(frontendPath, 'index.html'));
});

// Se definen los middelwares antes y las rutas antes
// para que cuando se empiece a escuchar el servidor, ya estén configurados

app.listen(port, () => {
    logger.log(`Frontend disponible en http://localhost:${port}/index.html`);
});


