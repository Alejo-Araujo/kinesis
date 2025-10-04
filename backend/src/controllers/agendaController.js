const db = require('../db');

const  crearLogger  = require('../../plugins/logger.plugin.js');
const logger = crearLogger('pacientesController.js');

async function isValidDiaSemana(diaSemana){
const dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
return dias.includes(diaSemana);
};

function isValidHora(hora) {
    if (typeof hora !== 'string') {
        return false; 
    }

    const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

    return timeRegex.test(hora);
};

function parseGroupConcatData(dataString, idKey, nameKey) {
    if (!dataString) return [];
    return dataString.split('||').map(item => {
        const parts = item.split(':');
        if (parts.length === 2) {
            return { [idKey]: parts[0], [nameKey]: parts[1] };
        }
        return null; // En caso de que el formato no sea el esperado
    }).filter(item => item !== null); // Filtra cualquier entrada nula
};

async function getAllHorariosCompletos(req, res){
    try {
        const [horariosRows] = await db.execute(
            `SELECT
             g.diaSemana,
             g.horaInicio,
             g.horaFin,
             GROUP_CONCAT(DISTINCT CONCAT(p.id, ':', p.nomyap) SEPARATOR '||') AS pacientes_raw,
             GROUP_CONCAT(DISTINCT CONCAT(f.id, ':', u.nomyap) SEPARATOR '||') AS fisios_raw
             FROM grupo g
             LEFT JOIN grupofisioterapeuta gf ON g.diaSemana = gf.diaSemana AND g.horaInicio = gf.horaInicio AND g.horaFin = gf.horaFin AND gf.fechaBaja IS NULL
             LEFT JOIN fisioterapeuta f ON f.id = gf.idFisio
             LEFT JOIN usuario u ON u.id = f.idUsuario
             LEFT JOIN grupopaciente gp ON g.diaSemana = gp.diaSemana AND g.horaInicio = gp.horaInicio AND g.horaFin = gp.horaFin AND gp.fechaBaja IS NULL
             LEFT JOIN paciente p ON p.id = gp.idPaciente
             WHERE g.fechaBaja IS NULL
             GROUP BY g.diaSemana, g.horaInicio, g.horaFin
             ORDER BY FIELD(g.diaSemana, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'), g.horaInicio;`,
        );
        
        const processedHorarios = horariosRows.map(row => ({
            idHorarioFrontend: `${row.diaSemana}-${row.horaInicio}-${row.horaFin}`, 
            diaSemana: row.diaSemana,
            horaInicio: row.horaInicio,
            horaFin: row.horaFin,
            pacientes: parseGroupConcatData(row.pacientes_raw, 'idPaciente', 'nombreCompleto'),
            fisioterapeutas: parseGroupConcatData(row.fisios_raw, 'idFisioterapeuta', 'nombreFisio')
        }));
        
        res.json(processedHorarios);
    } catch (error) {
        logger.error('Error al obtener los horarios:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener los horarios.' });
    }
};

async function getHorarioByCompositeKey(req, res) {
    // Los parámetros vienen en req.query cuando se usan en la URL como ?param1=valor1&param2=valor2
    const { diaSemana, horaInicio, horaFin } = req.query;
    if (!diaSemana || !horaInicio || !horaFin) {
        return res.status(400).json({ message: 'Faltan parámetros clave para buscar el horario (diaSemana, horaInicio, horaFin).' });
    }

    //VALIDAR DIA
    if (!isValidDiaSemana(diaSemana)) {
        logger.warn(`Intento de crear horario con dia de semana inválido: ${diaSemana}`);
        return res.status(400).json({ message: 'El dia de la semana no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de crear horario con hora de inicio inválida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de crear horario con hora de fin inválida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }

    try {
        const query = `
            SELECT
             g.diaSemana,
             g.horaInicio,
             g.horaFin,
             GROUP_CONCAT(DISTINCT CONCAT(p.id, ':', p.nomyap) SEPARATOR '||') AS pacientes_raw,
             GROUP_CONCAT(DISTINCT CONCAT(f.id, ':', u.nomyap) SEPARATOR '||') AS fisios_raw
             FROM grupo g
             LEFT JOIN grupofisioterapeuta gf ON g.diaSemana = gf.diaSemana AND g.horaInicio = gf.horaInicio AND g.horaFin = gf.horaFin AND gf.fechaBaja IS NULL
             LEFT JOIN fisioterapeuta f ON f.id = gf.idFisio
             LEFT JOIN usuario u ON u.id = f.idUsuario
             LEFT JOIN grupopaciente gp ON g.diaSemana = gp.diaSemana AND g.horaInicio = gp.horaInicio AND g.horaFin = gp.horaFin AND gp.fechaBaja IS NULL
             LEFT JOIN paciente p ON p.id = gp.idPaciente
             WHERE g.diaSemana = ? AND g.horaInicio = ? AND g.horaFin = ?
             GROUP BY g.diaSemana, g.horaInicio, g.horaFin;`;
        
        const [rows] = await db.execute(query, [diaSemana, horaInicio, horaFin]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Horario no encontrado.' });
        }
        
        const rawHorario = rows[0];

        // Función auxiliar para parsear las cadenas 'id:nombre||id:nombre'
        const parseConcatenatedString = (rawString) => {
            if (!rawString) {
                return []; // Si es null o vacío, retorna un array vacío
            }
            return rawString.split('||').map(item => {
                const parts = item.split(':');
                if (parts.length === 2) {
                    // Asegúrate de que 'id' es el nombre de la columna en tu BD
                    // y que 'nombreCompleto' o 'nombreFisio' coincidan con lo que espera el frontend
                    // Aquí asumo que p.id y f.id son simplemente 'id' en las tablas respectivas
                    return { id: parts[0], nombreCompleto: parts[1] || parts[1] }; // Usar 'nombreCompleto' para pacientes
                }
                return null; // En caso de formato inesperado
            }).filter(item => item !== null); // Eliminar cualquier null si el parseo falla
        };
        
        const horarioFinal = {
            diaSemana: rawHorario.diaSemana,
            horaInicio: rawHorario.horaInicio,
            horaFin: rawHorario.horaFin,
            pacientes: parseConcatenatedString(rawHorario.pacientes_raw),
            // Para fisioterapeutas, asegúrate de que el key 'nombreFisio' coincida con lo que el frontend espera.
            // Si en el frontend se usa 'nombreCompleto' para ambos, ajústalo aquí también.
            fisioterapeutas: parseConcatenatedString(rawHorario.fisios_raw).map(fisio => ({ 
                idFisioterapeuta: fisio.id, // Renombrar 'id' a 'idFisioterapeuta'
                nombreFisio: fisio.nombreCompleto // Renombrar 'nombreCompleto' a 'nombreFisio'
            }))
        };
        // Nota importante: el id del paciente debe ser 'idPaciente' y el del fisio 'idFisioterapeuta'
        // El nombre del paciente debe ser 'nombreCompleto' y el del fisio 'nombreFisio'
        // para que coincidan con la estructura que el frontend espera en showAgendaDetailModal

        // Ajuste para pacientes: cambiar 'id' a 'idPaciente'
        horarioFinal.pacientes = horarioFinal.pacientes.map(paciente => ({
            idPaciente: paciente.id,
            nombreCompleto: paciente.nombreCompleto
        }));
        
        
        res.status(200).json(horarioFinal); // Devuelve el objeto horario parseado
    } catch (error) {
        logger.error('Error al obtener horario por clave compuesta:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener el horario.' });
    }
}

async function addHorario(req, res){
let { diaSemana, horaInicio, horaFin } = req.body;

    if (!diaSemana || !horaInicio || !horaFin ) {
        logger.warn('Intento de crear horario con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    //VALIDAR DIA
    if (!isValidDiaSemana(diaSemana)) {
        logger.warn(`Intento de crear horario con dia de semana inválido: ${diaSemana}`);
        return res.status(400).json({ message: 'El dia de la semana no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de crear horario con hora de inicio inválida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de crear horario con hora de fin inválida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE grupo SET 
             fechaBaja = ?
             WHERE diaSemana = ? AND horaInicio = ? AND horaFin = ? AND fechaBaja IS NOT NULL`,
            [null, diaSemana, horaInicio, horaFin]
        );
        if(result.affectedRows === 0 ){


        const [result2] = await db.execute(
            `INSERT INTO grupo (diaSemana, horaInicio, horaFin)
             VALUES (?, ?, ?)`,
            [diaSemana, horaInicio, horaFin]
        );

        logger.log(`Horario creado. Dia de semana: ${diaSemana} desde las: ${horaInicio} hasta las: ${horaFin}`);
        res.status(201).json({ message: 'Horario creado exitosamente.'});

    }else{
        logger.log(`Horario creado. Dia de semana: ${diaSemana} desde las: ${horaInicio} hasta las: ${horaFin}`);
        res.status(201).json({ message: 'Horario creado exitosamente.'});
    }

    } catch (error) {
        logger.error('Error al agregar un horario en la base de datos:', error.message);
        logger.error(error.stack);

        // 'ER_DUP_ENTRY' se dispara si coniciden las 3 PK con un dato ya ingresado
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'El horario ya existe' });
        }

        res.status(500).json({ message: 'Error interno del servidor al agregar el horario.' });
    }
};

// async function agregarPacienteGrupo(req, res){
// let { diaSemana, horaInicio, horaFin, idPaciente } = req.body;

//     if (!diaSemana || !horaInicio || !horaFin || !idPaciente) {
//         logger.warn('Intento de agregar paciente a grupo con datos incompletos.');
//         console.log(req.body);
//         return res.status(400).json({ message: 'Todos los datos son requeridos' });
//     }

//     //VALIDAR DIA
//     if (!isValidDiaSemana(diaSemana)) {
//         logger.warn(`Intento de agregar paciente a grupo con dia de semana invalido: ${diaSemana}`);
//         return res.status(400).json({ message: 'El dia de la semana no tiene un formato válido.' });
//     }

//     //VALIDAR HORARIOS
//     if (!isValidHora(horaInicio)) {
//         logger.warn(`Intento de agregar paciente a grupo con hora de inicio invalida: ${horaInicio}`);
//         return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
//     }
    
//     if (!isValidHora(horaFin)) {
//         logger.warn(`Intento de agregar paciente a grupo con hora de fin invalida: ${horaFin}`);
//         return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
//     }



//     try {
//         const [result] = await db.execute(
//             `UPDATE grupopaciente SET
//              fechaBaja = ?
//              WHERE diaSemana = ? AND horaInicio = ? AND horaFin = ? AND idPaciente = ? AND fechaBaja IS NOT NULL`,
//             [null, diaSemana, horaInicio, horaFin, idPaciente]
//         );
      
//         if(result.affectedRows === 0 ){
        
            
//             await db.execute(
//             `INSERT INTO grupopaciente 
//             (diaSemana, horaInicio, horaFin, idPaciente, fechaBaja)
//             VALUES (?, ?, ?, ?, ?)`,
//             [diaSemana, horaInicio, horaFin, idPaciente, null]
//              );

//             await db.execute(
//             `UPDATE paciente SET
//             activo = 1
//             WHERE id = ?`,
//             [idPaciente]
//              );

//              const [cuotaRows] = await db.execute(
//                 `UPDATE cuota c SET
//                 c.monto = (SELECT monto
//                     FROM tarifagrupo tg
//                     WHERE tg.cantidadDias = (SELECT COUNT(*)
//                                             FROM grupopaciente
//                                             WHERE idPaciente = ? AND fechaBaja IS NULL)
//                 )
//                 WHERE c.idPaciente = ? AND
//                 c.mes = MONTH(CURDATE()) AND
//                 c.anio = YEAR(CURDATE()) AND
//                 c.fechaBaja IS NULL AND
//                 c.fechaPago IS NULL AND
//                 (SELECT COUNT(*)
//                 FROM grupopaciente gp
//                 WHERE gp.idPaciente = c.idPaciente AND gp.fechaBaja IS NULL) > 0`,
//                 [idPaciente, idPaciente]
//                 );

//                 if(cuotaRows.affectedRows === 0){
//                 const [estaCuotaBaja] = await db.execute(
//                     `UPDATE cuota 
//                     SET fechaBaja = NULL, 
//                     monto = (SELECT monto
//                             FROM tarifagrupo tg
//                             WHERE tg.cantidadDias = (SELECT COUNT(*)
//                                                 FROM grupopaciente
//                                                 WHERE idPaciente = ? AND fechaBaja IS NULL))
//                     WHERE idPaciente = ? AND 
//                     mes = MONTH(CURDATE()) AND 
//                     anio = YEAR(CURDATE()) AND 
//                     fechaBaja IS NOT NULL`, 
//                     [idPaciente, idPaciente]);
                

//                 if(estaCuotaBaja.affectedRows === 0){
//                 await db.execute(
//                     `INSERT INTO cuota (idPaciente, mes, anio, monto)
//                         SELECT 
//                             ? AS idPaciente,
//                             MONTH(CURDATE()) AS mes,
//                             YEAR(CURDATE()) AS anio,
//                             tg.monto
//                         FROM tarifagrupo tg
//                         WHERE tg.cantidadDias = 1
//                         AND NOT EXISTS (
//                             SELECT 1
//                             FROM cuota c
//                             WHERE c.idPaciente = ?
//                             AND c.mes = MONTH(CURDATE())
//                             AND c.anio = YEAR(CURDATE())
//                         );`,
//                     [idPaciente, idPaciente]
//                 );
//             }
//             }
             
//         logger.log(`Paciente agregado al grupo exitosamente`);
//         res.status(200).json({ message: 'Paciente agregado exitosamente.', pacienteId: idPaciente });
//         }else{

//             await db.execute(
//             `UPDATE paciente SET
//             activo = 1
//             WHERE id = ?`,
//             [idPaciente]
//              );


//              const [cuotaRows2] = await db.execute(
//                 `UPDATE cuota c SET
//                 c.monto = (SELECT monto
//                     FROM tarifagrupo tg
//                     WHERE tg.cantidadDias = (SELECT COUNT(*)
//                                             FROM grupopaciente
//                                             WHERE idPaciente = ? AND fechaBaja IS NULL)
//                 )
//                 WHERE c.idPaciente = ? AND
//                 c.mes = MONTH(CURDATE()) AND
//                 c.anio = YEAR(CURDATE()) AND
//                 c.fechaBaja IS NULL AND
//                 c.fechaPago IS NULL AND
//                 (SELECT COUNT(*)
//                 FROM grupopaciente gp
//                 WHERE gp.idPaciente = c.idPaciente AND gp.fechaBaja IS NULL) > 0`,
//                 [idPaciente, idPaciente]
//                 );

//             if(cuotaRows2.affectedRows === 0){

//                 const [estaCuotaBaja] = await db.execute(
//                     `UPDATE cuota 
//                     SET fechaBaja = NULL, 
//                     monto = (SELECT monto
//                             FROM tarifagrupo tg
//                             WHERE tg.cantidadDias = (SELECT COUNT(*)
//                                                 FROM grupopaciente
//                                                 WHERE idPaciente = ? AND fechaBaja IS NULL))
//                     WHERE idPaciente = ? AND 
//                     mes = MONTH(CURDATE()) AND 
//                     anio = YEAR(CURDATE()) AND 
//                     fechaBaja IS NOT NULL`, 
//                     [idPaciente, idPaciente]);

//                     if(estaCuotaBaja.affectedRows === 0){
//                         await db.execute(
//                         `INSERT INTO cuota (idPaciente, mes, anio, monto)
//                         SELECT 
//                             ? AS idPaciente,
//                             MONTH(CURDATE()) AS mes,
//                             YEAR(CURDATE()) AS anio,
//                             tg.monto
//                         FROM tarifagrupo tg
//                         WHERE tg.cantidadDias = 1
//                         AND NOT EXISTS (
//                             SELECT 1
//                             FROM cuota c
//                             WHERE c.idPaciente = ?
//                             AND c.mes = MONTH(CURDATE())
//                             AND c.anio = YEAR(CURDATE())
//                         );`,
//                         [idPaciente,idPaciente]
//                     );
//                     }




                
//             }


//         logger.log(`Paciente agregado al grupo exitosamente`);
//         res.status(201).json({ message: 'Paciente agregado exitosamente.', pacienteId: result.insertId });
//         }
        

//     } catch (error) {

//         if(error.code === 'ER_DUP_ENTRY'){
//             return res.status(409).json({ message: 'El paciente ya se encuentra en este grupo.' });
//         }
        
//         logger.error('Error al agregar paciente al grupo en la base de datos:', error.message);
//         logger.error(error.stack);

//         res.status(500).json({ message: 'Error interno del servidor al agregar paciente al grupo.' });
//     }
// };

// async function eliminarPacienteGrupo(req, res){
// let { diaSemana, horaInicio, horaFin, idPaciente } = req.body;

//     if (!diaSemana || !horaInicio || !horaFin || !idPaciente) {
//         logger.warn('Intento de eliminar paciente del grupo con datos incompletos.');
//         console.log(req.body);
//         return res.status(400).json({ message: 'Todos los datos son requeridos' });
//     }

//     //VALIDAR DIA
//     if (!isValidDiaSemana(diaSemana)) {
//         logger.warn(`Intento de eliminar paciente del grupo con dia de semana invalido: ${diaSemana}`);
//         return res.status(400).json({ message: 'El dia de la semana no tiene un formato válido.' });
//     }

//     //VALIDAR HORARIOS
//     if (!isValidHora(horaInicio)) {
//         logger.warn(`Intento de eliminar paciente del grupo con hora de inicio invalida: ${horaInicio}`);
//         return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
//     }
    
//     if (!isValidHora(horaFin)) {
//         logger.warn(`Intento de eliminar paciente del grupo con hora de fin invalida: ${horaFin}`);
//         return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
//     }


//     try {
//         const [result] = await db.execute(
//             `UPDATE grupopaciente SET
//              fechaBaja = CURDATE()
//              WHERE diaSemana = ? AND horaInicio = ? AND horaFin = ? AND idPaciente = ? AND fechaBaja IS NULL`,
//             [diaSemana, horaInicio, horaFin, idPaciente]
//         );
      
//         if(result.affectedRows === 0 ){

//         await db.execute(
//         `UPDATE paciente p SET
//         p.activo = 0
//         WHERE p.id = ? AND
//         (SELECT COUNT(*)
//         FROM grupopaciente gp
//         WHERE gp.idPaciente = p.id AND gp.fechaBaja IS NULL) = 0`,
//         [idPaciente]
//         );

//         await db.execute(
//         `UPDATE cuota c SET
//         c.fechaBaja = CURDATE()
//         WHERE c.idPaciente = ? AND
//         c.mes = MONTH(CURDATE()) AND
//         c.anio = YEAR(CURDATE()) AND
//         c.fechaBaja IS NULL AND
//         (SELECT COUNT(*)
//         FROM grupopaciente gp
//         WHERE gp.idPaciente = c.idPaciente AND gp.fechaBaja IS NULL) = 0`,
//         [idPaciente]
//         );

        
        
//         logger.log(`Paciente no encontrado o ya eliminado al grupo exitosamente`);
//         res.status(200).json({ message: 'Paciente eliminado exitosamente.', pacienteId: idPaciente });
//         }else{

//         await db.execute(
//         `UPDATE paciente p SET
//         p.activo = 0
//         WHERE p.id = ? AND
//         (SELECT COUNT(*)
//         FROM grupopaciente gp
//         WHERE gp.idPaciente = p.id AND gp.fechaBaja IS NULL) = 0`,
//         [idPaciente]
//         );

//         await db.execute(
//         `UPDATE cuota c SET
//         c.fechaBaja = CURDATE()
//         WHERE c.idPaciente = ? AND
//         c.mes = MONTH(CURDATE()) AND
//         c.anio = YEAR(CURDATE()) AND
//         c.fechaBaja IS NULL AND
//         (SELECT COUNT(*)
//         FROM grupopaciente gp
//         WHERE gp.idPaciente = c.idPaciente AND gp.fechaBaja IS NULL) = 0`,
//         [idPaciente]
//         );

//         await db.execute(
//         `UPDATE cuota c SET
//         c.monto = (SELECT monto
//             FROM tarifagrupo tg
//             WHERE tg.cantidadDias = (SELECT COUNT(*)
//                                       FROM grupopaciente
//                                       WHERE idPaciente = ? AND fechaBaja IS NULL)
//         )
//         WHERE c.idPaciente = ? AND
//         c.mes = MONTH(CURDATE()) AND
//         c.anio = YEAR(CURDATE()) AND
//         c.fechaBaja IS NULL AND
//         c.fechaPago IS NULL AND
//         (SELECT COUNT(*)
//         FROM grupopaciente gp
//         WHERE gp.idPaciente = c.idPaciente AND gp.fechaBaja IS NULL) > 0`,
//         [idPaciente,idPaciente]
//         );


//         logger.log(`Paciente eliminado del grupo exitosamente`);
//         res.status(201).json({ message: 'Paciente eliminado exitosamente.', pacienteId: result.insertId });
//         }
        

//     } catch (error) {

//         logger.error('Error al eliminar paciente del grupo en la base de datos:', error.message);
//         logger.error(error.stack);

//         res.status(500).json({ message: 'Error interno del servidor al eliminar paciente del grupo.' });
//     }
// };

function validarDatosGrupo(diaSemana, horaInicio, horaFin, idPaciente) {
    if (!diaSemana || !horaInicio || !horaFin || !idPaciente) {
        return { valido: false, mensaje: 'Todos los datos son requeridos.' };
    }
    if (!isValidDiaSemana(diaSemana)) {
        return { valido: false, mensaje: 'El día de la semana no es válido.' };
    }
    if (!isValidHora(horaInicio)) {
        return { valido: false, mensaje: 'La hora de inicio es inválida.' };
    }
    if (!isValidHora(horaFin)) {
        return { valido: false, mensaje: 'La hora de fin es inválida.' };
    }
    return { valido: true };
}

async function recalcularCuotaPaciente(db, idPaciente) {
    // Si la cuota esta activa, se le actualiza el monto
    const [result] = await db.execute(`
        UPDATE cuota c
        SET c.monto = (
            SELECT tg.monto
            FROM tarifagrupo tg
            WHERE tg.cantidadDias = (
                SELECT COUNT(*) FROM grupopaciente
                WHERE idPaciente = ? AND fechaBaja IS NULL
            )
        )
        WHERE c.idPaciente = ?
          AND c.mes = MONTH(CURDATE())
          AND c.anio = YEAR(CURDATE())
          AND c.fechaBaja IS NULL
          AND c.fechaPago IS NULL;
    `, [idPaciente, idPaciente]);

    // Si la cuota esta inactiva se reactiva
    if(result.affectedRows === 0) {
        const [result2] = await db.execute(`
            UPDATE cuota c
            SET fechaBaja = NULL,
            fechaPago = NULL, 
            descripcion = null,
            metodoPago = 'NoEspecificado',
                monto = (
                    SELECT tg.monto
                    FROM tarifagrupo tg
                    WHERE tg.cantidadDias = 1)
            WHERE c.idPaciente = ?
            AND c.mes = MONTH(CURDATE())
            AND c.anio = YEAR(CURDATE())
            AND c.fechaBaja IS NOT NULL;
        `, [idPaciente]);

        // Si no tiene cuota se le crea una nuev
        if(result2.affectedRows === 0) {
        await db.execute(`
            INSERT INTO cuota (idPaciente, mes, anio, monto)
            SELECT ?, MONTH(CURDATE()), YEAR(CURDATE()), tg.monto
            FROM tarifagrupo tg
            WHERE tg.cantidadDias = (
                SELECT COUNT(*) FROM grupopaciente
                WHERE idPaciente = ? AND fechaBaja IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM view_cuota_estado vc
                WHERE vc.idPaciente = ?
                AND vc.mes = MONTH(CURDATE())
                AND vc.anio = YEAR(CURDATE())
                AND vc.estado IN ('Pendiente','Atrasada','Pagada')
            );
        `, [idPaciente, idPaciente, idPaciente]);
        }
    }
}

async function agregarPacienteGrupo(req, res) {
    const { diaSemana, horaInicio, horaFin, idPaciente } = req.body;

    const validacion = validarDatosGrupo(diaSemana, horaInicio, horaFin, idPaciente);
    if (!validacion.valido) {
        logger.warn(validacion.mensaje);
        return res.status(400).json({ message: validacion.mensaje });
    }

    try {
        // Reactivar grupo si estaba dado de baja
        const [updateResult] = await db.execute(`
            UPDATE grupopaciente
            SET fechaBaja = NULL
            WHERE diaSemana = ? AND horaInicio = ? AND horaFin = ? AND idPaciente = ? AND fechaBaja IS NOT NULL
        `, [diaSemana, horaInicio, horaFin, idPaciente]);

        if (updateResult.affectedRows === 0) {
            await db.execute(`
                INSERT INTO grupopaciente (diaSemana, horaInicio, horaFin, idPaciente, fechaBaja)
                VALUES (?, ?, ?, ?, NULL)
            `, [diaSemana, horaInicio, horaFin, idPaciente]);
        }

        await db.execute(`UPDATE paciente SET activo = 1 WHERE id = ?`, [idPaciente]);

        await recalcularCuotaPaciente(db, idPaciente);

        logger.log('Paciente agregado al grupo exitosamente');
        return res.status(200).json({ message: 'Paciente agregado exitosamente.', pacienteId: idPaciente });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'El paciente ya se encuentra en este grupo.' });
        }
        logger.error('Error al agregar paciente al grupo:', error.message);
        return res.status(500).json({ message: 'Error interno al agregar paciente al grupo.' });
    }
}

async function eliminarPacienteGrupo(req, res) {
    const { diaSemana, horaInicio, horaFin, idPaciente } = req.body;

    const validacion = validarDatosGrupo(diaSemana, horaInicio, horaFin, idPaciente);
    if (!validacion.valido) {
        logger.warn(validacion.mensaje);
        return res.status(400).json({ message: validacion.mensaje });
    }

    try {
        await db.execute(`
            UPDATE grupopaciente
            SET fechaBaja = CURDATE()
            WHERE diaSemana = ? AND horaInicio = ? AND horaFin = ? AND idPaciente = ? AND fechaBaja IS NULL
        `, [diaSemana, horaInicio, horaFin, idPaciente]);

        // Si ya no está en ningún grupo → desactivar paciente y dar de baja cuota
        await db.execute(`
            UPDATE paciente p
            SET p.activo = 0
            WHERE p.id = ?
              AND (SELECT COUNT(*) FROM grupopaciente gp WHERE gp.idPaciente = p.id AND gp.fechaBaja IS NULL) = 0
        `, [idPaciente]);

        // Si todavía tiene otros grupos → recalcular cuota
        await recalcularCuotaPaciente(db, idPaciente);

        await db.execute(`
            UPDATE cuota c
            SET c.fechaBaja = CURDATE()
            WHERE c.idPaciente = ?
              AND c.mes = MONTH(CURDATE())
              AND c.anio = YEAR(CURDATE())
              AND c.fechaBaja IS NULL
              AND (SELECT COUNT(*) FROM grupopaciente gp WHERE gp.idPaciente = c.idPaciente AND gp.fechaBaja IS NULL) = 0
        `, [idPaciente]);


        logger.log('Paciente eliminado del grupo exitosamente');
        return res.status(200).json({ message: 'Paciente eliminado exitosamente.', pacienteId: idPaciente });

    } catch (error) {
        logger.error('Error al eliminar paciente del grupo:', error);
        return res.status(500).json({ message: 'Error interno al eliminar paciente del grupo.' });
    }
}

async function agregarFisioGrupo(req, res){
let { diaSemana, horaInicio, horaFin, idFisio } = req.body;

    if (!diaSemana || !horaInicio || !horaFin || !idFisio) {
        logger.warn('Intento de agregar fisioterapeuta a grupo con datos incompletos.');
        return res.status(400).json({ message: 'Todos los datos son requeridos' });
    }

    //VALIDAR DIA
    if (!isValidDiaSemana(diaSemana)) {
        logger.warn(`Intento de agregar fisioterapeuta a grupo con dia de semana invalido: ${diaSemana}`);
        return res.status(400).json({ message: 'El dia de la semana no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de agregar fisioterapeuta a grupo con hora de inicio invalida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de agregar fisioterapeuta a grupo con hora de fin invalida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }



    try {
        const [result] = await db.execute(
            `UPDATE grupofisioterapeuta SET
             fechaBaja = ?
             WHERE diaSemana = ? AND horaInicio = ? AND horaFin = ? AND idFisio = ? AND fechaBaja IS NOT NULL`,
            [null, diaSemana, horaInicio, horaFin, idFisio]
        );
      
        if(result.affectedRows === 0 ){
        
            
            const [result2] = await db.execute(
            `INSERT INTO grupofisioterapeuta 
            (diaSemana, horaInicio, horaFin, idFisio, fechaBaja)
            VALUES (?, ?, ?, ?, ?)`,
            [diaSemana, horaInicio, horaFin, idFisio, null]
        );
        logger.log(`Fisioterapeuta agregado al grupo exitosamente`);
        res.status(200).json({ message: 'Fisioterapeuta agregado exitosamente.', fisioId: idFisio });
        }else{

        logger.log(`Fisioterapeuta agregado al grupo exitosamente`);
        res.status(201).json({ message: 'Fisioterapeuta agregado exitosamente.', fisioId: result.insertId });
        }
        

    } catch (error) {

        if(error.code === 'ER_DUP_ENTRY'){
            return res.status(409).json({ message: 'El fisioterapeuta ya se encuentra en este grupo.' });
        }
        
        logger.error('Error al agregar fisioterapeuta al grupo en la base de datos:', error.message);
        logger.error(error.stack);

        res.status(500).json({ message: 'Error interno del servidor al agregar fisioterapeuta al grupo.' });
    }
};

async function eliminarFisioGrupo(req, res){
let { diaSemana, horaInicio, horaFin, idFisio } = req.body;

    if (!diaSemana || !horaInicio || !horaFin || !idFisio) {
        logger.warn('Intento de eliminar fisioterapeuta del grupo con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'Todos los datos son requeridos' });
    }

    //VALIDAR DIA
    if (!isValidDiaSemana(diaSemana)) {
        logger.warn(`Intento de eliminar fisioterapeuta del grupo con dia de semana invalido: ${diaSemana}`);
        return res.status(400).json({ message: 'El dia de la semana no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de eliminar fisioterapeuta del grupo con hora de inicio invalida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de eliminar fisioterapeuta del grupo con hora de fin invalida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }


    try {
        console.log(diaSemana, horaInicio, horaFin, idFisio);
        const [result] = await db.execute(
            `UPDATE grupofisioterapeuta SET
             fechaBaja = CURDATE()
             WHERE diaSemana = ? AND horaInicio = ? AND horaFin = ? AND idFisio = ? AND fechaBaja IS NULL`,
            [diaSemana, horaInicio, horaFin, idFisio]
        );
      
        if(result.affectedRows === 0 ){
        
        logger.log(`Fisioterapeuta no encontrado o ya eliminado al grupo exitosamente`);
        res.status(200).json({ message: 'Fisioterapeuta eliminado exitosamente.', fisioId: idFisio });
        }else{

        logger.log(`Fisioterapeuta eliminado del grupo exitosamente`);
        res.status(201).json({ message: 'Fisioterapeuta eliminado exitosamente.', fisioId: result.insertId });
        }
        

    } catch (error) {

        logger.error('Error al eliminar fisioterapeuta del grupo en la base de datos:', error.message);
        logger.error(error.stack);

        res.status(500).json({ message: 'Error interno del servidor al eliminar fisioterapeuta del grupo.' });
    }
};

async function eliminarGrupo(req, res){
let { diaSemana, horaInicio, horaFin } = req.body;

    if (!diaSemana || !horaInicio || !horaFin ) {
        logger.warn('Intento de eliminar grupo con datos incompletos.');
        console.log(req.body);
        return res.status(400).json({ message: 'Todos los datos son requeridos' });
    }

    //VALIDAR DIA
    if (!isValidDiaSemana(diaSemana)) {
        logger.warn(`Intento de eliminar grupo con dia de semana invalido: ${diaSemana}`);
        return res.status(400).json({ message: 'El dia de la semana no tiene un formato válido.' });
    }

    //VALIDAR HORARIOS
    if (!isValidHora(horaInicio)) {
        logger.warn(`Intento de eliminar grupo con hora de inicio invalida: ${horaInicio}`);
        return res.status(400).json({ message: 'El formato de la hora de inicio es inválido.' });
    }
    
    if (!isValidHora(horaFin)) {
        logger.warn(`Intento de eliminar grupo con hora de fin invalida: ${horaFin}`);
        return res.status(400).json({ message: 'El formato de la hora de fin es inválido.' });
    }


    try {
        const [result] = await db.execute(
            `UPDATE grupo g SET
             g.fechaBaja = CURDATE()
            WHERE g.diaSemana = ? AND g.horaInicio = ? AND g.horaFin = ? AND g.fechaBaja IS NULL AND
                (SELECT COUNT(*) 
                FROM grupopaciente gp
                WHERE gp.diaSemana = g.diaSemana AND gp.horaInicio = g.horaInicio AND gp.horaFin = g.horaFin AND gp.fechaBaja IS NULL) = 0 AND 
                (SELECT COUNT(*) 
                FROM grupofisioterapeuta gf
                WHERE gf.diaSemana = g.diaSemana AND gf.horaInicio = g.horaInicio AND gf.horaFin = g.horaFin AND gf.fechaBaja IS NULL) = 0`,
            [diaSemana, horaInicio, horaFin]
        );
      
        if(result.affectedRows === 0 ){
            return res.status(409).json({ message: 'El grupo tiene pacientes o fisioterapeutas asignados, eliminalos primeros y luego podrás eliminar el grupo.' });
        }      

        logger.log(`Grupo eliminado exitosamente`);
        res.status(201).json({ message: 'Grupo eliminado exitosamente.' });
    } catch (error) {

        logger.error('Error al eliminar el grupo en la base de datos:', error.message);
        logger.error(error.stack);

        res.status(500).json({ message: 'Error interno del servidor al eliminar el grupo.' });
    }
};

async function getHorariosForPaciente(req, res) {
    const { pacienteId } = req.query;
    logger.log(`Solicitud para obtener horarios del paciente con ID: ${pacienteId}`);

    if (!pacienteId) {
        logger.warn('Intento de obtener horarios para paciente sin ID.');
        return res.status(400).json({ message: 'El ID del paciente es requerido.' });
    }

    const idPacienteNum = parseInt(pacienteId, 10);
    if (isNaN(idPacienteNum) || idPacienteNum <= 0) {
        logger.warn(`Intento de obtener horarios para paciente con ID inválido: ${pacienteId}`);
        return res.status(400).json({ message: 'El ID del paciente debe ser un número entero positivo.' });
    }

    try {
        const [rows] = await db.execute(
            `SELECT gp.diaSemana, gp.horaInicio, gp.horaFin
             FROM grupopaciente gp
             WHERE gp.idPaciente = ? AND gp.fechaBaja IS NULL
             ORDER BY 
                FIELD(gp.diaSemana, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'),
                gp.horaInicio`,
            [idPacienteNum]
        );

       logger.log(`Horarios obtenidos exitosamente para el paciente con ID: ${idPacienteNum}`);
       res.status(200).json(rows);

   } catch (error) {
       
       logger.error('Error al obtener horarios para el paciente:', error.message);
       logger.error(error.stack);
       res.status(500).json({ message: 'Error interno del servidor al obtener horarios para el paciente.' });
   }
};

module.exports = {
    getAllHorariosCompletos,
    addHorario,
    agregarPacienteGrupo,
    getHorarioByCompositeKey,
    eliminarPacienteGrupo,
    agregarFisioGrupo,
    eliminarFisioGrupo,
    eliminarGrupo,
    getHorariosForPaciente
}
