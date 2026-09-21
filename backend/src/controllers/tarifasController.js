const db = require('../db');

const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('tarifasController.js');

// Referencia de vigencia: SIEMPRE el 1° del mes en curso, igual que la generación
// de cuotas / recálculo / getMonto (ver CLAUDE.md, tabla tarifagrupo). Así el estado
// "Vigente" que se muestra coincide con la tarifa que realmente factura el sistema.
const REF_VIGENCIA = "DATE_FORMAT(CURDATE(), '%Y-%m-01')";

function isValidFecha(fecha) {
    if (!fecha || typeof fecha !== 'string') return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(fecha.trim())) return false;
    const d = new Date(fecha + 'T00:00:00');
    return !isNaN(d.getTime());
}

// GET /api/tarifas  -> historial completo con estado calculado
async function getTarifas(req, res) {
    try {
        const [result] = await db.execute(`
            SELECT
                cantidadDias,
                monto,
                DATE_FORMAT(fechaDesde, '%Y-%m-%d') AS fechaDesde,
                DATE_FORMAT(fechaHasta, '%Y-%m-%d') AS fechaHasta,
                CASE
                    WHEN ${REF_VIGENCIA} BETWEEN fechaDesde AND IFNULL(fechaHasta, '9999-12-31') THEN 'Vigente'
                    WHEN fechaDesde > ${REF_VIGENCIA} THEN 'Programada'
                    ELSE 'Historica'
                END AS estado
            FROM tarifagrupo
            ORDER BY cantidadDias ASC, fechaDesde DESC
        `);
        res.status(200).json({ tarifas: result });
    } catch (error) {
        logger.error('Error al obtener tarifas:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener tarifas.' });
    }
}

// GET /api/tarifas/vigentes -> la tarifa que rige este mes por cada cantidadDias
async function getTarifasVigentes(req, res) {
    try {
        const [result] = await db.execute(`
            SELECT cantidadDias, monto, DATE_FORMAT(fechaDesde, '%Y-%m-%d') AS fechaDesde
            FROM tarifagrupo
            WHERE ${REF_VIGENCIA} BETWEEN fechaDesde AND IFNULL(fechaHasta, '9999-12-31')
            ORDER BY cantidadDias ASC
        `);
        res.status(200).json({ tarifas: result });
    } catch (error) {
        logger.error('Error al obtener tarifas vigentes:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener tarifas vigentes.' });
    }
}

// POST /api/tarifas -> alta de tarifa nueva (cierra la vigente e inserta la nueva vía SP)
async function crearTarifa(req, res) {
    const { cantidadDias, monto, fechaDesde } = req.body;

    const dias = parseInt(cantidadDias, 10);
    const amount = parseInt(monto, 10);

    if (isNaN(dias) || dias < 1 || dias > 5) {
        logger.warn('Alta de tarifa con cantidadDias inválida.');
        return res.status(400).json({ message: 'La cantidad de días debe ser un número entre 1 y 5.' });
    }
    if (isNaN(amount) || amount < 0) {
        logger.warn('Alta de tarifa con monto inválido.');
        return res.status(400).json({ message: 'El monto debe ser un número mayor o igual a 0.' });
    }
    if (!isValidFecha(fechaDesde)) {
        logger.warn('Alta de tarifa con fechaDesde inválida.');
        return res.status(400).json({ message: 'La fecha de inicio es inválida. Formato esperado: YYYY-MM-DD.' });
    }

    try {
        // El SP cierra la tarifa vigente e inserta la nueva de forma atómica,
        // garantizando que no haya solapamientos ni dos vigentes por cantidadDias.
        await db.query('CALL sp_nueva_tarifa(?, ?, ?)', [dias, amount, fechaDesde]);
        res.status(201).json({ message: 'Tarifa creada exitosamente.' });
    } catch (error) {
        // El SP lanza SIGNAL SQLSTATE '45000' con mensajes de negocio legibles.
        if (error.sqlState === '45000') {
            logger.warn(`Alta de tarifa rechazada por regla de negocio: ${error.sqlMessage || error.message}`);
            return res.status(400).json({ message: error.sqlMessage || error.message });
        }
        if (error.code === 'ER_DUP_ENTRY') {
            logger.warn('Ya existe una tarifa para esa cantidad de días y fecha de inicio.');
            return res.status(409).json({ message: 'Ya existe una tarifa para esa cantidad de días con esa fecha de inicio.' });
        }
        logger.error('Error al crear tarifa:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al crear tarifa.' });
    }
}

// PUT /api/tarifas -> corrección del monto de una tarifa existente (identificada por PK)
async function actualizarMonto(req, res) {
    const { cantidadDias, fechaDesde, monto } = req.body;

    const dias = parseInt(cantidadDias, 10);
    const amount = parseInt(monto, 10);

    if (isNaN(dias) || dias < 1 || dias > 5) {
        return res.status(400).json({ message: 'La cantidad de días debe ser un número entre 1 y 5.' });
    }
    if (isNaN(amount) || amount < 0) {
        return res.status(400).json({ message: 'El monto debe ser un número mayor o igual a 0.' });
    }
    if (!isValidFecha(fechaDesde)) {
        return res.status(400).json({ message: 'La fecha de inicio es inválida. Formato esperado: YYYY-MM-DD.' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE tarifagrupo SET monto = ? WHERE cantidadDias = ? AND fechaDesde = ?`,
            [amount, dias, fechaDesde]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'No se encontró la tarifa a modificar.' });
        }

        res.status(200).json({ message: 'Monto de la tarifa actualizado exitosamente.' });
    } catch (error) {
        logger.error('Error al actualizar tarifa:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al actualizar tarifa.' });
    }
}

// DELETE /api/tarifas -> elimina la ÚLTIMA tarifa de una cantidadDias y reabre la anterior.
// Sólo se puede borrar la más reciente, para no dejar huecos ni corromper el historial.
async function eliminarTarifa(req, res) {
    const { cantidadDias, fechaDesde } = req.body;

    const dias = parseInt(cantidadDias, 10);
    if (isNaN(dias) || dias < 1 || dias > 5) {
        return res.status(400).json({ message: 'La cantidad de días debe ser un número entre 1 y 5.' });
    }
    if (!isValidFecha(fechaDesde)) {
        return res.status(400).json({ message: 'La fecha de inicio es inválida. Formato esperado: YYYY-MM-DD.' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // La tarifa a borrar debe ser la más reciente de esa cantidadDias.
        const [ultima] = await conn.execute(
            `SELECT DATE_FORMAT(fechaDesde, '%Y-%m-%d') AS fechaDesde
             FROM tarifagrupo WHERE cantidadDias = ?
             ORDER BY fechaDesde DESC LIMIT 1`,
            [dias]
        );

        if (ultima.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'No existen tarifas para esa cantidad de días.' });
        }
        if (ultima[0].fechaDesde !== fechaDesde) {
            await conn.rollback();
            return res.status(400).json({
                message: 'Sólo se puede eliminar la tarifa más reciente (la vigente o la programada). Las históricas no se borran para no romper el balance.'
            });
        }

        const [del] = await conn.execute(
            `DELETE FROM tarifagrupo WHERE cantidadDias = ? AND fechaDesde = ?`,
            [dias, fechaDesde]
        );
        if (del.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'No se encontró la tarifa a eliminar.' });
        }

        // Reabrir la tarifa anterior (si queda alguna) para que vuelva a ser la vigente.
        await conn.query(
            `UPDATE tarifagrupo SET fechaHasta = NULL
             WHERE cantidadDias = ?
             ORDER BY fechaDesde DESC LIMIT 1`,
            [dias]
        );

        await conn.commit();
        res.status(200).json({ message: 'Tarifa eliminada exitosamente. Se reactivó la tarifa anterior (si existía).' });
    } catch (error) {
        await conn.rollback();
        logger.error('Error al eliminar tarifa:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al eliminar tarifa.' });
    } finally {
        conn.release();
    }
}

module.exports = {
    getTarifas,
    getTarifasVigentes,
    crearTarifa,
    actualizarMonto,
    eliminarTarifa
};
