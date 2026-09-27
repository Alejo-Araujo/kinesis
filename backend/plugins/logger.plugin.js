const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const { obtenerContexto } = require('./contexto.plugin.js');

const { combine, timestamp, json, printf } = winston.format;

// Directorio ÚNICO y absoluto para todos los logs (antes era relativo al cwd y se
// repartían en logs/, backend/logs/ y backend/src/logs/). Se puede cambiar con LOG_DIR.
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');

// Nivel mínimo: info por defecto; LOG_LEVEL=debug para más detalle.
const NIVEL = process.env.LOG_LEVEL || 'info';

// Agrega a cada entrada el requestId y el usuario del request en curso (si hay contexto
// y no vinieron explícitos en la entrada).
const conContexto = winston.format((info) => {
    const ctx = obtenerContexto();
    if (ctx) {
        if (info.requestId === undefined) info.requestId = ctx.requestId;
        if (info.idUsuario === undefined) info.idUsuario = ctx.idUsuario ?? null;
    }
    return info;
});

// Sólo deja pasar eventos de auditoría (archivo auditoria-*.log).
const soloAuditoria = winston.format((info) => (info.auditoria ? info : false));

// Archivo con rotación diaria real (el transporte anterior no reemplazaba %DATE%
// y escribía siempre en un archivo llamado literalmente "combined-%DATE%.log").
function archivoRotativo(nombre, level, maxFiles, format) {
    return new winston.transports.DailyRotateFile({
        dirname: LOG_DIR,
        filename: `${nombre}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles,
        level,
        ...(format ? { format } : {})
    });
}

// Consola legible: "2026-09-26 22:40:01 info [pacientesController.js] (usuario 1) mensaje {detalles}"
const formatoConsola = printf((info) => {
    const usuario = info.idUsuario !== undefined && info.idUsuario !== null ? ` (usuario ${info.idUsuario})` : '';
    const detalles = info.detalles ? ` ${JSON.stringify(info.detalles)}` : '';
    const stack = info.stack ? `\n${info.stack}` : '';
    return `${info.timestamp} ${info.level} [${info.service || '-'}]${usuario} ${info.message}${detalles}${stack}`;
});

// Consola (la ve nodemon / el hosting).
const consola = new winston.transports.Console({ format: formatoConsola });

const logger = winston.createLogger({
    level: NIVEL,
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        conContexto(),
        json()
    ),
    transports: [
        // Todo lo que sea info o más (incluye el log de acceso y la auditoría).
        archivoRotativo('combined', NIVEL, '30d'),
        // Sólo errores.
        archivoRotativo('error', 'error', '90d'),
        // Sólo auditoría: quién hizo qué. Retención larga.
        archivoRotativo('auditoria', 'info', '365d', soloAuditoria()),
        consola
    ]
});

// Deja de escribir en consola (se usa si stdout se rompe, p.ej. al cerrarse la sesión SSH
// desde la que se arrancó el proceso: seguir escribiendo ahí provocaba errores EPIPE/EIO).
let consolaActiva = true;
function desactivarConsola() {
    if (consolaActiva) {
        consolaActiva = false;
        logger.remove(consola);
    }
}

// Arma la entrada a partir de (mensaje, extra):
//  - extra Error  -> se agrega su mensaje y su stack (antes se perdía la causa).
//  - extra objeto -> va en `detalles`.
//  - extra string/número -> se concatena al mensaje.
function normalizar(mensaje, extra) {
    const entrada = {};
    if (mensaje instanceof Error) {
        entrada.message = mensaje.message;
        entrada.stack = mensaje.stack;
        if (mensaje.code) entrada.codigo = mensaje.code;
    } else {
        entrada.message = String(mensaje);
    }

    if (extra instanceof Error) {
        entrada.message = `${entrada.message} ${extra.message}`.trim();
        entrada.stack = extra.stack;
        if (extra.code) entrada.codigo = extra.code;
    } else if (extra !== undefined && extra !== null) {
        if (typeof extra === 'object') {
            entrada.detalles = extra;
        } else {
            entrada.message = `${entrada.message} ${extra}`.trim();
        }
    }
    return entrada;
}

function crearLogger(service) {
    const emitir = (level, mensaje, extra) => logger.log({ level, service, ...normalizar(mensaje, extra) });

    return {
        log: (mensaje, extra) => emitir('info', mensaje, extra),
        info: (mensaje, extra) => emitir('info', mensaje, extra),
        warn: (mensaje, extra) => emitir('warn', mensaje, extra),
        error: (mensaje, extra) => emitir('error', mensaje, extra),
        debug: (mensaje, extra) => emitir('debug', mensaje, extra),

        // Evento de auditoría: una acción de un usuario (quién, qué y sobre qué).
        // El usuario y el requestId se toman del contexto del request.
        // No incluir contraseñas, tokens ni contenido clínico en `detalles`.
        auditar: (accion, detalles = {}, level = 'info') => logger.log({
            level,
            service,
            auditoria: true,
            accion,
            message: accion,
            detalles
        }),

        // Entrada con campos en la raíz (p.ej. el log de acceso, que se emite al terminar
        // la respuesta y pasa requestId/idUsuario explícitos).
        registrar: (level, mensaje, campos = {}) => logger.log({ level, service, message: mensaje, ...campos })
    };
}

crearLogger.LOG_DIR = LOG_DIR;
crearLogger.desactivarConsola = desactivarConsola;

module.exports = crearLogger;
