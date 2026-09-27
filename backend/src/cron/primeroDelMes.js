const db = require('../db.js');
const  crearLogger  = require('../../plugins/logger.plugin.js');
const { ejecutarConContexto } = require('../../plugins/contexto.plugin.js');
const logger = crearLogger('primeroDelMes.js');


async function generarCuotas(){

    try {

       const [result] = await db.execute(
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
                    AND DATE_FORMAT(CURDATE(), '%Y-%m-01')
                        BETWEEN t2.fechaDesde AND IFNULL(t2.fechaHasta, '9999-12-31')
            LEFT JOIN
                cuota AS c ON t1.idPaciente = c.idPaciente AND MONTH(CURDATE()) = c.mes AND YEAR(CURDATE()) = c.anio
            WHERE
                c.idPaciente IS NULL`,
        );

        const hoy = new Date();
        logger.auditar('CRON_CUOTAS_GENERADAS', { mes: hoy.getMonth() + 1, anio: hoy.getFullYear(), cantidad: result.affectedRows });

    } catch (error) {
        logger.error('Error al generar cuotas mensuales:', error);
    }
}


// Corre con usuario "sistema" para que la auditoría distinga las acciones automáticas.
ejecutarConContexto({ requestId: `cron-cuotas-${Date.now()}`, idUsuario: 'sistema' }, async function main() {
  try {
    await generarCuotas();
    logger.log('Proceso completo.');
  } catch (err) {
    logger.error('Error en proceso principal:', err);
    process.exitCode = 1;
  }
});
