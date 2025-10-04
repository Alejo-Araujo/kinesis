const mysql = require('mysql2/promise'); 

const  crearLogger  = require('../plugins/logger.plugin.js');
const logger = crearLogger('db.js');

// const dbConfig = {
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port: process.env.DB_PORT,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// };

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kinesis',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Probar la conexión (opcional, pero buena práctica)
pool.getConnection()
    .then(connection => {
        logger.log('Conectado a la base de datos MariaDB/MySQL con éxito!');
        connection.release(); // Libera la conexión de vuelta al pool
    })
    .catch(err => {
        logger.error('Error al conectar a la base de datos:', err.message);
        // Considera salir del proceso si la conexión a la DB es crítica
        // process.exit(1);
    });

module.exports = pool;