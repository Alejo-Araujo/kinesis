// Diagnóstico de caídas del proceso (lo activa server.js).
//
// Objetivo: que después de una caída en producción quede evidencia de QUÉ pasó, incluso
// cuando el proceso muere sin poder escribir nada (SIGKILL por límite de memoria del
// hosting, reinicio del servidor, etc.). Para eso:
//
//  1. ARRANQUE: datos del entorno (pid, node, memoria disponible, límites, gestor de procesos).
//  2. LATIDO periódico: memoria, CPU, event loop, requests, pool de la base y ping a la base.
//     El último latido antes de una caída muestra el estado en que estaba el proceso.
//  3. estado-proceso.log: se actualiza en cada latido con estado "corriendo". Si al arrancar
//     el anterior sigue en "corriendo", el proceso anterior murió sin registrar su cierre
//     (CAIDA_NO_REGISTRADA) y se informa cuándo fue su último latido y cuánta memoria usaba.
//  4. Señales (SIGTERM/SIGINT/SIGHUP/...), excepciones, promesas rechazadas, salida del
//     proceso y errores de stdout: se escriben de forma SINCRÓNICA en fatal.log (winston
//     escribe async y lo que se loguea justo antes de morir se pierde).
//  5. Requests en curso: si el proceso cae, fatal.log lista qué requests se estaban atendiendo.
//  6. Informes de diagnóstico de Node (process.report) ante errores fatales de V8
//     (p.ej. "JavaScript heap out of memory"), que no pasan por uncaughtException.
const fs = require('fs');
const os = require('os');
const path = require('path');
const v8 = require('v8');
const { monitorEventLoopDelay } = require('perf_hooks');
const crearLogger = require('./logger.plugin.js');

const logger = crearLogger('diagnostico');

const LOG_DIR = crearLogger.LOG_DIR;
const FATAL_LOG = path.join(LOG_DIR, 'fatal.log');
// Extensión .log (contenido JSON) a propósito: nodemon vigila los .json y reiniciaba el proceso
// cada vez que se actualizaba este archivo (bucle de reinicios en desarrollo).
const ESTADO_FILE = path.join(LOG_DIR, 'estado-proceso.log');

const INTERVALO_LATIDO_MS = parseInt(process.env.DIAG_INTERVALO_MS, 10) || 60000;
const REQUEST_LENTO_MS = parseInt(process.env.DIAG_REQUEST_LENTO_MS, 10) || 5000;
const REQUEST_COLGADO_MS = 30000;
const UMBRAL_MEMORIA_PCT = 85;
const UMBRAL_EVENT_LOOP_MS = 1000;

const inicioProceso = new Date();
const esProduccion = (process.env.NODE_ENV || 'development') === 'production';

try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) { /* se informa al escribir */ }

// ---------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------
const mb = bytes => Math.round((bytes / 1024 / 1024) * 10) / 10;
const minutos = ms => Math.round((ms / 60000) * 10) / 10;
const uptimeMin = () => minutos(process.uptime() * 1000);

// Escritura SINCRÓNICA en fatal.log (sobrevive a un process.exit inmediato).
function escribirFatal(titulo, datos) {
    const cuerpo = datos === undefined ? '' : `\n${typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2)}`;
    const bloque = `\n[${new Date().toISOString()}] (pid ${process.pid}) ${titulo}${cuerpo}\n`;
    try {
        fs.appendFileSync(FATAL_LOG, bloque);
    } catch (e) {
        try { process.stderr.write(bloque); } catch (e2) { /* sin salida posible */ }
    }
}

function memoria() {
    const m = process.memoryUsage();
    const limiteHeap = v8.getHeapStatistics().heap_size_limit;
    return {
        rssMB: mb(m.rss),
        heapUsadoMB: mb(m.heapUsed),
        heapTotalMB: mb(m.heapTotal),
        externoMB: mb(m.external),
        heapLimiteMB: mb(limiteHeap),
        heapUsoPct: Math.round((m.heapUsed / limiteHeap) * 100)
    };
}

// Límite de memoria del contenedor/cuenta (cgroups en Linux). null si no se puede leer.
function limiteMemoriaContenedorMB() {
    for (const archivo of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
        try {
            const valor = fs.readFileSync(archivo, 'utf8').trim();
            if (valor !== 'max') {
                const n = Number(valor);
                if (n > 0 && n < 2 ** 60) return mb(n);
            }
        } catch (e) { /* no disponible */ }
    }
    return null;
}

function detectarGestorDeProcesos() {
    const e = process.env;
    const gestores = [];
    if (e.pm_id !== undefined || e.PM2_HOME) gestores.push('pm2');
    if (e.PASSENGER_APP_ENV || e.IN_PASSENGER || e.PASSENGER_BASE_URI) gestores.push('passenger');
    if (e.FOREVER_ROOT) gestores.push('forever');
    if (e.INVOCATION_ID) gestores.push('systemd');
    if (e.IISNODE_VERSION) gestores.push('iisnode');
    if (e.NODEMON || /nodemon/i.test(e.npm_lifecycle_script || '')) gestores.push('nodemon');
    try { if (fs.existsSync('/.dockerenv')) gestores.push('docker'); } catch (e2) { /* nada */ }
    return gestores.length ? gestores : ['ninguno detectado'];
}

function resumenRecursosActivos() {
    if (typeof process.getActiveResourcesInfo !== 'function') return null;
    const conteo = {};
    for (const tipo of process.getActiveResourcesInfo()) conteo[tipo] = (conteo[tipo] || 0) + 1;
    return conteo;
}

// ---------------------------------------------------------------------------------------
// Estado persistente del proceso (para detectar muertes silenciosas)
// ---------------------------------------------------------------------------------------
function guardarEstado(datos) {
    try {
        fs.writeFileSync(ESTADO_FILE, JSON.stringify({
            pid: process.pid,
            inicio: inicioProceso.toISOString(),
            ...datos
        }, null, 2));
    } catch (e) { /* no crítico */ }
}

function revisarEjecucionAnterior() {
    let anterior;
    try {
        anterior = JSON.parse(fs.readFileSync(ESTADO_FILE, 'utf8'));
    } catch (e) {
        return; // primer arranque o archivo ilegible
    }

    if (anterior.estado === 'corriendo') {
        const ultimo = anterior.ultimoLatido ? new Date(anterior.ultimoLatido) : null;
        const datos = {
            pidAnterior: anterior.pid,
            inicioAnterior: anterior.inicio,
            ultimoLatido: anterior.ultimoLatido || null,
            minutosEntreUltimoLatidoYEsteArranque: ultimo ? minutos(Date.now() - ultimo.getTime()) : null,
            minutosQueEstuvoCorriendo: anterior.uptimeMin ?? null,
            memoriaEnElUltimoLatido: anterior.memoria || null,
            requestsEnCursoEnElUltimoLatido: anterior.enCurso || [],
            causasProbables: [
                'SIGKILL del hosting por superar el límite de memoria/CPU/procesos de la cuenta',
                'reinicio o apagado del servidor',
                'el hosting terminó el proceso sin aviso (kill -9)'
            ]
        };
        const mensaje = 'CAIDA_NO_REGISTRADA: la ejecución anterior terminó sin registrar su cierre (sin señal ni excepción capturable).'
            + (esProduccion ? '' : ' En desarrollo suele ser un reinicio de nodemon en Windows (mata el proceso sin señal).');
        if (esProduccion) {
            escribirFatal(mensaje, datos);
            logger.error(mensaje, datos);
        } else {
            logger.warn(mensaje, datos); // en desarrollo no se ensucia fatal.log con cada reinicio de nodemon
        }
    } else if (anterior.estado === 'detenido') {
        logger.info(`La ejecución anterior (pid ${anterior.pid}) se cerró registrando el motivo: ${anterior.motivo}`);
    }
}

// ---------------------------------------------------------------------------------------
// Requests en curso y estadísticas HTTP
// ---------------------------------------------------------------------------------------
const enCurso = new Map();
let stats = nuevasStats();

function nuevasStats() {
    return { requests: 0, errores5xx: 0, errores4xx: 0, abortados: 0, lentos: 0, masLentoMs: 0, masLento: null };
}

function listaEnCurso(max = 20) {
    const ahora = Date.now();
    return [...enCurso.values()]
        .sort((a, b) => a.inicio - b.inicio)
        .slice(0, max)
        .map(r => ({ metodo: r.metodo, ruta: r.ruta, idUsuario: r.contexto.idUsuario, requestId: r.contexto.requestId, segundos: Math.round((ahora - r.inicio) / 1000) }));
}

// Se llama desde el middleware de acceso de server.js (req.contexto ya existe).
function rastrearRequest(req, res) {
    const ctx = req.contexto;
    const registro = { metodo: req.method, ruta: req.originalUrl, contexto: ctx, inicio: Date.now() };
    enCurso.set(ctx.requestId, registro);
    let terminado = false;

    const finalizar = (status) => {
        enCurso.delete(ctx.requestId);
        const ms = Date.now() - registro.inicio;
        stats.requests++;
        if (status >= 500) stats.errores5xx++;
        else if (status >= 400) stats.errores4xx++;
        if (ms > stats.masLentoMs) {
            stats.masLentoMs = ms;
            stats.masLento = `${req.method} ${req.originalUrl}`;
        }
        if (ms >= REQUEST_LENTO_MS) {
            stats.lentos++;
            logger.registrar('warn', `REQUEST_LENTO: ${req.method} ${req.originalUrl} tardó ${ms} ms`, {
                requestId: ctx.requestId, idUsuario: ctx.idUsuario, duracionMs: ms, status
            });
        }
    };

    res.on('finish', () => {
        terminado = true;
        finalizar(res.statusCode);
    });
    res.on('close', () => {
        if (terminado) return;
        // El cliente cortó la conexión antes de recibir la respuesta.
        stats.abortados++;
        const ms = Date.now() - registro.inicio;
        const nivel = ms >= REQUEST_LENTO_MS ? 'warn' : 'debug';
        logger.registrar(nivel, `Request abortado por el cliente antes de responder: ${req.method} ${req.originalUrl} (${ms} ms)`, {
            requestId: ctx.requestId, idUsuario: ctx.idUsuario, duracionMs: ms
        });
        finalizar(null);
    });
}

// ---------------------------------------------------------------------------------------
// Latido periódico
// ---------------------------------------------------------------------------------------
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();
let cpuAnterior = process.cpuUsage();
let momentoAnterior = Date.now();
const recursos = { server: null, pool: null };

function infoPool(pool) {
    try {
        const core = pool.pool || pool;
        return {
            conexiones: core._allConnections.length,
            libres: core._freeConnections.length,
            enCola: core._connectionQueue.length,
            limite: core.config.connectionLimit
        };
    } catch (e) {
        return null;
    }
}

function conTimeout(promesa, ms) {
    return Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(new Error(`sin respuesta en ${ms} ms`)), ms))]);
}

async function latido() {
    if (cerrando) return;
    try {
        const ahora = Date.now();
        const cpu = process.cpuUsage(cpuAnterior);
        const transcurrido = ahora - momentoAnterior;
        cpuAnterior = process.cpuUsage();
        momentoAnterior = ahora;

        const loop = {
            p50Ms: Math.round(eventLoop.percentile(50) / 1e6),
            p99Ms: Math.round(eventLoop.percentile(99) / 1e6),
            maxMs: Math.round(eventLoop.max / 1e6)
        };
        eventLoop.reset();

        const db = { ...(recursos.pool ? infoPool(recursos.pool) : {}) };
        if (recursos.pool) {
            const t0 = Date.now();
            try {
                await conTimeout(recursos.pool.query('SELECT 1'), 5000);
                db.pingMs = Date.now() - t0;
            } catch (e) {
                db.error = `${e.code || ''} ${e.message}`.trim();
            }
        }

        let conexionesHttp = null;
        if (recursos.server) {
            conexionesHttp = await new Promise(resolve => recursos.server.getConnections((err, n) => resolve(err ? null : n)));
        }

        const pendientes = listaEnCurso(10);
        const mem = memoria();
        const datos = {
            uptimeMin: uptimeMin(),
            memoria: mem,
            cpuPct: transcurrido > 0 ? Math.round(((cpu.user + cpu.system) / 1000 / transcurrido) * 100) : null,
            eventLoop: loop,
            http: { ...stats, enCurso: enCurso.size, conexionesAbiertas: conexionesHttp },
            db,
            sistema: { memoriaLibreMB: mb(os.freemem()), cargaPromedio: os.loadavg().map(n => Math.round(n * 100) / 100) },
            recursosActivos: resumenRecursosActivos()
        };
        logger.info('LATIDO', datos);
        stats = nuevasStats();

        // Si el proceso empezó a cerrarse mientras se medía, no pisar el estado "detenido".
        if (cerrando) return;
        guardarEstado({ estado: 'corriendo', ultimoLatido: new Date().toISOString(), uptimeMin: datos.uptimeMin, memoria: mem, enCurso: pendientes });

        // Alertas
        if (mem.heapUsoPct >= UMBRAL_MEMORIA_PCT) {
            logger.warn(`MEMORIA_ALTA: el heap usa el ${mem.heapUsoPct}% de su límite (${mem.heapUsadoMB}/${mem.heapLimiteMB} MB)`, mem);
        }
        const limiteCont = limiteMemoriaContenedorMB();
        if (limiteCont && mem.rssMB >= limiteCont * UMBRAL_MEMORIA_PCT / 100) {
            logger.warn(`MEMORIA_ALTA: el proceso usa ${mem.rssMB} MB de un límite de ${limiteCont} MB del contenedor`, mem);
        }
        if (loop.p99Ms >= UMBRAL_EVENT_LOOP_MS) {
            logger.warn(`EVENT_LOOP_BLOQUEADO: el 1% de las veces el proceso estuvo bloqueado ${loop.p99Ms} ms o más (máx ${loop.maxMs} ms)`, loop);
        }
        if (db.error) {
            logger.error(`BASE_DE_DATOS_NO_RESPONDE: ${db.error}`, db);
        } else if (db.enCola > 0) {
            logger.warn(`POOL_DB_SATURADO: ${db.enCola} pedido(s) esperando conexión (${db.conexiones}/${db.limite} en uso)`, db);
        }
        const colgados = pendientes.filter(r => r.segundos * 1000 >= REQUEST_COLGADO_MS);
        if (colgados.length) {
            logger.warn(`REQUESTS_COLGADOS: ${colgados.length} request(s) llevan más de ${REQUEST_COLGADO_MS / 1000} s sin responder`, { colgados });
        }
    } catch (e) {
        logger.error('Error al registrar el latido de diagnóstico:', e);
    }
}

// ---------------------------------------------------------------------------------------
// Cierre del proceso
// ---------------------------------------------------------------------------------------
let cerrando = false;
let motivoCierre = null;
let temporizadorLatido = null;

function cerrarOrdenadamente(motivo, codigo = 0) {
    if (cerrando) return;
    cerrando = true;
    motivoCierre = motivo;
    clearInterval(temporizadorLatido);

    const datos = { motivo, uptimeMin: uptimeMin(), memoria: memoria(), requestsEnCurso: listaEnCurso() };
    escribirFatal(`CIERRE: ${motivo}`, datos);
    logger.warn(`CIERRE del proceso: ${motivo}`, datos);
    guardarEstado({ estado: 'detenido', motivo, fin: new Date().toISOString(), uptimeMin: datos.uptimeMin });

    // Si algo queda colgado, se fuerza la salida.
    setTimeout(() => process.exit(codigo), 8000).unref();

    const terminarPool = () => {
        if (!recursos.pool) return process.exit(codigo);
        recursos.pool.end().catch(() => {}).finally(() => process.exit(codigo));
    };
    if (recursos.server) {
        recursos.server.close(terminarPool); // deja de aceptar conexiones y espera las que están en curso
        if (typeof recursos.server.closeIdleConnections === 'function') recursos.server.closeIdleConnections();
    } else {
        terminarPool();
    }
}

// ---------------------------------------------------------------------------------------
// Manejadores de proceso: se instalan AL PRINCIPIO de server.js, antes de cargar rutas.
// ---------------------------------------------------------------------------------------
let instalados = false;

function instalarManejadoresDeProceso() {
    if (instalados) return;
    instalados = true;

    // Informe de diagnóstico de Node ante errores fatales de V8 (p.ej. "heap out of memory"):
    // esos errores NO pasan por uncaughtException; el informe queda en LOG_DIR/report.*.json.
    try {
        if (process.report) {
            process.report.directory = LOG_DIR;
            process.report.reportOnFatalError = true;
        }
    } catch (e) { /* versión sin process.report */ }

    // Señales de terminación: se registran y se cierra ordenadamente.
    // SIGUSR2 es la que usa nodemon para reiniciar.
    for (const senal of ['SIGTERM', 'SIGINT', 'SIGQUIT', 'SIGUSR2', 'SIGBREAK']) {
        try {
            process.on(senal, () => cerrarOrdenadamente(`señal ${senal} recibida (${describirSenal(senal)})`, 0));
        } catch (e) { /* señal no soportada en esta plataforma */ }
    }

    // SIGHUP = se cerró la terminal/sesión SSH desde la que se lanzó el proceso. Por defecto
    // Node se cierra; acá se registra y el servidor SIGUE corriendo.
    try {
        process.on('SIGHUP', () => {
            const texto = 'SIGHUP recibida: se cerró la terminal o la sesión SSH desde la que se arrancó el proceso. '
                + 'El servidor sigue corriendo (sin este manejador se habría cerrado).';
            escribirFatal(texto, { uptimeMin: uptimeMin() });
            logger.warn(texto);
        });
    } catch (e) { /* no soportada */ }

    // Excepción no capturada: estado posiblemente corrupto -> se registra todo y se sale.
    process.on('uncaughtException', (err, origen) => {
        const datos = {
            error: err && err.message, codigo: err && err.code, origen,
            stack: err && err.stack, uptimeMin: uptimeMin(), memoria: memoria(), requestsEnCurso: listaEnCurso()
        };
        escribirFatal('EXCEPCION_NO_CAPTURADA: el proceso se cierra', datos);
        logger.error('EXCEPCION_NO_CAPTURADA: el proceso se cierra', datos);
        if (!cerrando) {
            cerrando = true;
            clearInterval(temporizadorLatido);
            motivoCierre = `uncaughtException: ${err && err.message}`;
            guardarEstado({ estado: 'detenido', motivo: motivoCierre, fin: new Date().toISOString(), uptimeMin: datos.uptimeMin });
            // Un segundo para que winston vuelque a disco antes de salir.
            setTimeout(() => process.exit(1), 1000);
        }
    });

    // Promesa rechazada sin manejar: se registra y el servidor SIGUE corriendo (antes se cerraba).
    process.on('unhandledRejection', (razon) => {
        const err = razon instanceof Error ? razon : new Error(String(razon));
        const datos = { error: err.message, codigo: err.code, stack: err.stack, uptimeMin: uptimeMin() };
        escribirFatal('PROMESA_RECHAZADA_SIN_MANEJAR (el servidor sigue corriendo)', datos);
        logger.error('PROMESA_RECHAZADA_SIN_MANEJAR (el servidor sigue corriendo)', datos);
    });

    // Advertencias de Node (MaxListenersExceeded, APIs obsoletas, memoria, etc.).
    process.on('warning', (w) => {
        logger.warn(`Advertencia de Node: ${w.name}: ${w.message}`, { stack: w.stack });
    });

    // stdout/stderr rotos (terminal cerrada, pipe del hosting cerrado): sin manejador, el
    // próximo log por consola lanza EPIPE/EIO y tumba el proceso.
    for (const [nombre, stream] of [['stdout', process.stdout], ['stderr', process.stderr]]) {
        let avisado = false;
        stream.on('error', (err) => {
            crearLogger.desactivarConsola();
            if (avisado) return;
            avisado = true;
            const texto = `Error al escribir en ${nombre} (${err.code}): la consola dejó de estar disponible. `
                + 'Se desactiva el log por consola; los archivos de log siguen funcionando.';
            escribirFatal(texto);
            logger.error(texto);
        });
    }

    // Salida del proceso (cualquier motivo que permita ejecutar JS).
    process.on('exit', (codigo) => {
        escribirFatal(`SALIDA del proceso con código ${codigo}${motivoCierre ? ` (${motivoCierre})` : ''} tras ${uptimeMin()} min`);
        if (!cerrando) {
            guardarEstado({ estado: 'detenido', motivo: `exit con código ${codigo}`, fin: new Date().toISOString(), uptimeMin: uptimeMin() });
        }
    });
}

function describirSenal(senal) {
    return {
        SIGTERM: 'pedido de terminación: hosting, gestor de procesos o kill',
        SIGINT: 'Ctrl+C en la terminal',
        SIGQUIT: 'pedido de salida desde la terminal',
        SIGUSR2: 'reinicio de nodemon',
        SIGBREAK: 'Ctrl+Break / cierre de consola en Windows'
    }[senal] || senal;
}

// ---------------------------------------------------------------------------------------
// Arranque: se llama justo después de app.listen(). El manejador de errores del servidor se
// engancha en el momento (si el puerto está ocupado, 'listening' nunca ocurre); el resto
// (estado, ARRANQUE, latido) recién cuando el puerto quedó tomado, para no pisar el estado
// de otra instancia que ya esté corriendo.
// ---------------------------------------------------------------------------------------
function iniciarDiagnostico({ server, pool, puerto }) {
    recursos.pool = pool;

    // Errores del servidor HTTP (p.ej. puerto ocupado por otra instancia).
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const texto = `El puerto ${puerto} ya está en uso: probablemente hay otra instancia de la aplicación corriendo. Esta instancia se cierra.`;
            escribirFatal(texto, { error: err.message });
            logger.error(texto);
            cerrando = true; // no tocar estado-proceso.log: pertenece a la instancia que está corriendo
            motivoCierre = 'puerto en uso';
            setTimeout(() => process.exit(1), 500);
        } else {
            logger.error('Error del servidor HTTP:', err);
        }
    });

    server.once('listening', () => arrancar(server, puerto));
}

function arrancar(server, puerto) {
    recursos.server = server;

    revisarEjecucionAnterior();

    const gestores = detectarGestorDeProcesos();
    const datos = {
        pid: process.pid,
        ppid: process.ppid,
        node: process.version,
        plataforma: `${process.platform} ${process.arch}`,
        host: os.hostname(),
        entorno: process.env.NODE_ENV || 'development',
        puerto,
        cwd: process.cwd(),
        comando: process.argv.join(' '),
        opcionesNode: process.execArgv,
        gestorDeProcesos: gestores,
        iniciadoDesdeTerminal: !!process.stdout.isTTY,
        cpus: os.cpus().length,
        memoriaSistemaMB: { total: mb(os.totalmem()), libre: mb(os.freemem()) },
        limiteMemoriaContenedorMB: limiteMemoriaContenedorMB(),
        memoria: memoria(),
        uptimeSistemaHoras: Math.round(os.uptime() / 3600 * 10) / 10,
        zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
        servidorHttp: {
            requestTimeoutMs: server.requestTimeout,
            headersTimeoutMs: server.headersTimeout,
            keepAliveTimeoutMs: server.keepAliveTimeout
        },
        latidoCadaSeg: INTERVALO_LATIDO_MS / 1000,
        logDir: LOG_DIR
    };
    logger.info('ARRANQUE', datos);
    escribirFatal(`ARRANQUE (node ${process.version}, puerto ${puerto}, ppid ${process.ppid}, gestor: ${gestores.join(', ')})`);

    if (datos.iniciadoDesdeTerminal && esProduccion) {
        logger.warn('El proceso se inició desde una terminal interactiva: al cerrar la sesión SSH recibe SIGHUP. '
            + 'Conviene arrancarlo con un gestor de procesos (pm2) o el administrador de Node del hosting.');
    }
    if (gestores[0] === 'ninguno detectado' && esProduccion) {
        logger.warn('No se detectó un gestor de procesos (pm2, passenger, systemd...): si el proceso se cae, nadie lo vuelve a levantar.');
    }

    guardarEstado({ estado: 'corriendo', ultimoLatido: new Date().toISOString(), uptimeMin: uptimeMin(), memoria: memoria(), enCurso: [] });
    temporizadorLatido = setInterval(latido, INTERVALO_LATIDO_MS);
    temporizadorLatido.unref();
}

module.exports = {
    instalarManejadoresDeProceso,
    iniciarDiagnostico,
    rastrearRequest,
    escribirFatal
};
