const mysql = require('mysql2/promise');

const  crearLogger  = require('../plugins/logger.plugin.js');
const logger = crearLogger('db.js');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};


const pool = mysql.createPool(dbConfig);

// ---- Diagnóstico del pool ----------------------------------------------------------------

// Cada conexión física nueva. Si el servidor MySQL la corta (wait_timeout, reinicio, red),
// queda registrado; el listener además evita que un segundo 'error' en la misma conexión
// quede sin manejar y tumbe el proceso.
pool.on('connection', (conexion) => {
    logger.debug(`Nueva conexión a la base de datos (threadId ${conexion.threadId}).`);
    conexion.on('error', (err) => {
        logger.warn(`Conexión a la base de datos perdida (threadId ${conexion.threadId}, ${err.code}): ${err.message}`);
    });
});

// Un pedido tuvo que esperar porque las 10 conexiones estaban ocupadas (máx. 1 aviso por minuto).
let ultimoAvisoCola = 0;
pool.on('enqueue', () => {
    if (Date.now() - ultimoAvisoCola < 60000) return;
    ultimoAvisoCola = Date.now();
    const core = pool.pool;
    logger.warn(`POOL_DB_SATURADO: no hay conexiones libres, los pedidos esperan en cola `
        + `(${core._allConnections.length}/${dbConfig.connectionLimit} en uso, ${core._connectionQueue.length} en cola).`);
});

// Prueba de conexión al arrancar + datos del servidor MySQL útiles para diagnosticar caídas
// (versión y límites de conexiones / tiempo de inactividad).
pool.getConnection()
    .then(async (connection) => {
        try {
            const [[info]] = await connection.query(
                `SELECT VERSION() AS version, @@wait_timeout AS waitTimeoutSeg,
                        @@max_connections AS maxConnections, @@max_user_connections AS maxUserConnections`
            );
            logger.log('Conectado a la base de datos MariaDB/MySQL con éxito!', {
                host: dbConfig.host, base: dbConfig.database, puerto: dbConfig.port,
                limiteConexionesPool: dbConfig.connectionLimit, ...info
            });
        } finally {
            connection.release(); // Libera la conexión de vuelta al pool
        }
    })
    .catch(err => {
        logger.error(`Error al conectar a la base de datos (${dbConfig.host}/${dbConfig.database}):`, err);
        // Considera salir del proceso si la conexión a la DB es crítica
        // process.exit(1);
    });

module.exports = pool;
