const db = require('../db');

const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('cuotasController.js');


function isValidDescripcion(descripcion) {
    const maxLength = 500;

    if (!descripcion) {
        return true;
    }

    if (descripcion.length > maxLength) {
        return false;
    }

    const regex = /^[a-zA-Z0-9\s.,!?&'"()-]+$/;
    return regex.test(descripcion.trim());
}

function isValidFechaPago(fechaPago) {
    if (!fechaPago) {
        return true;
    }
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(fechaPago.trim());
}

function isValidMetodoPago(metodoPago) {
    if (!metodoPago) {
        return true;
    }
    const validMethods = ['Efectivo', 'Debito', 'Credito', 'Deposito', 'Transferencia', 'NoEspecificado'];
    return validMethods.includes(metodoPago);
}

function constructorWhereAndValues(filters) {
    let whereClause = 'WHERE 1=1';
    const values = [];

    if (filters.nombre) {
        whereClause += ' AND p.nomyap LIKE ?';
        values.push(`%${filters.nombre}%`);
    }

    if (filters.cedula) {
        whereClause += ' AND p.cedula LIKE ?';
        values.push(`%${filters.cedula}%`);
    }

    if (filters.mes) {
        whereClause += ' AND vc.mes = ?';
        values.push(parseInt(filters.mes, 10));
    }

    if (filters.anio) {
        whereClause += ' AND vc.anio = ?';
        values.push(parseInt(filters.anio, 10));
    }

    if (filters.estado) {
        whereClause += ' AND vc.estado = ?';
        values.push(filters.estado);
    }

    return { whereClause, values };
}

async function getAllCuotas(req, res) {
    try {
        const { nombre, cedula, mes, anio, estado, page = 1, limit = 200 } = req.query;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        if (isNaN(pageNum) || pageNum <= 0 || isNaN(limitNum) || limitNum <= 0) {
            return res.status(400).json({ message: 'Parámetros de paginación inválidos (page o limit).' });
        }

        const offset = (pageNum - 1) * limitNum;

        const filters = { nombre, cedula, mes, anio, estado };
        const { whereClause, values } = constructorWhereAndValues(filters);

        const query = `
            SELECT
                vc.*,
                p.nomyap AS nombre,
                p.cedula AS cedula
            FROM
                view_cuota_estado vc
            JOIN
                paciente p ON vc.idPaciente = p.id
            ${whereClause}
            ORDER BY
                vc.anio DESC, vc.mes DESC, p.nomyap
            LIMIT ? OFFSET ?;
        `;

        const countQuery = `
            SELECT
                COUNT(*) AS total
            FROM
                view_cuota_estado vc
            JOIN
                paciente p ON vc.idPaciente = p.id
            ${whereClause};
        `;

        const [cuotas] = await db.execute(query, [...values, limitNum, offset]);
        const [countResult] = await db.execute(countQuery, values);
        const totalCuotas = countResult[0].total;

        res.status(200).json({
            cuotas,
            totalCuotas,
            currentPage: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalCuotas / limitNum)
        });

    } catch (error) {
        logger.error('Error al obtener cuotas de la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener cuotas.' });
    }
}

async function getCuota(req, res) {
    const { idPaciente, mes, anio } = req.query;
    if (!idPaciente || !mes || !anio) {
        logger.warn('Intento de recuperar cuota sin parámetros necesarios.');
        return res.status(400).json({ message: 'ID de paciente, mes y año son requeridos.' });
    }

    const id = parseInt(idPaciente, 10);
    const month = parseInt(mes, 10);
    const year = parseInt(anio, 10);
    if (isNaN(id) || isNaN(month) || isNaN(year)) {
        logger.warn('Parámetros inválidos para recuperar cuota.');
        return res.status(400).json({ message: 'ID de paciente, mes y año deben ser números.' });
    }

    try {
        const [result] = await db.execute(
            `SELECT vc.*, p.nomyap AS nombre, p.cedula AS cedula
             FROM view_cuota_estado vc
             JOIN paciente p ON vc.idPaciente = p.id
             WHERE vc.idPaciente = ? AND vc.mes = ? AND vc.anio = ?`,
            [id, month, year]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: 'Cuota no encontrada.' });
        }

        res.json(result);

    } catch (error) {
        logger.error('Error al obtener cuota de la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener cuota.' });
    }
};

//Esta funcion es para agregar cuotas en general
async function addCuota(req, res) {
    const { idPaciente, mes, anio, monto, montoDescuento} = req.body;

    if (!idPaciente || !mes || !anio || !monto || !montoDescuento) {
        logger.warn('Intento de agregar cuota sin parámetros necesarios.');
        return res.status(400).json({ message: 'ID de paciente, mes, año, monto y monto de descuento son requeridos.' });
    }

    const id = parseInt(idPaciente, 10);
    const month = parseInt(mes, 10);
    const year = parseInt(anio, 10);
    const amount = parseInt(monto, 10);
    const amountDescuento = parseInt(montoDescuento, 10);
    if (isNaN(id) || isNaN(month) || isNaN(year) || isNaN(amount) || isNaN(amountDescuento)) {
        logger.warn('Parámetros inválidos para agregar cuota.');
        return res.status(400).json({ message: 'ID de paciente, mes, año, monto y monto de descuento deben ser números.' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE cuota 
             SET fechaBaja = NULL, monto = ?, montoDescuento = ?, fechaPago = NULL
             WHERE idPaciente = ? AND mes = ? AND anio = ? AND fechaBaja IS NOT NULL`,
            [amount, amountDescuento, id, month, year]
        );

        if (result.affectedRows === 0) {

            const [result2] = await db.execute(
                `INSERT INTO cuota (idPaciente, mes, anio, monto, montoDescuento)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, month, year, amount, amountDescuento]
            );
            res.status(201).json({ message: 'Cuota agregada exitosamente.', id: result2.insertId });

        } else {
            res.status(200).json({ message: 'Cuota reactivada exitosamente.', id: result.insertId });
        }

    } catch (error) {

        if (error.code === 'ER_DUP_ENTRY') {
            logger.warn('Intento de agregar cuota ya existente.');
            return res.status(409).json({ message: 'La cuota ya existe.' });
        }

        logger.error('Error al agregar cuota a la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al agregar cuota.' });
    }
};

async function getMonto(req, res) {
    const { idPaciente } = req.query;

    if (!idPaciente) {
        logger.warn('Intento de obtener monto sin parámetros necesarios.');
        return res.status(400).json({ message: 'ID de paciente es requerido.' });
    }

    const id = parseInt(idPaciente, 10);
    if (isNaN(id)) {
        logger.warn('Parámetros inválidos para obtener monto.');
        return res.status(400).json({ message: 'ID de paciente debe ser un número.' });
    }

    try {
        const [result] = await db.execute(
            `SELECT monto
            FROM tarifagrupo tg
            WHERE tg.cantidadDias = (SELECT COUNT(*)
                                      FROM grupopaciente
                                      WHERE idPaciente = ? AND fechaBaja IS NULL)`,
            [id]
        );

        if (result.length === 0) {
            const monto = 0;
            res.status(200).json({ monto });
        } else {
            const monto = result[0].monto;
            res.status(200).json({ monto });
        }


    } catch (error) {
        logger.error('Error al obtener monto de la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener monto.' });
    }
}

async function registrarPago(req, res) {

    const { idPaciente, mes, anio, monto, descripcion, metodoPago, fechaPago, descuento, montoDescuento } = req.body;

    if (!idPaciente || !mes || !anio || !monto || !descuento || !montoDescuento) {
        logger.warn(`Intento de registrar pago sin parámetros necesarios. idPaciente: ${idPaciente}, mes: ${mes}, anio: ${anio}, monto: ${monto}, descuento: ${descuento}, montoDescuento: ${montoDescuento}    `);
        return res.status(400).json({ message: 'ID de paciente, mes, año, monto, descuento y monto de descuento son requeridos.' });
    }

    const id = parseInt(idPaciente, 10);
    const month = parseInt(mes, 10);
    const year = parseInt(anio, 10);
    const amount = parseInt(monto, 10);
    const discount = parseInt(descuento, 10);
    const amountWithDiscount = parseInt(montoDescuento, 10);

    if (isNaN(id) || isNaN(month) || isNaN(year) || isNaN(amount) || isNaN(discount) || isNaN(amountWithDiscount)) {
        logger.warn('Parámetros inválidos para registrar pago.');
        return res.status(400).json({ message: 'ID de paciente, mes, año, monto, descuento y monto de descuento deben ser números.' });
    }

    if (!isValidDescripcion(descripcion)) {
        logger.warn('Descripcion no valida');
        return res.status(400).json({ message: 'Descripción no válida.' });
    }

    if (!isValidFechaPago(fechaPago)) {
        logger.warn('Fecha de pago no válida.');
        return res.status(400).json({ message: 'Fecha de pago no válida.' });
    }

    if (!isValidMetodoPago(metodoPago)) {
        logger.warn('Método de pago no válido.');
        return res.status(400).json({ message: 'Método de pago no válido.' });
    }

    try {

        if (!fechaPago) {
            const [result] = await db.execute(
                `UPDATE cuota
                 SET monto = ?, descripcion = ?, metodoPago = ?, descuento = ?, montoDescuento = ?, fechaPago = NULL
                 WHERE idPaciente = ? AND mes = ? AND anio = ?`,
                [amount, descripcion, metodoPago, discount, amountWithDiscount, id, month, year]
            );

            res.status(201).json({ message: 'Pago registrado exitosamente.', id: result.insertId });
        } else {
            const [result] = await db.execute(
                `UPDATE cuota
                 SET monto = ?, descripcion = ?, metodoPago = ?, descuento = ?, montoDescuento = ?, fechaPago = ?
                 WHERE idPaciente = ? AND mes = ? AND anio = ?`,
                [amount, descripcion, metodoPago, discount, amountWithDiscount, fechaPago, id, month, year]
            );

            res.status(201).json({ message: 'Pago registrado exitosamente.', id: result.insertId });
        }



    } catch (error) {
        logger.error('Error al registrar pago en la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al registrar pago.' });
    }
}

async function bajaCuota(req, res) {

    const { idPaciente, mes, anio } = req.body;

    if (!idPaciente || !mes || !anio) {
        logger.warn('Intento de dar de baja cuota sin parámetros necesarios.');
        return res.status(400).json({ message: 'ID de paciente, mes y año son requeridos.' });
    }

    const id = parseInt(idPaciente, 10);
    const month = parseInt(mes, 10);
    const year = parseInt(anio, 10);

    if (isNaN(id) || isNaN(month) || isNaN(year)) {
        logger.warn('Parámetros inválidos para dar de baja cuota.');
        return res.status(400).json({ message: 'ID de paciente, mes y año deben ser números.' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE cuota SET fechaBaja = CURDATE() 
            WHERE idPaciente = ? AND mes = ? AND anio = ?`,
            [id, month, year]
        );

        if (result.affectedRows === 0) {
            logger.warn('No se encontró cuota para dar de baja.');
            return res.status(404).json({ message: 'No se encontró cuota para dar de baja.' });
        }

        res.status(200).json({ message: 'Cuota dada de baja exitosamente.' });

    } catch (error) {
        logger.error('Error al dar de baja cuota en la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al dar de baja cuota.' });
    }
}

async function generarBalance(req, res) {
    const { fechaDesde, fechaHasta } = req.query;
    if (!fechaDesde || !fechaHasta) {
        logger.warn('Intento de generar balance sin parámetros necesarios.');
        return res.status(400).json({ message: 'Fecha desde y fecha hasta son requeridos.' });
    }

    const fechaDesdeObj = new Date(fechaDesde);
    const fechaHastaObj = new Date(fechaHasta);

    if (isNaN(fechaDesdeObj.getTime()) || isNaN(fechaHastaObj.getTime())) {
        logger.warn('Parámetros inválidos para generar balance.');
        return res.status(400).json({ message: 'Fechas inválidas. Formato esperado: YYYY-MM-DD.' });
    }



    if(fechaDesdeObj > fechaHastaObj){
        logger.warn('Fecha desde no puede ser mayor a fecha hasta.');
        return res.status(400).json({ message: 'Fecha desde no puede ser mayor a fecha hasta.' });
    }

    const yyyymmDesde = fechaDesdeObj.getFullYear() * 100 + (fechaDesdeObj.getMonth() + 1);
    const yyyymmHasta = fechaHastaObj.getFullYear() * 100 + (fechaHastaObj.getMonth() + 1);

   try {
       const [result] = await db.execute(
           `SELECT
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 1 THEN COALESCE(vc.montoDescuento,0) ELSE 0 END),0) AS ingreso1xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 2 THEN COALESCE(vc.montoDescuento,0) ELSE 0 END),0) AS ingreso2xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 3 THEN COALESCE(vc.montoDescuento,0) ELSE 0 END),0) AS ingreso3xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 4 THEN COALESCE(vc.montoDescuento,0) ELSE 0 END),0) AS ingreso4xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 5 THEN COALESCE(vc.montoDescuento,0) ELSE 0 END),0) AS ingreso5xsemana,

                COALESCE(SUM(CASE WHEN tg.cantidadDias IS NULL THEN COALESCE(vc.montoDescuento,0) ELSE 0 END),0) AS ingresoOtro,

                COALESCE(SUM(COALESCE(vc.montoDescuento,0)),0) AS ingresoTotal,

                -- conteos
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 1 THEN 1 ELSE 0 END),0) AS cant1xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 2 THEN 1 ELSE 0 END),0) AS cant2xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 3 THEN 1 ELSE 0 END),0) AS cant3xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 4 THEN 1 ELSE 0 END),0) AS cant4xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias = 5 THEN 1 ELSE 0 END),0) AS cant5xsemana,
                COALESCE(SUM(CASE WHEN tg.cantidadDias IS NULL THEN 1 ELSE 0 END),0) AS cantOtro,

                -- total de filas (cuotas pagadas en el rango)
                COUNT(*) AS cantTotal

                FROM view_cuota_estado vc
                LEFT JOIN tarifagrupo tg
                ON STR_TO_DATE(CONCAT(vc.anio,'-',LPAD(vc.mes,2,'0'),'-01'), '%Y-%m-%d')
                    BETWEEN tg.fechaDesde AND IFNULL(tg.fechaHasta, '9999-12-31')
                AND tg.monto = vc.monto
                WHERE vc.estado = 'Pagada'
                AND (vc.anio * 100 + vc.mes) BETWEEN ? AND ?;
                `,
            [yyyymmDesde, yyyymmHasta]
       );

       res.status(200).json({ message: 'Balance generado exitosamente.', data: result[0] });
   } catch (error) {
       logger.error('Error al generar balance en la base de datos:', error.message);
       logger.error(error.stack);
       res.status(500).json({ message: 'Error interno del servidor al generar balance.' });
   }
}

module.exports = {
    getAllCuotas,
    getCuota,
    addCuota,
    getMonto,
    registrarPago,
    bajaCuota,
    generarBalance
}
