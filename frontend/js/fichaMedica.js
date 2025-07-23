import { getAuthToken, mostrarLogin } from "./login.js";
import { mostrarMensaje, mostrar, mostrarConfirmacion } from "./ui.js";
import { API_BASE_URL } from "./config.js";
import { navItemActive } from "./navbar.js";

function setupDiagnosticoListeners() {
        document.querySelectorAll('.diagnostico-btn').forEach(button => {
        button.removeEventListener('click', toggleObservaciones);
        button.addEventListener('click', toggleObservaciones);
    });
}

function setupGuardarObservacionListener() {
    const diagnosticosContainer = document.getElementById('diagnosticosContainer');
    if (diagnosticosContainer) {
        diagnosticosContainer.addEventListener('click', async (event) => {
            const clickedButton = event.target.closest('.btn-guardar-observacion');
            if (clickedButton) { 
                event.preventDefault();

                const diagnosticoEntryId = clickedButton.dataset.diagnosticoEntryId;
                const tinymceEditor = tinymce.get(clickedButton.dataset.tinymceInstanceId);
                const nuevasObservacionesHTML = tinymceEditor ? tinymceEditor.getContent() : '';

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
                const editorDiv = observacionesBox.querySelector('.tinymce-editor-target');
                if (editorDiv && !editorDiv.dataset.tinymceInitialized) { // Evita reinicializar
                    const editorId = editorDiv.id;
                    const initialContent = editorDiv.dataset.initialContent || '';
                    initializeTinyMCE(editorId, initialContent);
                    editorDiv.dataset.tinymceInitialized = 'true'; // Marcar como inicializado DESPUÉS de intentar la inicialización
                }
            }
    }
}

async function inicializarFichaMedica() {
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

// async function imageHandler(editorInstance) {
//     const input = document.createElement('input');
//     input.setAttribute('type', 'file');
//     input.setAttribute('accept', 'image/*'); 
//     input.click(); 

//     input.onchange = async () => {
//         const file = input.files[0];
//         if (!file) {
//             return; 
//         }

//         const formData = new FormData();
//         formData.append('image', file); // 'image' debe coincidir con el nombre del campo en tu backend (upload.single('image'))

//         const token = getAuthToken();
//         if (!token) {
//             mostrarMensaje('No autorizado: Token no disponible.', 'danger');
//             return;
//         }

//         try {
//             const response = await fetch(`${API_BASE_URL}/api/public/upload/image`, {
//                 method: 'POST',
//                 headers: {
//                     'Authorization': `Bearer ${token}`
//                     // No es necesario 'Content-Type': 'multipart/form-data' aquí pq
//                     // fetch lo establece automáticamente cuando se usa FormData
//                 },
//                 body: formData
//             });

//             if (response.ok) {
//                 const data = await response.json();
//                 const imageUrl = data.url; 
                
//                 // Obtén la instancia de Quill (this.quill se refiere a ella dentro del handler)
//                 editorInstance.insertContent(`<img src="${imageUrl}" alt="Imagen">`);

//                 mostrarMensaje('Imagen subida y añadida exitosamente.', 'success');
//             } else {
//                 const errorData = await response.json();
//                 throw new Error(errorData.message || `Error del servidor al subir la imagen: ${response.statusText}`);
//             }
//         } catch (error) {
//             console.error('Error en el manejador de subida de imagen de TinyMce:', error);
//             mostrarMensaje('No se pudo subir la imagen: ' + error.message, 'danger');
//         }
//     };
// }

function initializeTinyMCE(editorId, initialContent = '') {
    tinymce.init({
        selector: `#${editorId}`, 
        plugins: 'advlist autolink lists link insertdatetime wordcount fullscreen help searchreplace table',
        toolbar: 'undo redo | blocks | ' +
                 'bold italic underline strikethrough | ' +
                 'bullist numlist outdent indent | ' +       
                 'link insertdatetime table | ' +             
                 'searchreplace fullscreen | help',
        min_height: 550, 
        placeholder: 'Escribe tus observaciones aquí...',
        images_upload_handler: (blobInfo, progress) => new Promise((resolve, reject) => {
            const file = blobInfo.blob();
            const formData = new FormData();
            formData.append('image', file, blobInfo.filename()); 

            const token = getAuthToken();
            if (!token) {
                mostrarMensaje('No autorizado: Token no disponible.', 'danger');
                mostrarLogin();
                return;
            }

            fetch(`${API_BASE_URL}/api/public/upload/image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        mostrarLogin();
                        return; 
                    }
                    return response.json().then(errorData => {
                        throw new Error(errorData.message || `Error del servidor al subir la imagen: ${response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                mostrarMensaje('Imagen subida y añadida exitosamente.', 'success');
                resolve(data.url);
            })
            .catch(error => {
                console.error('Error en la subida de imagen de TinyMCE:', error);
                mostrarMensaje('No se pudo subir la imagen: ' + error.message, 'danger');
                reject('Error de subida: ' + error.message);
            });
        }),
        
        font_size_formats: '10px 12px 14px 16px 18px 20px 24px 32px 48px',
        setup: (editor) => {
            editor.on('init', () => {
                editor.setContent(initialContent);
                if (!initialContent || !/<span style="font-size: \d+px;">/.test(initialContent)) {
                    editor.execCommand('FontSize', false, '18px'); 
                }
                editor.undoManager.clear();
            });

            editor.on('change', () => {
                const btnGuardar = document.getElementById(`btnGuardar-${editor.id.replace('editor-', '')}`);
                if (btnGuardar) {
                    btnGuardar.style.display = 'inline-block';
                    //Guarda el ID de la instancia de TinyMCE en el botón de guardar
                    btnGuardar.dataset.tinymceInstanceId = editor.id;
                }
            });
             // También escucha 'input' para capturar cambios más tempranos, como al escribir
            editor.on('input', () => {
                const btnGuardar = document.getElementById(`btnGuardar-${editor.id.replace('editor-', '')}`);
                if (btnGuardar) {
                    btnGuardar.style.display = 'inline-block';
                    btnGuardar.dataset.tinymceInstanceId = editor.id;
                }
            });
        }
    });
}


function renderFichaMedica(paciente) {
    const diagnosticosContainer = document.getElementById('diagnosticosContainer');
    if (!diagnosticosContainer) {
        console.error('El contenedor de diagnósticos no se encontró.');
        return;
    }

    if (typeof tinymce !== 'undefined') {
        tinymce.remove(); // Elimina todas las instancias de TinyMCE
    }

    diagnosticosContainer.innerHTML = '';

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
            // Genera IDs únicos para los elementos de cada diagnóstico usando diagnosticoEntryId
            const diagnosticoIdUnico = `obs-${diagnostico.diagnosticoEntryId}`; 
            const editorTextoIdUnico = `editor-${diagnostico.diagnosticoEntryId}`;
            const btnGuardarIdUnico = `btnGuardar-${diagnostico.diagnosticoEntryId}`;
            const btnEliminarIdUnico = `btnEliminar-${diagnostico.diagnosticoEntryId}`;

            const initialContentEscaped = diagnostico.descripcion ? diagnostico.descripcion.replace(/"/g, '&quot;') : '';

            const diagnosticoHTML = `
                <div class="diagnostico-item mb-3 border p-3 rounded">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <button class="btn btn-primary diagnostico-btn" data-target-obs="${diagnosticoIdUnico}" >${diagnostico.diagnosticoNombre || 'Sin Nombre'}</button>
                        <div>
                            <button class="btn btn-success btn-sm me-2 btn-guardar-observacion" id="${btnGuardarIdUnico}" data-diagnostico-entry-id="${diagnostico.diagnosticoEntryId}" style="display: none;" title="Guardar cambios">Guardar</button>
                            <button class="btn btn-danger btn-sm remove-diagnostico-btn" title="Eliminar diagnóstico" id="${btnEliminarIdUnico}" data-diagnostico-nombre="${diagnostico.diagnosticoNombre || 'Sin Nombre'}">x</button>
                        </div>
                    </div>
                    <div id="${diagnosticoIdUnico}" class="observaciones-box d-none mt-2">
                        <label for="${editorTextoIdUnico}" class="form-label">OBSERVACIONES:</label>
                        <textarea id="${editorTextoIdUnico}" class="tinymce-editor-target" style="height: 100px; border: 1px solid #ced4da; border-radius: .25rem;" data-initial-content="${initialContentEscaped}"></textarea>
                    </div>
                </div>
            `;

            diagnosticosContainer.insertAdjacentHTML('beforeend', diagnosticoHTML);
        });
        setupDiagnosticoListeners();
        setupGuardarObservacionListener();
    } else {
        diagnosticosContainer.innerHTML = '<p class="text-muted">No se han registrado diagnósticos para este paciente.</p>';
    }
}

async function controlarCambiosEnObservaciones(){
    const divFichaMedica = document.getElementById('divFichaMedica');
    const guardarButtons = divFichaMedica.querySelectorAll('.btn-guardar-observacion')
    let botonDisponible = false;
    for (const btn of guardarButtons) {
        if (btn.style.display === 'inline-block') {
            botonDisponible = true;
            break;
        }
        }
        
        if(botonDisponible){
            const confirmacion = await mostrarConfirmacion(
                'Tienes observaciones para guardar en ficha medica, ¿Deseas guardarlas antes de irte?',
                'Cambios sin guardar',
                'Si quiero guardarlas',
                'No quiero guardarlas');
            if (confirmacion){
                mostrarMensaje('Guardando observaciones...', 'info');
                    for (const btn of guardarButtons) {
                        if (btn.style.display === 'inline-block') {
                            const diagnosticoEntryId = btn.dataset.diagnosticoEntryId;
                            const tinymceEditor = tinymce.get(btn.dataset.tinymceInstanceId);
                            const nuevasObservaciones = tinymceEditor ? tinymceEditor.getContent() : '';
                            const success = await updateObservaciones(diagnosticoEntryId, nuevasObservaciones);
                            if (success) {
                                btn.style.display = 'none';
                                if (tinymceEditor) tinymceEditor.undoManager.clear();
                            } else {
                                console.error(`Error al guardar observaciones para el diagnóstico ${diagnosticoEntryId}.`);
                            }
                        }
                    }
                mostrarMensaje('Observaciones guardadas exitosamente.', 'success');
            }else{
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