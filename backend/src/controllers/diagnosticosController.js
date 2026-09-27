const db = require('../db');
const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('diagnosticosController.js');


function isValidNombre(nombre) {
    if (typeof nombre !== 'string') {
        return false;
    }
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
        logger.error('Error en diagnosticosController.getAllNombresDiagnosticos:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener pacientes.' });
    }
}

async function agregarNombreDiagnostico(req,res) {
    let { nombre } = req.body;

    if (!nombre) {
        logger.warn('Intento de crear diagnóstico sin nombre.');
        return res.status(400).json({ message: 'El campo nombre no puede estar vacío' });
    }

    if (!isValidNombre(nombre)) {
        logger.warn(`Intento de crear diagnóstico con nombre inválido: ${nombre}`);
        return res.status(400).json({ message: 'El nombre no tiene un formato válido (solo letras, espacios, guiones, apóstrofes y tildes, mínimo 2 caracteres).' });
    }

    nombre = nombre.toUpperCase();


    try {
        const [result] = await db.execute(
            `INSERT INTO nombrediagnostico (nombre)
             VALUES (?)`,
            [nombre]
        );

        logger.auditar('DIAGNOSTICO_NOMBRE_ALTA', { idNombreDiagnostico: result.insertId, nombre });
        res.status(201).json({ message: 'Diagnostico creado exitosamente.', id: result.insertId });

    } catch (error) {
        // 'ER_DUP_ENTRY' se dispara por el UNIQUE en el nombre
        if (error.code === 'ER_DUP_ENTRY') {
            logger.warn(`Alta de diagnóstico rechazada: ya existe "${nombre}".`);
            return res.status(409).json({ message: 'Ya hay un diagnostico con ese nombre.' });
        }

        logger.error('Error al crear diagnostico en la base de datos:', error);

        res.status(500).json({ message: 'Error interno del servidor al crear el diagnostico.' });
    }    
}

async function modifyNombreDiagnosticoById(req, res){
let { nombre } = req.body;
const id = req.params.id;

    if (!nombre) {
        logger.warn(`Intento de modificar el diagnóstico ${id} sin nombre.`);
        return res.status(400).json({ message: 'El nombre es requerido.' });
    }

    // Misma validación que el alta: el nombre se muestra en la historia clínica,
    // así que no puede contener HTML (antes permitía guardar <img onerror=...>).
    if (!isValidNombre(nombre)) {
        logger.warn(`Intento de modificar diagnostico con nombre inválido: ${nombre}`);
        return res.status(400).json({ message: 'El nombre no tiene un formato válido (solo letras, espacios, guiones, apóstrofes y tildes, mínimo 2 caracteres).' });
    }

    nombre = nombre.toUpperCase();

    try {
        const [previo] = await db.execute('SELECT nombre FROM nombrediagnostico WHERE id = ?', [id]);

        const [result] = await db.execute(
            `UPDATE nombrediagnostico SET
             nombre = ?
             WHERE id = ?`,
            [nombre, id]
        );

        if(result.affectedRows === 0 ){
            return res.status(404).json({ message: 'Diagnostico no encontrado o no se realizaron cambios.' });
        }

        logger.auditar('DIAGNOSTICO_NOMBRE_MODIFICACION', {
            idNombreDiagnostico: parseInt(id, 10),
            nombre: { antes: previo.length ? previo[0].nombre : null, despues: nombre }
        });
        res.status(200).json({ message: 'Datos actualizados exitosamente.', id: id });

    } catch (error) {

        // 'ER_DUP_ENTRY' se dispara por el UNIQUE en el nombre
        if (error.code === 'ER_DUP_ENTRY') {
            logger.warn(`Modificación del diagnóstico ${id} rechazada: ya existe "${nombre}".`);
            return res.status(409).json({ message: 'Ya hay un diagnostico con ese nombre.' });
        }

        logger.error('Error al modificar diagnostico en la base de datos:', error);

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
        const [paciente] = await db.execute(
            'SELECT 1 FROM paciente WHERE id = ? AND fechaBaja IS NULL',
            [idPaciente]
        );
        if (paciente.length === 0) {
            return res.status(404).json({ message: 'El paciente no existe o fue dado de baja.' });
        }

        const [nombreDiag] = await db.execute('SELECT nombre FROM nombrediagnostico WHERE id = ?', [idNombreDiagnostico]);
        if (nombreDiag.length === 0) {
            return res.status(404).json({ message: 'El diagnóstico seleccionado no existe.' });
        }

        const [repetido] = await db.execute(
            'SELECT 1 FROM diagnostico WHERE idNombreDiagnostico = ? AND idPaciente = ? LIMIT 1',
            [idNombreDiagnostico, idPaciente]
        );
        if (repetido.length > 0) {
            return res.status(409).json({ message: 'El paciente ya tiene registrado ese diagnóstico.' });
        }

        const [result] = await db.execute(
            `INSERT INTO diagnostico (idNombreDiagnostico, idPaciente)
             VALUES (?, ?)`,
            [idNombreDiagnostico, idPaciente]
        );

        logger.auditar('DIAGNOSTICO_PACIENTE_ALTA', {
            diagnosticoEntryId: result.insertId,
            idPaciente: parseInt(idPaciente, 10),
            idNombreDiagnostico: parseInt(idNombreDiagnostico, 10),
            diagnostico: nombreDiag[0].nombre
        });
        res.status(201).json({ message: 'Diagnostico creado exitosamente.', id: result.insertId });

    } catch (error) {
        logger.error('Error al agregar el diagnostico en la base de datos:', error);
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
        // Datos previos para la auditoría (se borra junto con sus observaciones).
        const [previo] = await db.execute(
            `SELECT d.idPaciente, nd.nombre, CHAR_LENGTH(IFNULL(d.descripcion, '')) AS caracteres
             FROM diagnostico d JOIN nombrediagnostico nd ON nd.id = d.idNombreDiagnostico
             WHERE d.id = ?`,
            [diagnosticoIdNum]
        );

        const [result] = await db.execute(
            `DELETE FROM diagnostico WHERE id = ?`,
            [diagnosticoIdNum]
        );

        if (result.affectedRows === 0) {
            logger.warn(`Intento de eliminar diagnostico con ID inexistente: ${diagnosticoIdNum}`);
            return res.status(404).json({ message: `Diagnóstico con ID ${diagnosticoIdNum} no encontrado.` });
        }

        logger.auditar('DIAGNOSTICO_PACIENTE_BAJA', {
            diagnosticoEntryId: diagnosticoIdNum,
            idPaciente: previo.length ? previo[0].idPaciente : null,
            diagnostico: previo.length ? previo[0].nombre : null,
            caracteresObservacionesBorradas: previo.length ? previo[0].caracteres : 0
        });
        res.status(204).end();

    } catch (error) {
        logger.error('Error al eliminar el diagnostico en la base de datos:', error);
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
        const [existe] = await db.execute('SELECT nombre FROM nombrediagnostico WHERE id = ?', [diagnosticoIdNum]);
        if (existe.length === 0) {
            return res.status(404).json({ message: 'Diagnóstico no encontrado.' });
        }
        const nombre = existe[0].nombre;

        const [result2] = await db.execute(
            `DELETE FROM diagnostico
            WHERE idNombreDiagnostico = ? AND idPaciente IN (SELECT id FROM paciente WHERE fechaBaja IS NOT NULL)`,
            [diagnosticoIdNum]
        );

        // Borrado de historia clínica de pacientes dados de baja: siempre queda auditado.
        if (result2.affectedRows > 0) {
            logger.auditar('DIAGNOSTICOS_PACIENTES_BAJA_ELIMINADOS', {
                idNombreDiagnostico: diagnosticoIdNum, nombre, cantidad: result2.affectedRows
            });
        }

        const [result] = await db.execute(
            `DELETE FROM nombrediagnostico WHERE id = ? 
            AND NOT EXISTS (SELECT 1 FROM diagnostico WHERE idNombreDiagnostico = ?);`,
            [diagnosticoIdNum, diagnosticoIdNum]
        );

        if (result.affectedRows === 0) {
            logger.warn(`Intento de eliminar nombre diagnostico asociado a alguna historia clínica: ${diagnosticoIdNum}`);
            return res.status(409).json({ message: `El diagnóstico esta registrado en la historia clínica de algun paciente.` });
        }

        logger.auditar('DIAGNOSTICO_NOMBRE_BAJA', { idNombreDiagnostico: diagnosticoIdNum, nombre });
        res.status(204).end();

    } catch (error) {

         if(error.code === 'ER_ROW_IS_REFERENCED_2'){
            return res.status(409).json({ message: 'El diagnóstico esta registrado en la historia clínica de algun paciente.' });
        }

        logger.error('Error al eliminar el nombre diagnostico en la base de datos:', error);
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