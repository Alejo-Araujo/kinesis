const db = require('../db.js');

const  crearLogger  = require('../../plugins/logger.plugin.js');
const logger = crearLogger('fichaMedicaController.js');

const { JSDOM } = require('jsdom'); 
const DOMPurify = require('dompurify'); 

const { window } = new JSDOM('');

const purify = DOMPurify(window);

async function getPacienteById(req, res) {
    const patientId = req.params.id;

    try {
        const [pacienteRows] = await db.execute(
            `SELECT p.id, p.nomyap, p.cedula, p.fechaNacimiento, p.genero, p.telefono, p.gmail, p.activo, p.fechaCreacion
             FROM paciente p
             WHERE p.id = ? AND fechaBaja IS NULL`,
            [patientId]
        );

        if (pacienteRows.length === 0) {
            return res.status(404).json({ message: 'Paciente no encontrado.' });
        }

        const paciente = pacienteRows[0];

        const [diagnosticosRows] = await db.execute(
            `SELECT d.id AS diagnosticoEntryId, nd.id AS diagnosticoId, nd.nombre AS diagnosticoNombre, d.descripcion
             FROM diagnostico d
             JOIN nombreDiagnostico nd ON d.idNombreDiagnostico = nd.id
             WHERE d.idPaciente = ?`,
            [patientId]
        );

        // Adjuntar los diagnósticos al objeto del paciente
        paciente.diagnosticos = diagnosticosRows;
        
        res.json(paciente); // Envía el objeto paciente completo con sus diagnósticos
    } catch (error) {
        logger.error('Error al obtener paciente por ID:', error);
        res.status(500).json({ message: 'Error interno del servidor al obtener el paciente.' });
    }
};


async function updateDiagnosticoObservaciones(req, res) {
    const { diagnosticoEntryId } = req.params; 
    const { observaciones } = req.body;   

    const sanitizedHtml = purify.sanitize(observaciones); 

    const dom = new JSDOM(sanitizedHtml);
    const images = dom.window.document.querySelectorAll('img');

    const expectedImagePrefix = 'upload/image/'; 

    images.forEach(img => {
        let src = img.getAttribute('src');
        if (src) {
            //Sacar la barra inicial si existe para que conidcida con el prefijo
            if (src.startsWith('/')) {
                src = src.substring(1);
            }

            // Si no tiene el prefijo, se invalida
            if (!src.startsWith(expectedImagePrefix)) {
                logger.warn(`URL de imagen inválida detectada y removida para diagnosticoEntryId ${diagnosticoEntryId}: ${img.getAttribute('src')}`, {"service":"fichaMedicaController.js","timestamp":new Date().toISOString().slice(0, 19).replace('T', ' ')});
                // Se elimina la imagen
                img.remove();  
            }
        }
    });

    // Se obtiene el HTML final después de la validación y posible modificación de las imágenes
    const finalHtml = dom.window.document.body.innerHTML;
    console.log(finalHtml);


    if (!diagnosticoEntryId || typeof finalHtml !== 'string') {
        return res.status(400).json({ message: 'Datos inválidos para actualizar observaciones.' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE diagnostico SET descripcion = ? WHERE id = ?`,
            [finalHtml, diagnosticoEntryId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Registro de diagnóstico no encontrado o no se realizaron cambios.' });
        }

        res.json({ message: 'Observaciones actualizadas exitosamente.' });
    } catch (error) {
        logger.error('Error al actualizar observaciones del diagnóstico:', error);
        res.status(500).json({ message: 'Error interno del servidor al actualizar las observaciones.' });
    }
};



module.exports = {
    getPacienteById,
    updateDiagnosticoObservaciones,
};