const db = require('../db');

const  crearLogger  = require('../../plugins/logger.plugin.js');
const logger = crearLogger('pacientesController.js');

function isValidMes(mes) {
    return typeof mes === 'number' && mes >= 0 && mes <= 11;
}

function isValidAnio(anio) {
    return typeof anio === 'number' && anio >= 2025;
}

function isValidFecha(fechaString) {
    if (!fechaString || typeof fechaString !== 'string') {
        return false;
    }
    const date = new Date(fechaString);
    return !isNaN(date.getTime());
}

function isValidHora(horaString) {
    if (!horaString || typeof horaString !== 'string') {
        return false;
    }

    // Expresión regular para el formato HH:MM o HH:MM:SS (24 horas)
    // ^(?!$): Asegura que la cadena no esté vacía
    // (?:2[0-3]|[01]?[0-9]): Horas de 00 a 23
    // :[0-5][0-9]: Minutos de 00 a 59
    // (:[0-5][0-9])?: Segundos opcionales de 00 a 59
    const regex = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9](:[0-5][0-9])?$/;
    return regex.test(horaString);
}

async function getSesionesByAnioMes(req, res){
    const { mes, anio } = req.query;

    if (!mes || !anio ){
        logger.warn('Intento de recuperar sesiones con mes y anio incompletos.');
        return res.status(400).json({ message: 'Todos los datos son requeridos' });
    }

    const mesNum = parseInt(mes, 10); //En MySQL los meses van del 1 al 12 porque se sacan de la fecha bobo
    const anioNum = parseInt(anio, 10);

    if (!isValidMes(mesNum)) {
        logger.warn(`Intento de obtener sesion con mes inválido: ${mes}`);
        return res.status(400).json({ message: 'El mes no tiene un formato válido.' });
    }

    if (!isValidAnio(anioNum)) {
        logger.warn(`Intento de obtener sesion con anio inválido: ${anio}`);
        return res.status(400).json({ message: 'El anio no es correcto.' });
    }

    try{

        const [result] = await db.execute(
            `SELECT s.*, p.nomyap AS nombrePaciente, u.nomyap AS nombreFisio
             FROM sesion s
             JOIN paciente p ON s.idPaciente = p.id
             JOIN fisioterapeuta f ON s.idFisio = f.id
             JOIN usuario u ON f.idUsuario = u.id
             WHERE MONTH(fecha) = ? AND YEAR(fecha) = ?`,
            [mesNum+1, anioNum]
        );
    
        res.json(result);

    } catch (error) {
        logger.error('Error en getSesionesByAnioMes:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener las sesiones.' });
    }
};

async function getSesion(req,res){
    const { fecha, horaInicio, horaFin } = req.query;
    if (!fecha || !horaInicio || !horaFin ){
        logger.warn('Intento de recuperar sesion con fecha, horaInicio o horaFin incompletos.');
        return res.status(400).json({ message: 'Todos los datos son requeridos' });
    }    

    if (!isValidFecha(fecha)) {
        logger.warn(`Intento de obtener sesion con fecha inválida: ${fecha}`);
        return res.status(400).json({ message: 'La fecha no tiene un formato válido.' });
    }

    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de obtener sesion con horaInicio inválida: ${horaInicio}`);
        return res.status(400).json({ message: 'La hora de inicio no es válida.' });
    }

    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de obtener sesion con horaFin inválida: ${horaFin}`);
        return res.status(400).json({ message: 'La hora de fin no es válida.' });
    }

    const fechaBien = fecha.split('T')[0];

    try{

        const [result] = await db.execute(
            `SELECT s.*, p.nomyap AS nombrePaciente, u.nomyap AS nombreFisio
             FROM sesion s
             JOIN paciente p ON s.idPaciente = p.id
             JOIN fisioterapeuta f ON s.idFisio = f.id
             JOIN usuario u ON f.idUsuario = u.id
             WHERE fecha = ? AND horaInicio = ? AND horaFin = ?`,
            [fechaBien, horaInicio, horaFin]
        );
        

        res.json(result);

    } catch (error) {
        logger.error('Error en getSesion:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener la sesión.' });
    }
};

async function addSesion(req,res){
let { fecha, horaInicio, horaFin, idFisio, idPaciente } = req.body;

    if (!fecha || !horaInicio || !horaFin || !idFisio || !idPaciente ) {
        logger.warn('Intento de crear sesión con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    //VALIDAR FECHA
    if (!isValidFecha(fecha)) {
        logger.warn(`Intento de crear sesion con fecha inválida: ${fecha}`);
        return res.status(400).json({ message: 'La fecha no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de crear sesión con hora de inicio inválida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de crear sesión con hora de fin inválida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }

    const inicioTime = new Date('2000-01-01T' + horaInicio);
    const finTime = new Date('2000-01-01T' + horaFin);

    if (inicioTime >= finTime) {
        logger.warn('Intento de modificar sesión donde horaInicio es mayor que horaFin.');
        return res.status(400).json({ message: 'La hora de inicio debe ser menor que la hora final.' });
    }


    //VALIDAR IDS
    const idFisioNum = parseInt(idFisio, 10);
    const idPacienteNum = parseInt(idPaciente, 10);

    if(isNaN(idFisioNum)){
        logger.warn(`Intento de crear sesión con id de fisio inválido: ${idFisio}`);
        return res.status(400).json({ message: 'El formato del id del fisio es inválido.' });
    }

    if(isNaN(idPacienteNum)){
        logger.warn(`Intento de crear sesión con id de paciente inválido: ${idPaciente}`);
        return res.status(400).json({ message: 'El formato del id del paciente es inválido.' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO sesion 
            (fecha, horaInicio, horaFin, idFisio, idPaciente)
            VALUES (?, ?, ?, ?, ?)`,
            [fecha, horaInicio, horaFin, idFisioNum, idPacienteNum]
        );

        if(result.affectedRows === 0 ){
            logger.log(`No se pudo crear la sesión o esta ya existe`);
            res.status(201).json({ message: 'Sesión creada exitosamente.'});
        }else{
            logger.log(`Sesión creada. Fecha: ${fecha} desde las: ${horaInicio} hasta las: ${horaFin}`);
            res.status(201).json({ message: 'Sesión creada exitosamente.'});
        }

    } catch (error) {
        logger.error('Error al agregar una sesión en la base de datos:', error.message);

        // 'ER_DUP_ENTRY' se dispara si coniciden las 3 PK con un dato ya ingresado
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ya existe una sesión en esa fecha en ese mismo horario' });
        }

        res.status(500).json({ message: 'Error interno del servidor al agregar la sesión.' });
    }
};

//A CAMBIAR
async function modifySesion(req,res){
let { fecha, horaInicio, horaFin, idFisio, idPaciente } = req.body;
let { fechaOriginal, horaInicioOriginal, horaFinOriginal } = req.query;
if (!fecha || !horaInicio || !horaFin || !idFisio || !idPaciente) {
        logger.warn('Intento de modificar sesion con datos incompletos.');
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    //VALIDAR FECHA
    if (!isValidFecha(fecha)) {
        logger.warn(`Intento de crear sesion con fecha inválida: ${fecha}`);
        return res.status(400).json({ message: 'La fecha no tiene un formato válido.' });
    }

    if (!isValidFecha(fechaOriginal)) {
        logger.warn(`Intento de crear sesion con fecha original inválida: ${fechaOriginal}`);
        return res.status(400).json({ message: 'La fecha no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de crear sesión con hora de inicio inválida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de crear sesión con hora de fin inválida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }

    if (!isValidHora(horaInicioOriginal)) {
        logger.warn(`Intento de crear sesión con hora de inicio original inválida: ${horaInicioOriginal}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFinOriginal)) {
        logger.warn(`Intento de crear sesión con hora de fin original inválida: ${horaFinOriginal}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }

    const inicioTime = new Date('2000-01-01T' + horaInicio);
    const finTime = new Date('2000-01-01T' + horaFin);

    if (inicioTime >= finTime) {
        logger.warn('Intento de modificar sesión donde horaInicio es mayor que horaFin.');
        return res.status(400).json({ message: 'La hora de inicio debe ser menor que la hora final.' });
    }






    //VALIDAR IDS
    const idFisioNum = parseInt(idFisio, 10);
    const idPacienteNum = parseInt(idPaciente, 10);

    if(isNaN(idFisioNum)){
        logger.warn(`Intento de crear sesión con id de fisio inválido: ${idFisio}`);
        return res.status(400).json({ message: 'El formato del id del fisio es inválido.' });
    }

    if(isNaN(idPacienteNum)){
        logger.warn(`Intento de crear sesión con id de paciente inválido: ${idPaciente}`);
        return res.status(400).json({ message: 'El formato del id del paciente es inválido.' });
    }

    const fechaBienOriginal = fecha.split('T')[0];



    try {
        const [result] = await db.execute(
            `UPDATE sesion SET
             horaInicio = ?, horaFin = ?, idFisio = ?, idPaciente = ?
             WHERE fecha = ? AND horaInicio = ? AND horaFin = ?`,
            [horaInicio, horaFin, idFisioNum, idPacienteNum, fechaBienOriginal, horaInicioOriginal, horaFinOriginal]
        );

        if(result.affectedRows === 0 ){
            return res.status(404).json({ message: 'Sesión no encontrada o no se realizaron cambios.' });
        }

        logger.log(`Datos de la sesión actualizados correctamente.`);
        res.status(200).json({ message: 'Datos actualizados exitosamente.'});

    } catch (error) {

        // 'ER_DUP_ENTRY' se dispara por el UNIQUE en cedula en la bdd
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ya hay una sesión en esa fecha y en ese mismo horario' });
        }
        
        logger.error('Error al modificar sesión en la base de datos:', error.message);
        logger.error(error.stack);

        res.status(500).json({ message: 'Error interno del servidor al modificar los datos de la sesión.' });
    }
}

async function deleteSesion(req,res){
let { fecha, horaInicio, horaFin} = req.query;

    if (!fecha || !horaInicio || !horaFin ) {
        logger.warn('Intento de eliminar sesión con datos incompletos.');
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    //VALIDAR FECHA
    if (!isValidFecha(fecha)) {
        logger.warn(`Intento de eliminar sesion con fecha inválida: ${fecha}`);
        return res.status(400).json({ message: 'La fecha no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de eliminar sesión con hora de inicio inválida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de eliminar sesión con hora de fin inválida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }

    const fechaBien = fecha.split('T')[0];

    try {
        const [result] = await db.execute(
            `DELETE FROM sesion 
             WHERE fecha = ? AND horaInicio = ? AND horaFin = ?`,
            [fechaBien, horaInicio, horaFin]
        );

        if(result.affectedRows === 0 ){
            logger.log(`No se pudo eliminar la sesión o esta ya fue eliminada`);
            res.status(201).json({ message: 'Sesión eliminada exitosamente.'});
        }else{
            logger.log(`Sesión eliminada. Fecha: ${fecha} desde las: ${horaInicio} hasta las: ${horaFin}`);
            res.status(201).json({ message: 'Sesión eliminada exitosamente.'});
        }

    } catch (error) {
        logger.error('Error al eliminar una sesión en la base de datos:', error.message);

        res.status(500).json({ message: 'Error interno del servidor al eliminar la sesión.' });
    }
};







module.exports = { 
    getSesionesByAnioMes,
    getSesion,
    addSesion,
    modifySesion,
    deleteSesion
};