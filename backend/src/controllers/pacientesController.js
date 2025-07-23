const db = require('../db');

const  crearLogger  = require('../../plugins/logger.plugin.js');
const logger = crearLogger('pacientesController.js');

function constructorWhereAndValues(filters) {
    let whereClause = 'WHERE 1=1';
    const values = [];
    if (filters.diagnosticoId && filters.diagnosticoId !== '') {
        console.log('entro');
        whereClause += ' AND EXISTS (SELECT 1 FROM diagnostico d_filter JOIN nombrediagnostico nd_filter ON d_filter.idNombreDiagnostico = nd_filter.id WHERE d_filter.idPaciente = p.id AND nd_filter.id = ?)';
        values.push(filters.diagnosticoId);
    }

    if (filters.nombre) {
        whereClause += ' AND p.nomyap LIKE ?';
        values.push(`%${filters.nombre}%`);
    }

    if (filters.cedula) {
        whereClause += ' AND p.cedula LIKE ?';
        values.push(`%${filters.cedula}%`);
    }

    if (filters.activo === '1' || filters.activo === '0') {
        whereClause += ' AND p.activo = ?';
        values.push(parseInt(filters.activo, 10));
    }

    return { whereClause, values };
}

async function getAllPacientes(req, res) {
    try {
        const { diagnosticoId, nombre, cedula, activo, page = 1, limit = 200 } = req.query;
    
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        
        if (isNaN(pageNum) || pageNum <= 0 || isNaN(limitNum) || limitNum <= 0) {
            return res.status(400).json({ message: 'Parámetros de paginación inválidos (page o limit).' });
        }

        const offset = (pageNum - 1) * limitNum;

        const filters = { diagnosticoId, nombre, cedula, activo };
        const { whereClause, values } = constructorWhereAndValues(filters);
        
        const query = `
            SELECT
                p.id,
                p.nomyap,
                p.cedula,
                DATE_FORMAT(p.fechaNacimiento, '%Y-%m-%d') AS fechaNacimiento,
                p.telefono,
                p.gmail,
                p.activo,
                GROUP_CONCAT(DISTINCT nd.nombre ORDER BY nd.nombre SEPARATOR ', ') AS diagnosticos
            FROM
                paciente p
            LEFT JOIN
                diagnostico d ON p.id = d.idPaciente
            LEFT JOIN
                nombrediagnostico nd ON d.idNombreDiagnostico = nd.id
            ${whereClause} AND p.fechaBaja IS NULL
            GROUP BY
                p.id
            ORDER BY
                p.nomyap
            LIMIT ? OFFSET ?;
        `;


        const countQuery = `
            SELECT
                COUNT(DISTINCT p.id) AS total
            FROM
                paciente p
            LEFT JOIN
                diagnostico d ON p.id = d.idPaciente
            LEFT JOIN
                nombreDiagnostico nd ON d.idNombreDiagnostico = nd.id
            ${whereClause};
        `;

        const [pacientes] = await db.execute(query, [...values, limitNum, offset]);
        const [countResult] = await db.execute(countQuery, values);
        const totalPacientes = countResult[0].total;

        res.status(200).json({
            pacientes,
            totalPacientes,
            currentPage: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalPacientes / limitNum)
        });

    } catch (error) {
        logger.error('Error al obtener pacientes de la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener pacientes.' });
    }
}

function isValidGmail(mail) {
    if (!mail || mail.trim() === '') {
        return true;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(mail);
}

function isValidNomyap(nomyap) {
    nomyap = nomyap.trim().toUpperCase();
    const nameRegex = /^[A-ZÁÉÍÓÚÜÑ\s'-]{2,}$/; 
    return nameRegex.test(nomyap);
}

function isValidCedula(cedula) {
    const cleanedCedula = cedula.replace(/\./g, '').replace(/-/g, '');
    return /^\d{8}$/.test(cleanedCedula);
}

function isValidFechaNacimiento(fechaNacimiento, minEdad = 0) {
    const birthDate = new Date(fechaNacimiento);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    const dayDifference = today.getDate() - birthDate.getDate();

    if (isNaN(birthDate.getTime()) || birthDate > today) {
        return false;
    }
    if (age < minEdad || (age === minEdad && (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)))) {
        return false;
    }
    return true;
}

async function createPaciente(req, res) {
    let { nomyap, cedula, fechaNacimiento, fechaCreacion, telefono, gmail, genero } = req.body;

    if (!nomyap || !cedula || !fechaNacimiento || !telefono || !genero) {
        logger.warn('Intento de crear paciente con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    //VALIDAR NOMBRE Y APELLIDO
    if (!isValidNomyap(nomyap)) {
        logger.warn(`Intento de crear paciente con nomyap inválido: ${nomyap}`);
        return res.status(400).json({ message: 'El nombre y apellido no tiene un formato válido (solo letras, espacios, guiones, apóstrofes y tildes, mínimo 2 caracteres).' });
    }
    
    nomyap = nomyap.toUpperCase();

    //VALIDAR GMAIL
    if (!isValidGmail(gmail)) {
        logger.warn(`Intento de crear paciente con email inválido: ${gmail}`);
        return res.status(400).json({ message: 'El formato del email es inválido.' });
    }
    
    gmail = gmail.toLowerCase();

    //VALIDAR TELEFONO
    const cleanedTelefono = telefono.replace(/[^+\d]/g, '');
    if (!cleanedTelefono.startsWith('+') || cleanedTelefono.length < 8 || !/^\+\d+$/.test(cleanedTelefono)) {
        logger.warn(`Intento de crear paciente con formato de teléfono inválido después de limpieza: ${telefono}`);
        return res.status(400).json({ message: 'El formato del teléfono es inválido. Debe comenzar con "+" seguido del código de país y el número, solo con dígitos (Ej: +59899123456).' });
    }
    telefono = cleanedTelefono; 
    
    //VALIDAR CEDULA
    if (!isValidCedula(cedula)) {
        logger.warn(`Intento de crear paciente con cédula inválida: ${cedula}`);
        return res.status(400).json({ message: 'El formato de la cédula es inválido (debe ser de 8 dígitos).' });
    }
    cedula = cedula.replace(/\./g, '').replace(/-/g, ''); //En realidad no la estoy guardando con puntos ni guiones, pero la limpio por si acaso

    //VALIDAR FECHA DE NACIMIENTO
    const MIN_AGE = 0;
    if (!isValidFechaNacimiento(fechaNacimiento, MIN_AGE)) {
        logger.warn(`Intento de crear paciente con fecha de nacimiento inválida o menor de ${MIN_AGE} años: ${fechaNacimiento}`);
        return res.status(400).json({ message: `La fecha de nacimiento es inválida o el paciente es menor de ${MIN_AGE} años.` });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO paciente (nomyap, cedula, fechaNacimiento, fechaCreacion, telefono, gmail, genero, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [nomyap, cedula, fechaNacimiento, fechaCreacion, telefono, gmail, genero, false]
        );

        logger.log(`Paciente creado con ID: ${result.insertId} y cédula: ${cedula}. Teléfono guardado: ${telefono}`);
        res.status(201).json({ message: 'Paciente creado exitosamente.', pacienteId: result.insertId });

    } catch (error) {
        logger.error('Error al crear paciente en la base de datos:', error.message);
        logger.error(error.stack);

        // 'ER_DUP_ENTRY' se dispara por el UNIQUE en cedula en la bdd
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'La cedula ingresada ya está registrada para otro paciente.' });
        }

        res.status(500).json({ message: 'Error interno del servidor al crear el paciente.' });
    }
}

async function modifyPacienteById(req, res){
let { nomyap, cedula, fechaNacimiento, telefono, gmail, genero } = req.body;
const pacienteId = req.params.id;

    if (!nomyap || !cedula || !fechaNacimiento || !telefono || !genero) {
        logger.warn('Intento de modificar paciente con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'Todos los campos son requeridos. Menos el gmail' });
    }

    //VALIDAR NOMBRE Y APELLIDO
    if (!isValidNomyap(nomyap)) {
        logger.warn(`Intento de modificar paciente con nomyap inválido: ${nomyap}`);
        return res.status(400).json({ message: 'El nombre y apellido no tiene un formato válido (solo letras, espacios, guiones, apóstrofes y tildes, mínimo 2 caracteres).' });
    }
    
    nomyap = nomyap.toUpperCase();

    //VALIDAR GMAIL
    if (!isValidGmail(gmail)) {
        logger.warn(`Intento de modificar paciente con email inválido: ${gmail}`);
        return res.status(400).json({ message: 'El formato del email es inválido.' });
    }
    
    gmail = gmail.toLowerCase();

    //VALIDAR TELEFONO
    const cleanedTelefono = telefono.replace(/[^+\d]/g, '');
    if (!cleanedTelefono.startsWith('+') || cleanedTelefono.length < 8 || !/^\+\d+$/.test(cleanedTelefono)) {
        logger.warn(`Intento de modificar paciente con formato de teléfono inválido después de limpieza: ${telefono}`);
        return res.status(400).json({ message: 'El formato del teléfono es inválido. Debe comenzar con "+" seguido del código de país y el número, solo con dígitos (Ej: +59899123456).' });
    }
    telefono = cleanedTelefono; 

    //VALIDAR FECHA DE NACIMIENTO
    const MIN_AGE = 0;
    if (!isValidFechaNacimiento(fechaNacimiento, MIN_AGE)) {
        logger.warn(`Intento de modificar paciente con fecha de nacimiento inválida o menor de ${MIN_AGE} años: ${fechaNacimiento}`);
        return res.status(400).json({ message: `La fecha de nacimiento es inválida o el paciente es menor de ${MIN_AGE} años.` });
    }

    //VALIDAR CEDULA
    if (!isValidCedula(cedula)) {
        logger.warn(`Intento de crear paciente con cédula inválida: ${cedula}`);
        return res.status(400).json({ message: 'El formato de la cédula es inválido (debe ser de 8 dígitos).' });
    }
    cedula = cedula.replace(/\./g, '').replace(/-/g, ''); //En realidad no la estoy guardando con puntos ni guiones, pero la limpio por si acaso



    try {
        const [result] = await db.execute(
            `UPDATE paciente SET
             nomyap = ?, cedula = ?, fechaNacimiento = ?, telefono = ?, gmail = ?, genero = ? 
             WHERE id = ? AND fechaBaja IS NULL`,
            [nomyap, cedula, fechaNacimiento, telefono, gmail, genero, pacienteId]
        );

        if(result.affectedRows === 0 ){
            return res.status(404).json({ message: 'Paciente no encontrado o no se realizaron cambios.' });
        }

        logger.log(`Datos del paciente con ID: ${result.insertId} actualizados correctamente. Teléfono guardado: ${telefono}`);
        res.status(201).json({ message: 'Datos actualizados exitosamente.', pacienteId: result.insertId });

    } catch (error) {

        // 'ER_DUP_ENTRY' se dispara por el UNIQUE en cedula en la bdd
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'La cedula ingresada ya está registrada para otro paciente.' });
        }
        
        logger.error('Error al modificar paciente en la base de datos:', error.message);
        logger.error(error.stack);

        res.status(500).json({ message: 'Error interno del servidor al modificar los datos.' });
    }
}

async function deletePaciente(req,res){
let { pacienteId } = req.query;

    if (!pacienteId) {
        logger.warn('Intento de eliminar paciente con datos incompletos.');
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    const idPacienteNum = parseInt(pacienteId, 10);

    if(isNaN(idPacienteNum)){
        logger.warn(`Intento de eliminar sesión con id de paciente inválido: ${pacienteId}`);
        return res.status(400).json({ message: 'El formato del id del paciente es inválido.' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE paciente p
             SET fechaBaja = CURRENT_DATE()
             WHERE p.id = ?
             AND p.fechaBaja IS NULL
             AND NOT EXISTS (
             SELECT 1
             FROM grupopaciente gp
             WHERE gp.idPaciente = p.id
             AND gp.fechaBaja IS NULL )
             AND NOT EXISTS (
             SELECT 1
             FROM sesion s
             WHERE s.idPaciente = p.id
             AND s.fecha < CURRENT_DATE()
             )`,
            [idPacienteNum]
        );

        if(result.affectedRows === 0 ){
            logger.log(`No se pudo eliminar el paciente, está inscrito en algun horario o tiene alguna sesión pendiente`);
            res.status(409).json({ message: 'No se pudo eliminar el paciente, está inscrito en algun horario o tiene alguna sesión pendiente.'});
        }else{
            logger.log(`Paciente eliminado.`);
            res.status(201).json({ message: 'Paciente eliminado exitosamente.'});
        }

    } catch (error) {
        logger.error('Error al eliminar un paciente en la base de datos:', error.message);

        res.status(500).json({ message: 'Error interno del servidor al eliminar el paciente.' });
    }
};




module.exports = {
    getAllPacientes,
    createPaciente, 
    modifyPacienteById,
    deletePaciente
};