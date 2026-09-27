const path = require('path');

// Carga de variables de entorno desde backend/.env con ruta ABSOLUTA:
// funciona igual con nodemon, con `node` directo o en produccion, sin depender del cwd.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Entorno de ejecucion (development | production): se define con NODE_ENV en el .env y queda
// registrado en el log de ARRANQUE (plugins/diagnostico.plugin.js).

const  crearLogger  = require('../plugins/logger.plugin.js');
const { contextoRequest } = require('../plugins/contexto.plugin.js');
const diagnostico = require('../plugins/diagnostico.plugin.js');
const logger = crearLogger('server.js');
const loggerHttp = crearLogger('http');

// DIAGNÓSTICO DE CAÍDAS: señales, excepciones no capturadas, promesas rechazadas, salida del
// proceso y errores de stdout -> fatal.log (sincrónico) + logs. Se instala ANTES de cargar el
// resto de los módulos para registrar también un error al cargarlos. Ver plugins/diagnostico.plugin.js.
diagnostico.instalarManejadoresDeProceso();

const express = require('express');
const app = express();
app.disable('x-powered-by');
// El puerto se toma de la variable de entorno PORT (ej: 3000 en desarrollo, 50001 en produccion).
const port = process.env.PORT || 3000;
const crypto = require('crypto');

const db = require('./db.js');
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

const multer = require('multer');

const publicFilesDir = path.join(__dirname, '..', '..', 'public');


app.use(express.static(path.join(__dirname, 'public')));

// LOG DE ACCESO de la API: una línea por request con usuario, método, ruta, código y duración.
// Se registra ANTES de express.json() para incluir también los requests con JSON malformado.
app.use('/api', (req, res, next) => {
    const inicio = process.hrtime.bigint();
    req.contexto = { requestId: crypto.randomUUID(), idUsuario: null, ip: req.ip };
    res.setHeader('X-Request-Id', req.contexto.requestId);

    // Requests en curso (si el proceso cae se listan en fatal.log), lentos y abortados.
    diagnostico.rastrearRequest(req, res);

    res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
        const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        loggerHttp.registrar(nivel, `${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(0)} ms)`, {
            acceso: true,
            requestId: req.contexto.requestId,
            idUsuario: req.contexto.idUsuario,
            ip: req.contexto.ip,
            metodo: req.method,
            ruta: req.originalUrl,
            status: res.statusCode,
            duracionMs: Math.round(ms)
        });
    });
    next();
});

app.use(express.json());

// CONTEXTO del request (requestId + usuario) para todos los logs que se emitan durante
// el request. Va después de express.json(): el parser del body pierde el contexto async.
app.use('/api', (req, res, next) => {
    contextoRequest.run(req.contexto, next);
});

app.get('/public/site.webmanifest', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(publicFilesDir, 'site.webmanifest'));
});

app.use('/public', express.static(publicFilesDir));

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

// Cualquier otra ruta /api inexistente responde 404 JSON (no el index.html del SPA).
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Recurso no encontrado.' });
});


//Para servir al frontend
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
     res.sendFile(path.join(frontendPath, 'index.html'));
});

// Manejador global de errores: va DESPUÉS de las rutas para recibir lo que derivan
// express.json() (JSON malformado), multer y asyncHandler (excepciones de los controllers).
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    // Datos del request explícitos: el contexto async puede no estar disponible aquí.
    const ctx = req.contexto || {};
    const campos = { requestId: ctx.requestId, idUsuario: ctx.idUsuario ?? null };
    if (err instanceof multer.MulterError) {
        logger.registrar('warn', `Multer Error (GLOBAL) en ${req.method} ${req.originalUrl}: ${err.message}`, campos);
        return res.status(400).json({ message: err.message });
    }
    if (err.type === 'entity.parse.failed') {
        logger.registrar('warn', `JSON malformado en ${req.method} ${req.originalUrl}: ${err.message}`, campos);
        return res.status(400).json({ message: 'El cuerpo de la solicitud no es un JSON válido.' });
    }
    logger.registrar('error', `Error no controlado en ${req.method} ${req.originalUrl}: ${err.message}`, { ...campos, stack: err.stack, codigo: err.code });
    return res.status(500).json({ message: 'Error interno del servidor.' });
});

// Se definen los middelwares antes y las rutas antes
// para que cuando se empiece a escuchar el servidor, ya estén configurados

const server = app.listen(port, () => {
    logger.log(`Frontend disponible en http://localhost:${port}/index.html`);
});

// ARRANQUE + LATIDO periódico (memoria, CPU, event loop, requests, pool y ping a la base),
// detección de caídas no registradas de la ejecución anterior, puerto ocupado y cierre
// ordenado (cierra el servidor y el pool) ante SIGTERM/SIGINT.
diagnostico.iniciarDiagnostico({ server, pool: db, puerto: port });


