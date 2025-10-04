const db = require('../db');
const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('authController.js');

async function getAllFisios(req,res){
    try{
        const [rows] = await db.execute
        (`SELECT f.id, u.nomyap
        FROM fisioterapeuta f
        JOIN usuario u ON u.id = f.idUsuario
        ORDER BY u.nomyap ASC`,[]);

        res.status(200).json(rows);
    } catch (error) {
        logger.error('Error en fisiosController.getAllFisios:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener los fisios.' });
    }
};


module.exports = {
    getAllFisios
}