// Generación de la cuota del mes en curso de un paciente a partir de sus grupos vigentes.
// Lo usan la agenda (agregar paciente a un grupo) y la restauración de grupos.
const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('utils/cuotas.js');

// Día de corte: desde el 25 la cuota del mes se considera atrasada (ver view_cuota_estado),
// por eso a partir de ese día no se generan cuotas nuevas al inscribir a un paciente.
const DIA_CORTE_CUOTA = 25;

// Regla: los grupos sólo intervienen en la cuota cuando el paciente NO tiene ninguna cuota
// de ese mes (en ningún estado) y todavía no se llegó al día de corte. En ese caso se genera
// con la tarifa vigente para su cantidad de grupos.
// Una vez dada de alta, la cuota del mes NO se modifica por cambios en los grupos
// (agregar, sacar o restaurar grupos no toca monto, pago ni estado).
async function generarCuotaDelMesSiCorresponde(conn, idPaciente) {
    const [[hoy]] = await conn.execute(
        'SELECT DAY(CURDATE()) AS dia, MONTH(CURDATE()) AS mes, YEAR(CURDATE()) AS anio'
    );

    if (hoy.dia >= DIA_CORTE_CUOTA) {
        return;
    }

    const [cuotas] = await conn.execute(
        'SELECT 1 FROM cuota WHERE idPaciente = ? AND mes = ? AND anio = ? LIMIT 1',
        [idPaciente, hoy.mes, hoy.anio]
    );
    if (cuotas.length > 0) {
        return;
    }

    const [[{ cantidad }]] = await conn.execute(
        'SELECT COUNT(*) AS cantidad FROM grupopaciente WHERE idPaciente = ? AND fechaBaja IS NULL',
        [idPaciente]
    );
    if (cantidad === 0) {
        return;
    }

    const [tarifas] = await conn.execute(
        `SELECT monto FROM tarifagrupo
         WHERE cantidadDias = ?
           AND DATE_FORMAT(CURDATE(), '%Y-%m-01') BETWEEN fechaDesde AND IFNULL(fechaHasta, '9999-12-31')
         LIMIT 1`,
        [cantidad]
    );
    if (tarifas.length === 0) {
        return;
    }

    await conn.execute(
        'INSERT INTO cuota (idPaciente, mes, anio, monto, montoDescuento) VALUES (?, ?, ?, ?, ?)',
        [idPaciente, hoy.mes, hoy.anio, tarifas[0].monto, tarifas[0].monto]
    );
    logger.auditar('CUOTA_GENERADA_AUTOMATICA', {
        idPaciente: parseInt(idPaciente, 10), mes: hoy.mes, anio: hoy.anio,
        monto: tarifas[0].monto, cantidadGrupos: cantidad
    });
}

module.exports = {
    DIA_CORTE_CUOTA,
    generarCuotaDelMesSiCorresponde
};
