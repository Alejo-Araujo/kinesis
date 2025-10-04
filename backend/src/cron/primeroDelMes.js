const db = require('../db.js');
const  crearLogger  = require('../../plugins/logger.plugin.js');
const logger = crearLogger('primeroDelMes.js');


async function generarCuotas(){

    try {

       await db.execute(
            `INSERT INTO cuota (idPaciente, mes, anio, monto, montoDescuento, fechaBaja, fechaPago)
            SELECT
                t1.idPaciente,
                MONTH(CURDATE()),
                YEAR(CURDATE()),
                COALESCE(t2.monto, 0),
                COALESCE(t2.monto, 0),
                NULL,
                NULL
            FROM
                (SELECT idPaciente, COUNT(*) AS cantidad_dias FROM grupopaciente WHERE fechaBaja IS NULL GROUP BY idPaciente) AS t1
            LEFT JOIN
                tarifagrupo AS t2 ON t1.cantidad_dias = t2.cantidadDias
            LEFT JOIN
                cuota AS c ON t1.idPaciente = c.idPaciente AND MONTH(CURDATE()) = c.mes AND YEAR(CURDATE()) = c.anio
            WHERE
                c.idPaciente IS NULL`,
        );

    } catch (error) {
        logger.error('Error al generar cuotas mensuales:', error.message);
        logger.error(error.stack);
    }
}

(async function main() {
  try {
    await generarCuotas();
    logger.log('Proceso completo.');
  } catch (err) {
    logger.error('Error en proceso principal:', err);
    process.exitCode = 1;
  }
})();
