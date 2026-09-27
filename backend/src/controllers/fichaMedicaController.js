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
             JOIN nombrediagnostico nd ON d.idNombreDiagnostico = nd.id
             WHERE d.idPaciente = ?`,
            [patientId]
        );

        // Adjuntar los diagnósticos al objeto del paciente
        paciente.diagnosticos = diagnosticosRows;

        // Acceso a datos clínicos (ficha, edición o selección del paciente): queda registrado quién lo vio.
        logger.auditar('PACIENTE_CONSULTADO', { idPaciente: paciente.id, nomyap: paciente.nomyap, diagnosticos: diagnosticosRows.length });

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
    let imagenesRemovidas = 0;

    images.forEach(img => {
        let src = img.getAttribute('src');
        if (src) {
            //Sacar la barra inicial si existe para que conidcida con el prefijo
            if (src.startsWith('/')) {
                src = src.substring(1);
            }

            // Si no tiene el prefijo, se invalida
            if (!src.startsWith(expectedImagePrefix)) {
                logger.warn(`URL de imagen inválida detectada y removida para diagnosticoEntryId ${diagnosticoEntryId}: ${img.getAttribute('src')}`);
                // Se elimina la imagen
                img.remove();
                imagenesRemovidas++;
            }
        }
    });

    // Se obtiene el HTML final después de la validación y posible modificación de las imágenes
    // (no se loguea: es contenido clínico).
    const finalHtml = dom.window.document.body.innerHTML;
    const imagenesFinales = dom.window.document.querySelectorAll('img').length;
    // Buena práctica de JSDOM: cerrar la ventana libera sus recursos en el momento.
    dom.window.close();


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

        // Auditoría sin el contenido: sólo de qué paciente/diagnóstico y el tamaño.
        const [info] = await db.execute(
            `SELECT d.idPaciente, nd.nombre FROM diagnostico d
             JOIN nombrediagnostico nd ON nd.id = d.idNombreDiagnostico WHERE d.id = ?`,
            [diagnosticoEntryId]
        );
        logger.auditar('OBSERVACIONES_ACTUALIZADAS', {
            diagnosticoEntryId: parseInt(diagnosticoEntryId, 10),
            idPaciente: info.length ? info[0].idPaciente : null,
            diagnostico: info.length ? info[0].nombre : null,
            caracteres: finalHtml.length,
            imagenes: imagenesFinales,
            imagenesRemovidas
        });

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