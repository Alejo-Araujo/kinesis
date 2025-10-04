//require('dotenv').config({ path: '../.env' }); //PARA EJECUTARLO MANUALMENTE / DESARROLLO
require('dotenv').config({ path: './.env' }); //PARA EJECUTARLO CON NODEMON / DESARROLLO

console.log('DB_HOST:', process.env.DB_HOST); //DESARROLLO
console.log('DB_USER:', process.env.DB_USER); //DESARROLLO
const express = require('express');
const app = express();
app.disable('x-powered-by');
const port = process.env.PORT || 3000; //DESARROLLO 
//const port = 50001; PRODUCCION
const path = require('path');


const diagnosticosRoutes = require('./routes/diagnosticosRoutes.js')
const pacientesRoutes = require('./routes/pacientesRoutes');
const authRoutes = require('./routes/authRoutes.js');
const agendaRoutes = require('./routes/agendaRoutes.js');
const uploadRoutes = require('./routes/uploadRoutes.js');
const fisiosRoutes = require('./routes/fisiosRoutes.js');
const calendarioRoutes = require('./routes/calendarioRoutes.js');
const cuotasRoutes = require('./routes/cuotasRoutes.js')

const  crearLogger  = require('../plugins/logger.plugin.js');
const logger = crearLogger('server.js');


const fs = require('fs');     
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

