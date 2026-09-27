// Cálculo de la cuota del mes en curso de un paciente según sus grupos vigentes.
// Lo usan la agenda (agregar/sacar de un grupo) y la restauración de grupos.

// Día de corte: desde el 25 la cuota del mes se considera atrasada (ver view_cuota_estado),
// por eso a partir de ese día no se generan cuotas nuevas al inscribir a un paciente.
const DIA_CORTE_CUOTA = 25;

// Reglas:
//  - Cuota del mes pendiente (sin pagar y no cancelada): se actualiza al monto de la tarifa
//    vigente para su cantidad de grupos. Si no hay tarifa para esa cantidad (p.ej. 0 grupos)
//    se conserva el monto actual.
//  - Cuota del mes pagada o cancelada: no se toca.
//  - Sin cuota del mes: sólo se genera si generarSiFalta, el paciente tiene grupos, existe
//    tarifa y todavía no se llegó al día de corte.
async function recalcularCuotaDelMes(conn, idPaciente, { generarSiFalta = false } = {}) {
    const [[hoy]] = await conn.execute(
        'SELECT DAY(CURDATE()) AS dia, MONTH(CURDATE()) AS mes, YEAR(CURDATE()) AS anio'
    );

    const [[{ cantidad }]] = await conn.execute(
        'SELECT COUNT(*) AS cantidad FROM grupopaciente WHERE idPaciente = ? AND fechaBaja IS NULL',
        [idPaciente]
    );

    const [tarifas] = await conn.execute(
        `SELECT monto FROM tarifagrupo
         WHERE cantidadDias = ?
           AND DATE_FORMAT(CURDATE(), '%Y-%m-01') BETWEEN fechaDesde AND IFNULL(fechaHasta, '9999-12-31')
         LIMIT 1`,
        [cantidad]
    );
    const montoTarifa = tarifas.length ? tarifas[0].monto : null;

    const [cuotas] = await conn.execute(
        'SELECT fechaPago, fechaBaja, descuento FROM cuota WHERE idPaciente = ? AND mes = ? AND anio = ?',
        [idPaciente, hoy.mes, hoy.anio]
    );

    if (cuotas.length > 0) {
        const cuota = cuotas[0];
        const pendiente = cuota.fechaPago === null && cuota.fechaBaja === null;
        if (pendiente && montoTarifa !== null) {
            // montoDescuento acompaña al monto (mismo redondeo que el frontend).
            await conn.execute(
                `UPDATE cuota
                 SET monto = ?, montoDescuento = FLOOR(? - ? * IFNULL(descuento, 0) / 100)
                 WHERE idPaciente = ? AND mes = ? AND anio = ?`,
                [montoTarifa, montoTarifa, montoTarifa, idPaciente, hoy.mes, hoy.anio]
            );
        }
        return;
    }

    if (generarSiFalta && cantidad > 0 && montoTarifa !== null && hoy.dia < DIA_CORTE_CUOTA) {
        await conn.execute(
            'INSERT INTO cuota (idPaciente, mes, anio, monto, montoDescuento) VALUES (?, ?, ?, ?, ?)',
            [idPaciente, hoy.mes, hoy.anio, montoTarifa, montoTarifa]
        );
    }
}

module.exports = {
    DIA_CORTE_CUOTA,
    recalcularCuotaDelMes
};
