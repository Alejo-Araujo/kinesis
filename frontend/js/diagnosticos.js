import { API_BASE_URL } from "./config.js";
import { getAuthToken, mostrarLogin } from "./login.js";
import { showLoadingIndicator, hideLoadingIndicator, populateAllDiagnosticosSelects } from "./utils.js" ;
import { mostrarConfirmacion, mostrarMensaje } from "./ui.js";
import { renderFichaMedica, fetchPacienteById } from "./fichaMedica.js";


function disableNombreDiagnosticoButtons(){
    const btnModificarDiagnostico = document.getElementById('btnModificarNombreDiagnostico');
    const btnEliminarDiagnostico = document.getElementById('btnEliminarNombreDiagnostico');
    if (btnModificarDiagnostico) btnModificarDiagnostico.disabled = true;
    if (btnEliminarDiagnostico) btnEliminarDiagnostico.disabled = true;
}

function enableNombreDiagnosticoButtons(){
    const btnModificarDiagnostico = document.getElementById('btnModificarNombreDiagnostico');
    const btnEliminarDiagnostico = document.getElementById('btnEliminarNombreDiagnostico');
    if (btnModificarDiagnostico) btnModificarDiagnostico.disabled = false;
    if (btnEliminarDiagnostico) btnEliminarDiagnostico.disabled = false;
} 

    
async function fetchDiagnosticos() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/diagnosticos`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        }); 
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                mostrarLogin();
                return; 
            }          
            const errorData = await response.text();
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener los fisioterapeutas' }`);
        }
        const data = await response.json();
        return data; 
    } catch (error) {
        console.error("Error al obtener los diagnósticos:", error);
        throw error;
    }
};

function inicializarNombreDiagnostico(){
    const tablaNombreDiagnosticosBody = document.querySelector('#tablaNombresDiagnosticos tbody');
    if (tablaNombreDiagnosticosBody) {
        tablaNombreDiagnosticosBody.addEventListener('click', (event) => {
            let clickedRow = event.target.closest('tr');
            if (clickedRow) {
                const currentSelected = tablaNombreDiagnosticosBody.querySelector('.table-selected');
                if (currentSelected && currentSelected !== clickedRow) {
                    currentSelected.classList.remove('table-selected');
                }
                clickedRow.classList.toggle('table-selected');

                if (clickedRow.classList.contains('table-selected')) {
                    enableNombreDiagnosticoButtons();
                } else {
                    disableNombreDiagnosticoButtons();
                }
            }
        });
    }
    renderNombresDiagnosticosTable();
};

async function renderNombresDiagnosticosTable (){
    const tablaNombreDiagnosticosBody = document.querySelector('#tablaNombresDiagnosticos tbody');
    const tableLoadingOverlayDiagnostico = 'tableLoadingOverlayDiagnostico';
        if (!tablaNombreDiagnosticosBody) return;

        disableNombreDiagnosticoButtons();
        tablaNombreDiagnosticosBody.innerHTML = '';
        showLoadingIndicator(tableLoadingOverlayDiagnostico);
    
        try {
            const nombresDiagnosticos = await fetchDiagnosticos();
            if (nombresDiagnosticos.length === 0) {
                const row = tablaNombreDiagnosticosBody.insertRow();
                const cell = row.insertCell(0);
                cell.colSpan = 5; 
                cell.textContent = 'No hay diagnosticos registrados.';
                cell.classList.add('text-center', 'text-muted');
                return;
            }
    
            nombresDiagnosticos.forEach(nombreDiagnostico => {
                const row = tablaNombreDiagnosticosBody.insertRow();
                row.dataset.id = nombreDiagnostico.id;
    
                // row.insertCell(0).textContent = nombreDiagnostico.id; 
                row.insertCell(0).textContent = nombreDiagnostico.nombre;
    
            });
        } catch (error) {
            console.error('Error al renderizar la tabla de diagnosticos:', error);
            tablaNombreDiagnosticosBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error al cargar los diagnosticos: ${error.message}</td></tr>`;
        } finally {
            hideLoadingIndicator(tableLoadingOverlayDiagnostico);
        }
};

function inicializarAgregarModificarNombreDiagnostico(){
    const formAgregarDiagnostico = document.getElementById('formAgregarDiagnostico');
    const btnGuardarDiagnostico = document.getElementById('btnGuardarDiagnostico');
    
    const modalElement = document.getElementById('modalAgregarDiagnostico');
    const modalAgregarDiagnostico = new bootstrap.Modal(document.getElementById('modalAgregarDiagnostico')); 
    const modalTitle = modalElement.querySelector('.modal-title');

    const inputNombreDiagnostico = document.getElementById('inputNombreDiagnostico');

    if (inputNombreDiagnostico) { 
        inputNombreDiagnostico.addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase();
        });
    }

         modalElement.addEventListener('show.bs.modal', (event) => {
            formAgregarDiagnostico.reset(); 
            formAgregarDiagnostico.classList.remove('was-validated'); 
            const button = event.relatedTarget;
            const mode = button.dataset.mode;
            if (mode === 'add') {
                modalTitle.textContent = 'Agregar Nuevo Diagnostico';
                btnGuardarDiagnostico.textContent = 'Guardar Diagnostico';
                formAgregarDiagnostico.reset(); 
                formAgregarDiagnostico.classList.remove('was-validated'); 
                modalElement.dataset.currentMode = 'add';
            } else {
                modalTitle.textContent = 'Modificar nombre del diagnostico';
                btnGuardarDiagnostico.textContent = 'Guardar nombre nuevo';
                formAgregarDiagnostico.reset(); 
                formAgregarDiagnostico.classList.remove('was-validated'); 
                modalElement.dataset.currentMode = 'edit';

                const selectedDiagnosticoRow = document.querySelector('#tablaNombresDiagnosticos tbody tr.table-selected');
                if (selectedDiagnosticoRow) {
                const diagnosticoId = selectedDiagnosticoRow.dataset.id; 
                if (!diagnosticoId) mostrarMensaje('No se pudo obtener el ID del diagnostico seleccionado.', 'warning');
                } else {
                    mostrarMensaje('Por favor, seleccione un diagnostico de la lista', 'warning');
                }
                
    
    
            }
        });

    if (btnGuardarDiagnostico) {
        btnGuardarDiagnostico.addEventListener('click', async (event) => {
            event.preventDefault(); 
            const mode = modalElement.dataset.currentMode;
            
            if (!formAgregarDiagnostico.checkValidity()) {
                formAgregarDiagnostico.classList.add('was-validated'); 
                return;
            }

            if(mode === 'add'){
                const confirmacion = await mostrarConfirmacion('¿Está seguro que desea guardar este diagnostico?'); 
                if (!confirmacion) {
                    mostrarMensaje('Alta de diagnostico cancelada.', 'info');
                    return; 
            }
            } else {
                const confirmacion = await mostrarConfirmacion('¿Está seguro que desea modificar el nombre de este diagnostico?'); 
                if (!confirmacion) {
                    mostrarMensaje('Modificación de nombre cancelada.', 'info');
                    return;
                }
            }

            const diagnosticoData = {
                nombre: inputNombreDiagnostico.value
            };

            const token = getAuthToken();

            if (!token) {
                mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                mostrarLogin();
                return;
            }

            if(mode === 'add'){
            try {
                const response = await fetch(`${API_BASE_URL}/api/diagnosticos/agregarNombreDiagnostico`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(diagnosticoData)
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        console.error('Error de autorización al agregar diagnostico. Token inválido o expirado. Cerrando sesión.');
                        mostrarLogin();
                        return;
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Error al agregar diagnostico: ${response.statusText}`);
                }

               // const result = await response.json();
                mostrarMensaje('Diagnostico agregado exitosamente.', 'success');

                modalAgregarDiagnostico.hide();
                formAgregarDiagnostico.reset();
                formAgregarDiagnostico.classList.remove('was-validated');
                renderNombresDiagnosticosTable();
                populateAllDiagnosticosSelects();


            } catch (error) {
                console.error('Error al agregar diagnostico:', error);
                mostrarMensaje(error.message || 'Error al agregar diagnostico.', 'danger');
            }

        }else{
            try {
                const selectedDiagnosticoRow = document.querySelector('#tablaNombresDiagnosticos tbody tr.table-selected');
                const diagnosticoId = selectedDiagnosticoRow.dataset.id;
                const response = await fetch(`${API_BASE_URL}/api/diagnosticos/modificarNombreDiagnostico/${diagnosticoId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(diagnosticoData)
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        mostrarMensaje('Error de autorización al modificar diagnostico. Token inválido o expirado. Cerrando sesión.', 'danger');
                        mostrarLogin();
                        return;
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Error al modificar diagnostico: ${response.statusText}`);
                }

                mostrarMensaje('Diagnostico modificado exitosamente.', 'success');

                modalAgregarDiagnostico.hide();
                formAgregarDiagnostico.reset();
                formAgregarDiagnostico.classList.remove('was-validated');
                renderNombresDiagnosticosTable();
                populateAllDiagnosticosSelects();


            } catch (error) {
                console.error('Error al modificar diagnostico:', error);
                mostrarMensaje(error.message || 'Error al modificar diagnostico.', 'danger');
            }
        }
        });
    }
};

function inicializarEliminarNombreDiagnostico(){
    const btnEliminarDiagnostico = document.getElementById('btnEliminarNombreDiagnostico');

    if (btnEliminarDiagnostico) {
        btnEliminarDiagnostico.addEventListener('click', async (event) => {
            event.preventDefault(); 
            const confirmacion = await mostrarConfirmacion('¿Está seguro que desea eliminar este diagnostico?');
            
            if (!confirmacion) {
                mostrarMensaje('Eliminación de diagnostico cancelada.', 'info');
                return; 
            }

            const token = getAuthToken();

            if (!token) {
                console.error('No hay token de autenticación disponible. Redirigiendo al login.');
                mostrarLogin();
                return;
            }
            const selectedPacienteRow = document.querySelector('#tablaNombresDiagnosticos tbody tr.table-selected');
            const id = selectedPacienteRow.dataset.id;

            try {
                const response = await fetch(`${API_BASE_URL}/api/diagnosticos/eliminarNombreDiagnostico/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        console.error('Error de autorización al eliminar nombre diagnostico. Token inválido o expirado. Cerrando sesión.');
                        return;
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Error al eliminar diagnostico: ${response.statusText}`);
                }

               // const result = await response.json();
                mostrarMensaje('Diagnostico eliminado exitosamente.', 'success');
                renderNombresDiagnosticosTable();
                populateAllDiagnosticosSelects();

            } catch (error) {
                console.error('Error al eliminar nombre diagnostico:', error);
                mostrarMensaje(error.message || 'Error al eliminar diagnostico.', 'danger');
            }
        });
    }
};

function inicializarAgregarDiagnosticoPaciente(){
const btnAgregarDiagnosticoPaciente = document.getElementById('btnAgregarDiagnosticoPaciente2');
const modalAgregarDiagnostico = new bootstrap.Modal(document.getElementById('modalAgregarDiagnosticoPaciente')); 

    if (btnAgregarDiagnosticoPaciente) {
        btnAgregarDiagnosticoPaciente.addEventListener('click', async (event) => {
            event.preventDefault();
            const formAgregarDiagnosticoPaciente = document.getElementById('formAgregarDiagnosticoPaciente');

            
            const pacienteIdTexto = document.getElementById('fichaId').dataset.pacienteId;
            const pacienteId = +pacienteIdTexto;
            const selectNombreDiagnostico = document.getElementById('selectDiagnosticosPaciente');
            // console.log(selectNombreDiagnostico);
            const nombreDiagnostico = selectNombreDiagnostico.options[selectNombreDiagnostico.selectedIndex].text 
            
            if (!selectNombreDiagnostico.value) {
                mostrarMensaje('Elija un diagnostico', 'warning');
                return;
            }

            const confirmacion = await mostrarConfirmacion(`¿Está seguro que desea agregarle el diagnostico ${nombreDiagnostico}?`);
            
            if (!confirmacion) {
                mostrarMensaje('Alta de diagnostico cancelada.', 'info');
                return; 
            }

            const diagnosticoData = {
                idNombreDiagnostico: selectNombreDiagnostico.value,
                idPaciente: pacienteId
            };

            const token = getAuthToken();

            if (!token) {
                mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                mostrarLogin();
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/diagnosticos/agregarDiagnostico`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(diagnosticoData)
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        mostrarMensaje('Error de autorización al agregar diagnostico. Token inválido o expirado. Cerrando sesión.', 'danger');
                        mostrarLogin();
                        return;
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Error al agregar diagnostico: ${response.statusText}`);
                }

               // const result = await response.json();
                mostrarMensaje('Diagnostico agregado exitosamente.', 'success');

                modalAgregarDiagnostico.hide();
                formAgregarDiagnosticoPaciente.reset();
                formAgregarDiagnosticoPaciente.classList.remove('was-validated');

                const pacienteFetcheado = await fetchPacienteById(pacienteId);
                if(pacienteFetcheado){
                    renderFichaMedica(pacienteFetcheado);
                } else {
                    mostrarMensaje('No se pudo actualizar la ficha médica.', 'warning');
                }

            } catch (error) {
                console.error('Error al agregar diagnostico:', error);
                mostrarMensaje(error.message || 'Error al agregar diagnostico.', 'danger');
            }
        });
    }





};

function inicializarEliminarDiagnosticoPaciente(){
const diagnosticosContainer = document.getElementById('diagnosticosContainer');
    if (diagnosticosContainer) {
        diagnosticosContainer.addEventListener('click', async (event) => {
            const clickedButton = event.target.closest('.remove-diagnostico-btn');
            if (clickedButton) {
                event.preventDefault();

                const pacienteIdTexto = document.getElementById('fichaId').dataset.pacienteId;
                const pacienteId = +pacienteIdTexto;

                const diagnosticoNombre = clickedButton.dataset.diagnosticoNombre; 
                const confirmacion = await mostrarConfirmacion(`¿Está seguro que desea eliminar el diagnostico 
                    ${diagnosticoNombre} y sus observaciones?`, 'Eliminar Elemento', 'Sí, Eliminar', 'Cancelar', 'btn-danger');

                const btnId = clickedButton.id; // btnEliminar-12345
                const diagnosticoId = btnId.split('-')[1]; // 12345

                if(!confirmacion){
                    mostrarMensaje('No se eliminó el diagnóstico', 'info');
                    return;
                }

                const token = getAuthToken();

                if (!token){
                    mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                    mostrarLogin();
                    return;
                }
                
                try {
                    const response = await fetch(`${API_BASE_URL}/api/diagnosticos/eliminarDiagnostico/${diagnosticoId}`,{
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                });

                 if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        mostrarMensaje('Error de autorización al eliminar diagnostico. Token inválido o expirado. Cerrando sesión.','danger');
                        mostrarLogin();
                        return;
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Error al eliminar diagnostico: ${response.statusText}`);
                }

                // const result = await response.json();
                mostrarMensaje('Diagnostico eliminado exitosamente.', 'success');

                const pacienteFetcheado = await fetchPacienteById(pacienteId);
                if(pacienteFetcheado){
                    renderFichaMedica(pacienteFetcheado);
                } else {
                    mostrarMensaje('No se pudo actualizar la ficha médica.', 'warning');
                }







                } catch(error) {
                    console.error('Error al eliminar el diagnostico:', error);
                    mostrarMensaje(error.message || 'Error al eliminar diagnostico.', 'danger');
                }

            }
        });
    }
};


export { 
    fetchDiagnosticos, 
    inicializarNombreDiagnostico, 
    renderNombresDiagnosticosTable,
    inicializarAgregarModificarNombreDiagnostico,
    inicializarAgregarDiagnosticoPaciente,
    inicializarEliminarDiagnosticoPaciente,
    inicializarEliminarNombreDiagnostico
 };