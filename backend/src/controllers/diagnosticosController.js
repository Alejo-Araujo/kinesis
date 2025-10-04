const db = require('../db');
const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('authController.js');


function isValidNombre(nombre) {
    nombre = nombre.trim().toUpperCase();
    const nameRegex = /^[A-Z0-9ÁÉÍÓÚÜÑ\s'-]{2,}$/;
    nombre = nombre.replace('DROP','');
    nombre = nombre.replace('ALTER','');
    nombre = nombre.replace('INSERT','');    
    return nameRegex.test(nombre);
}

async function getAllNombresDiagnosticos(req,res){
    try{
        const [rows] = await db.execute
        (`SELECT * from nombrediagnostico ORDER BY nombre ASC`,[]);

        res.json(rows);
    } catch (error) {
        logger.error('Error en diagnosticosController.getAllNombresDiagnosticos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener pacientes.' });
    }
}

async function agregarNombreDiagnostico(req,res) {
    let { nombre } = req.body;

    if (!nombre) {
        logger.warn('Intento de crear paciente con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'El campo nombre no puede estar vacío' });
    }

    if (!isValidNombre(nombre)) {
        logger.warn(`Intento de crear paciente con nombre inválido: ${nombre}`);
        return res.status(400).json({ message: 'El nombre no tiene un formato válido (solo letras, espacios, guiones, apóstrofes y tildes, mínimo 2 caracteres).' });
    }

    nombre = nombre.toUpperCase();


    try {
        const [result] = await db.execute(
            `INSERT INTO nombrediagnostico (nombre)
             VALUES (?)`,
            [nombre]
        );

        logger.log(`Diagnostico creado con ID: ${result.insertId}`);
        res.status(201).json({ message: 'Diagnostico creado exitosamente.', id: result.insertId });

    } catch (error) {
        logger.error('Error al crear diagnostico en la base de datos:', error.message);
        logger.error(error.stack);

        // 'ER_DUP_ENTRY' se dispara por el UNIQUE en cedula en la bdd
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ya hay un diagnostico con ese nombre.' });
        }

        res.status(500).json({ message: 'Error interno del servidor al crear el diagnostico.' });
    }    
}

async function modifyNombreDiagnosticoById(req, res){
let { nombre } = req.body;
const id = req.params.id;

    if (!nombre) {
        logger.warn('Intento de modificar diagnostico con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'El nombre es requerido.' });
    }


    try {
        const [result] = await db.execute(
            `UPDATE nombrediagnostico SET
             nombre = ? 
             WHERE id = ?`,
            [nombre, id]
        );

        if(result.affectedRows === 0 ){
            return res.status(404).json({ message: 'Diagnostico no encontrado o no se realizaron cambios.' });
        }

        logger.log(`Datos del diagnostico con ID: ${result.insertId} actualizados correctamente.`);
        res.status(201).json({ message: 'Datos actualizados exitosamente.', id: result.insertId });

    } catch (error) {

        // 'ER_DUP_ENTRY' se dispara por el UNIQUE en cedula en la bdd
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ya hay un diagnostico con ese nombre.' });
        }
        
        logger.error('Error al modificar diagnostico en la base de datos:', error.message);
        logger.error(error.stack);

        res.status(500).json({ message: 'Error interno del servidor al modificar los datos.' });
    }
}

async function agregarDiagnostico(req,res){
    let { idNombreDiagnostico, idPaciente } = req.body;

    if (!idNombreDiagnostico) {
        logger.warn('Intento de agregar diagnostico con diagnostico mal seleccionado.');
        return res.status(400).json({ message: 'Ocurrió un error con la selección del diagnostico' });
    }

    if (!idPaciente) {
        logger.warn('Intento de agregar diagnostico con paciente mal seleccionado.');
        return res.status(400).json({ message: 'Ocurrió un error con el paciente, selecciónelo nuevamente e inténtelo otra vez' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO diagnostico (idNombreDiagnostico, idPaciente)
             VALUES (?, ?)`,
            [idNombreDiagnostico, idPaciente]
        );

        logger.log(`Diagnostico creado con ID: ${result.insertId}`);
        res.status(201).json({ message: 'Diagnostico creado exitosamente.', id: result.insertId });

    } catch (error) {
        logger.error('Error al agregar el diagnostico en la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al agregar el diagnostico.' });
    }    
}

async function eliminarDiagnostico(req,res){
    let { idDiagnostico } = req.params;

    const diagnosticoIdNum = parseInt(idDiagnostico, 10);
    if (isNaN(diagnosticoIdNum) || diagnosticoIdNum <= 0) {
        logger.warn(`Intento de eliminar diagnostico con ID inválido: ${idDiagnostico}`);
        return res.status(400).json({ message: 'ID de diagnóstico no válido.' });
    }

    try {
        const [result] = await db.execute(
            `DELETE FROM diagnostico WHERE id = ?`,
            [diagnosticoIdNum]
        );

        if (result.affectedRows === 0) {
            logger.warn(`Intento de eliminar diagnostico con ID inexistente: ${diagnosticoIdNum}`);
            return res.status(404).json({ message: `Diagnóstico con ID ${diagnosticoIdNum} no encontrado.` });
        }

        logger.log(`Diagnostico eliminado con ID: ${idDiagnostico}`);
        res.status(204).end();

    } catch (error) {
        logger.error('Error al eliminar el diagnostico en la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al eliminar el diagnostico.' });
    }    
}

async function eliminarNombreDiagnostico(req, res){
let { id } = req.params;

    const diagnosticoIdNum = parseInt(id, 10);
    if (isNaN(diagnosticoIdNum) || diagnosticoIdNum <= 0) {
        logger.warn(`Intento de eliminar nombre diagnostico con ID inválido: ${diagnosticoIdNum}`);
        return res.status(400).json({ message: 'ID de diagnóstico no válido.' });
    }

    try {
        const [result2] = await db.execute(
            `DELETE FROM diagnostico 
            WHERE idNombreDiagnostico = ? AND idPaciente IN (SELECT id FROM paciente WHERE fechaBaja IS NOT NULL)`,
            [diagnosticoIdNum]
        );

        logger.log(`Registros de diagnósticos asociados a pacientes dados de baja eliminados: ${result2.affectedRows}`);

        const [result] = await db.execute(
            `DELETE FROM nombrediagnostico WHERE id = ? 
            AND NOT EXISTS (SELECT 1 FROM diagnostico WHERE idNombreDiagnostico = ?);`,
            [diagnosticoIdNum, diagnosticoIdNum]
        );

        if (result.affectedRows === 0) {
            logger.warn(`Intento de eliminar nombre diagnostico con ID inexistente o asociado a alguna historia clínica: ${diagnosticoIdNum}`);
            return res.status(404).json({ message: `El diagnóstico esta registrado en la historia clínica de algun paciente.` });
        }

        logger.log(`Nombre diagnostico eliminado con ID: ${id}`);
        res.status(204).end();

    } catch (error) {

         if(error.code === 'ER_ROW_IS_REFERENCED_2'){
            return res.status(409).json({ message: 'El diagnóstico esta registrado en la historia clínica de algun paciente.' });
        }

        logger.error('Error al eliminar el nombre diagnostico en la base de datos:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al eliminar el nombre diagnostico.' });
    }    
}

module.exports = { 
    getAllNombresDiagnosticos, 
    agregarNombreDiagnostico, 
    agregarDiagnostico,
    modifyNombreDiagnosticoById, 
    eliminarDiagnostico,
    eliminarNombreDiagnostico
     };