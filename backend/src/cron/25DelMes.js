const db = require('../db.js');
const  crearLogger  = require('../../plugins/logger.plugin.js');
const logger = crearLogger('primeroDelMes.js');

async function sacarDeGrupoPaciente(){
    
    try {

        await db.execute(
            `UPDATE grupopaciente
            SET fechaBaja = CURDATE()
            WHERE fechaBaja IS NULL AND idPaciente IN (
                SELECT idPaciente
                FROM view_cuota_estado
                WHERE
                    estado = 'Atrasada'
            );`,
        );

    } catch (error) {
        logger.error('Error al sacar a los pacientes atrasados de los grupos:', error.message);
        logger.error(error.stack);
    }
}

async function inActivarPaciente(){
    try { 
        await db.execute(`
            UPDATE paciente p
            SET p.activo = 0
            WHERE (SELECT COUNT(*) FROM grupopaciente gp WHERE gp.idPaciente = p.id AND gp.fechaBaja IS NULL) = 0
            `, 
        );
    
    } catch (error) {
        logger.error('Error al inactivar pacientes sin grupos:', error.message);
        logger.error(error.stack);
    }
}

(async function main() {
  try {
    await sacarDeGrupoPaciente();
    await inActivarPaciente();
    logger.log('Proceso completo.');
  } catch (err) {
    logger.error('Error en proceso principal:', err);
    process.exitCode = 1;
  }
})();
