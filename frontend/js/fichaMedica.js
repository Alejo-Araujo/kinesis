import { getAuthToken, mostrarLogin } from "./login.js";
import { mostrarMensaje, mostrar, mostrarConfirmacion } from "./ui.js";
import { API_BASE_URL } from "./config.js";
import { navItemActive } from "./navbar.js";
import { showLoadingIndicator, hideLoadingIndicator } from "./utils.js";


const quillInstances = {};

const BlockEmbed = Quill.import('blots/block/embed');
class AutoAdjustImageBlot extends BlockEmbed {
  static create(value) {
    let node = super.create(value);
    node.setAttribute('src', value);
    node.setAttribute('alt', value);
    
    const img = new Image();
    img.onload = () => {
      //const parentWidth = node.parentNode.offsetWidth;
      //const parentHeight = node.parentNode.offsetHeight;

      if (img.width > img.height) {
        node.style.maxWidth = `700px`;
        node.style.height = 'auto'; 
      } else {
        node.style.maxHeight = '500px';
        node.style.width = 'auto';
      }
      node.style.margin = '0 auto';
    };
    img.src = value; 
    return node;
  }

  static value(node) {
    return node.getAttribute('src');
  }
}

AutoAdjustImageBlot.blotName = 'image';
AutoAdjustImageBlot.tagName = 'img';

Quill.register(AutoAdjustImageBlot);

function setupDiagnosticoListeners() {
        document.querySelectorAll('.diagnostico-btn').forEach(button => {
        button.removeEventListener('click', toggleObservaciones);
        button.addEventListener('click', toggleObservaciones);
    });
}

function escapeHtmlForAttribute(html) {
    if (!html) return '';
    return html.replace(/&/g, '&amp;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
}

function unescapeHtmlFromAttribute(escapedHtml) {
    if (!escapedHtml) return '';
    return escapedHtml.replace(/&quot;/g, '"')
                      .replace(/&#039;/g, "'")
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&amp;/g, '&'); 
}

function setupGuardarObservacionListener() {
    const diagnosticosContainer = document.getElementById('diagnosticosContainer');
    if (diagnosticosContainer) {
        diagnosticosContainer.addEventListener('click', async (event) => {
            const clickedButton = event.target.closest('.btn-guardar-observacion');
            if (clickedButton) { 
                event.preventDefault();

                const diagnosticoEntryId = clickedButton.dataset.diagnosticoEntryId;
                const quillEditorId = clickedButton.dataset.quillInstanceId; 
                const quillEditor = quillInstances[quillEditorId]; 
                
                const nuevasObservacionesHTML = quillEditor ? quillEditor.root.innerHTML : '';

                const success = await updateObservaciones(diagnosticoEntryId, nuevasObservacionesHTML);

                if (success) {
                    mostrarMensaje('Observaciones guardadas exitosamente.', 'success');
                    clickedButton.style.display = 'none'; 
                } else {
                    mostrarMensaje('Error al guardar las observaciones.', 'danger');
                }
            }
        });
    }
}

function toggleObservaciones(event) {
    const button = event.target.closest('.diagnostico-btn');
    if (!button) return; 
    const targetObsId = button.dataset.targetObs;
    const observacionesBox = document.getElementById(targetObsId);
    if (observacionesBox) {
        observacionesBox.classList.toggle('d-none');
            if (!observacionesBox.classList.contains('d-none')) {
                const editorContainerDiv = observacionesBox.querySelector('.quill-editor-target');
                if (editorContainerDiv && !editorContainerDiv.dataset.quillInitialized) { // Evita reinicializar
                const editorId = editorContainerDiv.id;
                const initialContentEscaped = editorContainerDiv.dataset.initialContent || '';
                const initialContent = unescapeHtmlFromAttribute(initialContentEscaped);
                initializeQuill(editorId, initialContent);
                editorContainerDiv.dataset.quillInitialized = 'true'; // Marcar como inicializado DESPUÉS de la inicialización
            }
        }
    }
}

async function inicializarFichaMedica() {
    setupGuardarObservacionListener();
    const btnVerFicha = document.getElementById('btnVerFicha');
    if (btnVerFicha) {
        btnVerFicha.addEventListener('click', async () => {

            await controlarCambiosEnObservaciones();

            const selectedPacienteRow = document.querySelector('#tablaPacientes tbody tr.table-selected');
            if (selectedPacienteRow) {
                const pacienteId = selectedPacienteRow.dataset.pacienteId; 
                if (pacienteId) {
                    const liFichaMedica = document.getElementById('liFichaMedica');
                    if (liFichaMedica.hidden){
                        liFichaMedica.hidden = false;
                    }
                    mostrar('divFichaMedica');
                    navItemActive('divFichaMedica');

                    const pacienteData = await fetchPacienteById(pacienteId);
                    if (pacienteData) {
                        // console.log(pacienteData);
                        renderFichaMedica(pacienteData);
                        //inicializarAgregarDiagnosticoPaciente(pacienteData);
                    }
                } else {
                    mostrarMensaje('No se pudo obtener el ID del paciente seleccionado.', 'warning');
                }
            } else {
                mostrarMensaje('Por favor, selecciona un paciente de la tabla para ver su ficha médica.', 'info');
            }
        });
    }
}

async function fetchPacienteById(id) {
    const token = getAuthToken();
    if (!token) {
        mostrarMensaje('No autorizado: No se encontró token de sesión.', 'danger');
        mostrarLogin();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/pacientes/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                mostrarLogin();
                return; 
            }
            const errorData = await response.json();
            throw new Error(errorData.message || `Error al obtener paciente: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error en fetchPacienteById:', error);
        mostrarMensaje(error.message || 'Error al cargar los datos del paciente.', 'danger');
        return null;
    }
}

async function updateObservaciones(diagnosticoEntryId, nuevasObservaciones) {
    const token = getAuthToken();
    if (!token) {
        mostrarMensaje('No autorizado: No se encontró token de sesión.', 'danger');
        mostrarLogin();
        return;
    }

    try {
        mostrarMensaje('Guardando observaciones...', 'info', 0); // Mostrar mensaje persistente
        const response = await fetch(`${API_BASE_URL}/api/pacientes/diagnosticos/${diagnosticoEntryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ observaciones: nuevasObservaciones })
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                mostrarLogin();
                return; 
            }
            const errorData = await response.json();
            throw new Error(errorData.message || `Error al actualizar observaciones: ${response.statusText}`);
        }

        //mostrarMensaje('Observaciones guardadas exitosamente.', 'success');
        return true;
    } catch (error) {
        console.error('Error al actualizar observaciones:', error);
        //mostrarMensaje(error.message || 'Error al guardar las observaciones.', 'danger');
        return false;
    }
}

async function imageHandler() {
    const quill = this.quill; 

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) {
            return;
        }

        const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
        if (file.size > MAX_SIZE_BYTES) {
            mostrarMensaje('La imagen es demasiado grande. El tamaño máximo permitido es de 2 MB.', 'danger');
            return;
        }


        const formData = new FormData();
        formData.append('image', file);

        const token = getAuthToken();
        if (!token) {
            mostrarMensaje('No autorizado: Token no disponible.', 'danger');
            mostrarLogin();
            return;
        }

        const range = quill.getSelection(true); // Obtén la posición actual del cursor
        const originalIndex = range ? range.index : 0; // Si no hay selección, inserta al inicio

        try {
            const response = await fetch(`${API_BASE_URL}/api/public/upload/image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                const imageUrl = data.url;

                quill.insertEmbed(originalIndex, 'image', imageUrl); // Inserta la imagen
                quill.setSelection(originalIndex + 1); // Mueve el cursor después de la imagen

                mostrarMensaje('Imagen subida y añadida exitosamente.', 'success');
            } else {
                const errorData = await response.json();
                if (response.status === 401 || response.status === 403) {
                    mostrarLogin();
                    return;
                }
                throw new Error(errorData.message || `Error del servidor al subir la imagen: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error en el manejador de subida de imagen de Quill:', error);
            mostrarMensaje('No se pudo subir la imagen: ' + error.message, 'danger');
        }
    };
}

function initializeQuill(editorContainerId, initialContent = '') {
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'direction': 'rtl' }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'font': [] }],
        [{ 'align': [] }],
        ['link', 'image'],
        ['clean']
    ];

    const quill = new Quill(`#${editorContainerId}`, {
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    'image': imageHandler
                }
            }
        },
        placeholder: 'Escribe tus observaciones aquí...',
        theme: 'snow'
    });

    if (initialContent) {
        quill.clipboard.dangerouslyPasteHTML(0, initialContent);
    }
    
    quillInstances[editorContainerId] = quill;

    quill.on('text-change', () => {
        const diagnosticoEntryId = editorContainerId.replace('quill-editor-container-', '');
        const btnGuardar = document.getElementById(`btnGuardar-${diagnosticoEntryId}`);
        if (btnGuardar) {
            btnGuardar.style.display = 'inline-block';
            btnGuardar.dataset.quillInstanceId = editorContainerId; 
        }
    });

    return quill;
}

function renderFichaMedica(paciente) {
    const diagnosticosContainer = document.getElementById('diagnosticosContainer');
    if (!diagnosticosContainer) {
        console.error('El contenedor de diagnósticos no se encontró.');
        return;
    }

    const tableLoadingOverlay = 'tableLoadingOverlayFichaMedica';
    diagnosticosContainer.innerHTML = '';
    showLoadingIndicator(tableLoadingOverlay);
    
    document.getElementById('fichaNombre').textContent = paciente.nomyap || 'N/A';
    let edad = 'N/A';
    if (paciente.fechaNacimiento) {
        const birthDate = new Date(paciente.fechaNacimiento);
        const today = new Date();
        edad = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            edad--;
        }
    }
    document.getElementById('fichaId').textContent = paciente.id;
    document.getElementById('fichaId').dataset.pacienteId = paciente.id;
    document.getElementById('fichaEdad').textContent = edad;
    document.getElementById('fichaGenero').textContent = paciente.genero || 'N/A';
    document.getElementById('fichaTelefono').textContent = paciente.telefono || 'N/A';
    document.getElementById('fichaGmail').textContent = paciente.gmail || 'N/A';
    document.getElementById('fichaActivo').textContent = paciente.activo ? 'Sí' : 'No';

    let fechaCreacion = 'N/A';
    if (paciente.fechaCreacion) {
        const date = new Date(paciente.fechaCreacion);
        fechaCreacion = date.toLocaleDateString('es-ES');
    }
    document.getElementById('fichaFechaCreacion').textContent = fechaCreacion;

    if (paciente.diagnosticos && paciente.diagnosticos.length > 0) {
        paciente.diagnosticos.forEach((diagnostico) => {
            const diagnosticoIdUnico = `obs-${diagnostico.diagnosticoEntryId}`;
            const editorContainerIdUnico = `quill-editor-container-${diagnostico.diagnosticoEntryId}`;
            const btnGuardarIdUnico = `btnGuardar-${diagnostico.diagnosticoEntryId}`;
            const btnEliminarIdUnico = `btnEliminar-${diagnostico.diagnosticoEntryId}`;

            const initialContent = diagnostico.descripcion || '';
            const initialContentEscapedForAttribute = escapeHtmlForAttribute(initialContent);
            
            const diagnosticoHTML = `
                <div class="diagnostico-item mb-3 border p-3 rounded">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <button class="btn btn-primary diagnostico-btn" data-target-obs="${diagnosticoIdUnico}">${diagnostico.diagnosticoNombre || 'Sin Nombre'}</button>
                        <div>
                            <button class="btn btn-success btn-sm me-2 btn-guardar-observacion" id="${btnGuardarIdUnico}" data-diagnostico-entry-id="${diagnostico.diagnosticoEntryId}" style="display: none;" title="Guardar cambios">Guardar</button>
                            <button class="btn btn-danger btn-sm remove-diagnostico-btn" title="Eliminar diagnóstico" id="${btnEliminarIdUnico}" data-diagnostico-nombre="${diagnostico.diagnosticoNombre || 'Sin Nombre'}">x</button>
                        </div>
                    </div>
                    <div id="${diagnosticoIdUnico}" class="observaciones-box d-none mt-2">
                        <label class="form-label">OBSERVACIONES:</label>
                        <div id="${editorContainerIdUnico}" class="quill-editor-target" style="height: 600px; border: 1px solid #ced4da; border-radius: .25rem;" data-initial-content="${initialContentEscapedForAttribute}"></div>
                    </div>
                </div>
            `;

            diagnosticosContainer.insertAdjacentHTML('beforeend', diagnosticoHTML);
        });
        setupDiagnosticoListeners();
    } else {
        diagnosticosContainer.innerHTML = '<p class="text-muted">No se han registrado diagnósticos para este paciente.</p>';
    }
    hideLoadingIndicator(tableLoadingOverlay);
}

async function controlarCambiosEnObservaciones() {
    const divFichaMedica = document.getElementById('divFichaMedica');
    const guardarButtons = divFichaMedica.querySelectorAll('.btn-guardar-observacion')
    let botonDisponible = false;
    for (const btn of guardarButtons) {
        if (btn.style.display === 'inline-block') {
            botonDisponible = true;
            break;
        }
    }

    if (botonDisponible) {
        const confirmacion = await mostrarConfirmacion(
            'Tienes observaciones para guardar en ficha medica, ¿Deseas guardarlas antes de irte?',
            'Cambios sin guardar',
            'Si quiero guardarlas',
            'No quiero guardarlas');
        if (confirmacion) {
            mostrarMensaje('Guardando observaciones...', 'info');
            for (const btn of guardarButtons) {
                if (btn.style.display === 'inline-block') {
                    const diagnosticoEntryId = btn.dataset.diagnosticoEntryId;
                    const quillEditorId = btn.dataset.quillInstanceId; 
                    const quillEditor = quillInstances[quillEditorId]; 
                    const nuevasObservaciones = quillEditor ? quillEditor.root.innerHTML : '';

                    const success = await updateObservaciones(diagnosticoEntryId, nuevasObservaciones);
                    if (success) {
                        btn.style.display = 'none';
                    } else {
                        console.error(`Error al guardar observaciones para el diagnóstico ${diagnosticoEntryId}.`);
                    }
                }
            }
            mostrarMensaje('Observaciones guardadas exitosamente.', 'success');
        } else {
            mostrarMensaje('Cambios descartados', 'warning');
        }
    }
}






export { 
    inicializarFichaMedica, 
    fetchPacienteById,
    renderFichaMedica,
    updateObservaciones
    };