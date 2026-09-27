const db = require('../db.js');
const  crearLogger  = require('../../plugins/logger.plugin.js');
const { ejecutarConContexto } = require('../../plugins/contexto.plugin.js');
const logger = crearLogger('primeroDelMes2.js');

async function sacarDeGrupoPaciente(){

    try {
        // Pacientes afectados (para la auditoría): cuota del mes anterior atrasada y con grupos vigentes.
        const [afectados] = await db.execute(
            `SELECT DISTINCT gp.idPaciente
            FROM grupopaciente gp
            WHERE gp.fechaBaja IS NULL AND gp.idPaciente IN (
                SELECT idPaciente
                FROM view_cuota_estado
                WHERE estado = 'Atrasada'
                AND mes = MONTH(CURDATE() - INTERVAL 1 MONTH)
                AND anio = YEAR(CURDATE() - INTERVAL 1 MONTH)
            )`
        );

        const [result] = await db.execute(
            `UPDATE grupopaciente
            SET fechaBaja = CURDATE()
            WHERE fechaBaja IS NULL AND idPaciente IN (
                SELECT idPaciente
                FROM view_cuota_estado
                WHERE estado = 'Atrasada'
                AND mes = MONTH(CURDATE() - INTERVAL 1 MONTH)
                AND anio = YEAR(CURDATE() - INTERVAL 1 MONTH)
            );`,
        );

        logger.auditar('CRON_PACIENTES_SACADOS_POR_DEUDA', {
            pacientes: afectados.map(a => a.idPaciente),
            cantidadPacientes: afectados.length,
            inscripcionesDadasDeBaja: result.affectedRows
        });

    } catch (error) {
        logger.error('Error al sacar a los pacientes atrasados de los grupos:', error);
    }
}

async function inActivarPaciente(){
    try {
        const [result] = await db.execute(`
            UPDATE paciente p
            SET p.activo = 0
            WHERE p.activo = 1
              AND (SELECT COUNT(*) FROM grupopaciente gp WHERE gp.idPaciente = p.id AND gp.fechaBaja IS NULL) = 0
            `,
        );
        logger.auditar('CRON_PACIENTES_INACTIVADOS', { cantidad: result.affectedRows });

    } catch (error) {
        logger.error('Error al inactivar pacientes sin grupos:', error);
    }
}

// Corre con usuario "sistema" para que la auditoría distinga las acciones automáticas.
ejecutarConContexto({ requestId: `cron-deuda-${Date.now()}`, idUsuario: 'sistema' }, async function main() {
  try {
    await sacarDeGrupoPaciente();
    await inActivarPaciente();
    logger.log('Proceso completo.');
  } catch (err) {
    logger.error('Error en proceso principal:', err);
    process.exitCode = 1;
  }
});
