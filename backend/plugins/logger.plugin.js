const winston = require('winston');
require('winston-daily-rotate-file');
const {combine, timestamp, json } = winston.format;

const fileRotateTransport = {
    dirname: 'logs',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m', // Tamaño máximo de cada archivo de log (20 megabytes)
    maxFiles: '14d' // Mantiene los archivos de log por 14 días
};



const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  // defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write all logs with importance level of `error` or higher to `error.log`
    //   (i.e., error, fatal, but not other levels)
    
    new winston.transports.DailyRotateFile({
      ...fileRotateTransport,
      filename: 'logs/error-%DATE%.log',
      level: 'error'
    }),
    //
    // - Write all logs with importance level of `info` or higher to `combined.log`
    //   (i.e., fatal, error, warn, and info, but not trace)
    //
    new winston.transports.File({
      ...fileRotateTransport,
      filename: 'logs/combined-%DATE%.log',
      level: 'info'
    }),
  ],
});

//Para que se vean los logs en la consola
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));



module.exports = function crearLogger(service){
    return {
        log: (message) => {
            logger.log('info', {message, service });
        },
        error: (message) => {
            logger.error('error', {message, service });
        },
        warn: (message) => {
            logger.warn('warn', {message, service });
        },
        debug: (message) => {
            logger.debug('debug', {message, service });
        }
    };
};