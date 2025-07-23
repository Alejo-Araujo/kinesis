import { API_BASE_URL } from './config.js';
import { getAuthToken, mostrarLogin } from './login.js';
import { mostrarMensaje, mostrarConfirmacion } from './ui.js';
import { debounce, showLoadingIndicator, hideLoadingIndicator, separarNumeroConRegex  } from './utils.js';
import { fetchPacienteById } from './fichaMedica.js';

const countryCodes = [
    { code: '+598', name: 'Uruguay (+598)' },
    { code: '+54', name: 'Argentina (+54)' },
    { code: '+55', name: 'Brasil (+55)' },
    { code: '+56', name: 'Chile (+56)' },
    { code: '+595', name: 'Paraguay (+595)' },
    { code: '+51', name: 'Perú (+51)' },
    { code: '+34', name: 'España (+34)' },
];

// Función para llenar el select de códigos de país
function populateCountryCodesSelect() {
    const selectCodigoPais = document.getElementById('selectCodigoPais');
    if (selectCodigoPais) {
        selectCodigoPais.innerHTML = '';

        countryCodes.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = country.name;
            if (country.code === '+598') {
                option.selected = true;
            }
            selectCodigoPais.appendChild(option);
        });
    }
}

let currentPage = 1;
const limitPerPage = 200;


function setActionButtonsState(enable, buttons = []) {
   // console.log(buttons);
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = !enable;
            }
        });
}

function inicializarPatientTable(
    tablaPacientesParam,
    inputBuscarNombreParam,
    inputBuscarCedulaParam,
    selectDiagnosticoBuscarParam,
    selectActiveParam,
    contadorPacientesParam,
    paginationControlsParam,
    actionButtonIds = [],
    tableLoadingOverlay 
) {
    

    setActionButtonsState(false,actionButtonIds);

    // Controla la seleccion de filas
    const tablaPacientesBody = document.querySelector(`#${tablaPacientesParam} tbody`);
    if (tablaPacientesBody) {
        let selectedPacienteId = null;
        tablaPacientesBody.addEventListener('click', (event) => {
            let clickedRow = event.target.closest('tr');
            if (clickedRow) {
                const currentSelected = tablaPacientesBody.querySelector('.table-selected');
                if (currentSelected && currentSelected !== clickedRow) {
                    currentSelected.classList.remove('table-selected');
                }
                clickedRow.classList.toggle('table-selected');

                if (clickedRow.classList.contains('table-selected')) {
                    selectedPacienteId = clickedRow.dataset.pacienteId;
                    setActionButtonsState(true,actionButtonIds);
                } else {
                    selectedPacienteId = null;
                    setActionButtonsState(false,actionButtonIds);
                }
            }
        });
    }
    // disablePatientActionButtons();

    const selectDiagnosticosBuscar = document.getElementById(`${selectDiagnosticoBuscarParam}`);
    const inputBuscarNombre = document.getElementById(`${inputBuscarNombreParam}`);
    const inputBuscarCedula = document.getElementById(`${inputBuscarCedulaParam}`);
    const selectActive = document.getElementById(`${selectActiveParam}`);

    //Event listeners para los filtrosssss
    const applyFilters = debounce(() => {
        currentPage = 1;
        renderPacientesTable(
            tablaPacientesParam,
            contadorPacientesParam,
            paginationControlsParam,
            selectDiagnosticoBuscarParam,
            inputBuscarNombreParam,
            inputBuscarCedulaParam,
            selectActiveParam,
            actionButtonIds,
            tableLoadingOverlay
        );
    }, 200);

    if (selectDiagnosticosBuscar) {
        selectDiagnosticosBuscar.addEventListener('change', applyFilters);
    }
    if (inputBuscarNombre) {
        inputBuscarNombre.addEventListener('input', applyFilters);
    }
    if (inputBuscarCedula) {
        inputBuscarCedula.addEventListener('input', applyFilters);
    }
    if (selectActive) {
        selectActive.innerHTML = `
            <option value="1">Activos</option>
            <option value="0">No activos</option>
            <option value="">Todos</option>
        `;
        selectActive.value = '1'; 
        selectActive.addEventListener('change', applyFilters);
    }
    
    renderPacientesTable(
        tablaPacientesParam,
        contadorPacientesParam,
        paginationControlsParam,
        selectDiagnosticoBuscarParam,
        inputBuscarNombreParam,
        inputBuscarCedulaParam,
        selectActiveParam,
        actionButtonIds,
        tableLoadingOverlay
    );
}

function getFilterParams(
    selectDiagnosticoBuscarParam,
    inputBuscarNombreParam,
    inputBuscarCedulaParam,
    selectActiveParam

) {
    const selectDiagnosticosBuscar = document.getElementById(`${selectDiagnosticoBuscarParam}`);
    const inputBuscarNombre = document.getElementById(`${inputBuscarNombreParam}`);
    const inputBuscarCedula = document.getElementById(`${inputBuscarCedulaParam}`);
    const selectActive = document.getElementById(`${selectActiveParam}`);

    const params = new URLSearchParams();

    if (selectDiagnosticosBuscar && selectDiagnosticosBuscar.value) {
        params.append('diagnosticoId', selectDiagnosticosBuscar.value);
    }

    if (inputBuscarNombre && inputBuscarNombre.value.trim()) {
        params.append('nombre', inputBuscarNombre.value.trim());
    }

    if (inputBuscarCedula && inputBuscarCedula.value.trim()) {
        params.append('cedula', inputBuscarCedula.value.trim());
    }

    if (selectActive) {
        if (selectActive.value !== '') {
            params.append('activo', selectActive.value);
        }
    }

    params.append('page', currentPage);
    params.append('limit', limitPerPage);

    return params.toString();
}


async function fetchPacientes(
    selectDiagnosticoBuscarParam,
    inputBuscarNombreParam,
    inputBuscarCedulaParam,
    selectActiveParam
) { 
    const filterParams = getFilterParams(
        selectDiagnosticoBuscarParam, 
        inputBuscarNombreParam, 
        inputBuscarCedulaParam, 
        selectActiveParam
    );
    const url = `${API_BASE_URL}/api/pacientes?${filterParams}`;

    try {
        const response = await fetch(url, {
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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener los pacientes'}`);
        }
        const data = await response.json(); 
        return data;
    } catch (error) {
        console.error('Error en fetchPacientes:', error);
        throw error;
    }
}

async function renderPacientesTable(
    tablaPacientesParam,
    contadorPacientesParam,
    paginationControlsParam,
    selectDiagnosticoBuscarParam,
    inputBuscarNombreParam,
    inputBuscarCedulaParam,
    selectActiveParam,
    actionButtonIds = [],
    tableLoadingOverlay
) {
    setActionButtonsState(false,actionButtonIds);
    showLoadingIndicator(tableLoadingOverlay);
    const tablaPacientesBody = document.querySelector(`#${tablaPacientesParam} tbody`);
    const contador = document.getElementById(`${contadorPacientesParam}`);
    const paginationControls = document.getElementById(`${paginationControlsParam}`);
    if (!tablaPacientesBody || !paginationControls || !contador) {
        console.log(tablaPacientesBody, paginationControls, contador);
        return;
    }

    tablaPacientesBody.innerHTML = '';
    paginationControls.innerHTML = '';

    try {
        const data = await fetchPacientes(selectDiagnosticoBuscarParam, inputBuscarNombreParam, inputBuscarCedulaParam, selectActiveParam);
        const pacientes = data.pacientes;
        const totalPages = data.totalPages;

        if (pacientes.length === 0) {
            const row = tablaPacientesBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 5; 
            cell.textContent = 'No hay pacientes registrados.';
            cell.classList.add('text-center', 'text-muted');
            contador.textContent = 0;
            return;
        }
        contador.textContent = pacientes.length;
        
        pacientes.forEach(paciente => {
            const row = tablaPacientesBody.insertRow();
            row.id = `paciente-${paciente.idPaciente}`;
            row.dataset.pacienteId = paciente.id;

            if (paciente.activo === 0) {
                row.classList.add('table-inactive'); 
            } 
             else {
                row.classList.add('table-active'); 
             }
            row.insertCell(0).textContent = paciente.id; 
            row.insertCell(1).textContent = paciente.nomyap;
            row.insertCell(2).textContent = paciente.cedula;
            row.insertCell(3).textContent = paciente.diagnosticos || '---';
            row.insertCell(4).textContent = paciente.telefono || '---';
            row.insertCell(5).textContent = paciente.gmail || '---';
            row.insertCell(6).textContent = paciente.activo ? 'Si' : 'No';

        });
        
        renderPaginationControls(
        tablaPacientesParam, 
        contadorPacientesParam, 
        paginationControlsParam,
        selectDiagnosticoBuscarParam,
        inputBuscarNombreParam,
        inputBuscarCedulaParam,
        selectActiveParam,
        actionButtonIds,
        totalPages
        );

    } catch (error) {
        console.error('Error al renderizar la tabla de pacientes:', error);
        tablaPacientesBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error al cargar los pacientes: ${error.message}</td></tr>`;
    } finally {
        hideLoadingIndicator(tableLoadingOverlay);
    }
}

function renderPaginationControls(
    tablaPacientesParam, 
    contadorPacientesParam, 
    paginationControlsParam,
    selectDiagnosticoBuscarParam,
    inputBuscarNombreParam,
    inputBuscarCedulaParam,
    selectActiveParam,
    actionButtonIds = [],
    totalPages
) {
    const paginationControls = document.getElementById(`${paginationControlsParam}`);
    paginationControls.innerHTML = '';

    if (totalPages <= 1) {
        return;
    }

    for (let i = 1; i <= totalPages; i++) {
        const pageLi = document.createElement('li');
        pageLi.classList.add('page-item');
        if (i === currentPage) pageLi.classList.add('active');
        const pageLink = document.createElement('a');
        pageLink.classList.add('page-link');
        pageLink.href = '#';
        pageLink.textContent = i;
        pageLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentPage = i;
            renderPacientesTable(
                tablaPacientesParam, 
                contadorPacientesParam, 
                paginationControlsParam,
                selectDiagnosticoBuscarParam,
                inputBuscarNombreParam,
                inputBuscarCedulaParam,
                actionButtonIds,
                selectActiveParam
            );
        });
        pageLi.appendChild(pageLink);
        paginationControls.appendChild(pageLi);
    }
}

//EN CALENDARIO LO HICE DISTINTO AL TEMA DEL ADD Y EL EDIT PERO AMBOS ESTAN BIEN
function inicializarAgregarModificarPaciente() {

    const modalElement = document.getElementById('modalAgregarPaciente');
    const modalAgregarPaciente = new bootstrap.Modal(modalElement); 

    const modalTitle = modalElement.querySelector('.modal-title');
    const btnGuardarPaciente = document.getElementById('btnGuardarPaciente');
        
    const formAgregarPaciente = document.getElementById('formAgregarPaciente');
    
    const inputAgregarNombreApellido = document.getElementById('inputAgregarNombreApellido');
    const inputCedula = document.getElementById('inputAgregarCedula');
    const inputFechaNacimiento = document.getElementById('inputAgregarFechaNacimiento');
    const selectCodigoPais = document.getElementById('selectCodigoPais');
    const inputNumeroLocal = document.getElementById('inputAgregarTelefono');  
    const inputGmail = document.getElementById('inputAgregarGmail');
    const selectGenero = document.getElementById('selectAgregarGenero');

    if (inputAgregarNombreApellido) { 
            inputAgregarNombreApellido.addEventListener('input', (event) => {
            event.target.value = event.target.value.toUpperCase();
            });
        }
    
    modalElement.addEventListener('show.bs.modal', async function (event) {
        populateCountryCodesSelect();
        const button = event.relatedTarget;
        const mode = button.dataset.mode;

        if (mode === 'add') {
        modalTitle.textContent = 'Agregar Nuevo Paciente';
        btnGuardarPaciente.textContent = 'Guardar Paciente';
        formAgregarPaciente.reset(); // Limpia el formulario para un nuevo paciente
        formAgregarPaciente.classList.remove('was-validated'); 
        modalElement.dataset.currentMode = 'add';     

    } else {

        modalTitle.textContent = 'Modificar información del paciente';
        btnGuardarPaciente.textContent = 'Actualizar datos';
        formAgregarPaciente.reset(); // Limpia el formulario para un nuevo paciente
        formAgregarPaciente.classList.remove('was-validated');         
        modalElement.dataset.currentMode = 'edit';

        const selectedPacienteRow = document.querySelector('#tablaPacientes tbody tr.table-selected');
        if (selectedPacienteRow) {
                const pacienteId = selectedPacienteRow.dataset.pacienteId; 
                if (pacienteId) {
                    
                    const pacienteData = await fetchPacienteById(pacienteId);
                    if (pacienteData) {
                        inputAgregarNombreApellido.value = pacienteData.nomyap;
                        inputCedula.value = pacienteData.cedula;
                        inputFechaNacimiento.value = pacienteData.fechaNacimiento.split('T')[0];
                        const nroRegex = separarNumeroConRegex(pacienteData.telefono);
                        selectCodigoPais.value = nroRegex.codigoPais; 
                        inputNumeroLocal.value = nroRegex.numeroTelefono;

                        inputGmail.value = pacienteData.gmail;
                        selectGenero.value = pacienteData.genero;

                    }
                } else {
                    mostrarMensaje('No se pudo obtener el ID del paciente seleccionado.', 'warning');
                }
            } else {
                mostrarMensaje('Por favor, selecciona un paciente de la tabla para modificar sus datos.', 'info');
            }
    }
    });

        btnGuardarPaciente.addEventListener('click', async (event) => {
        event.preventDefault(); 
        const currentMode = modalElement.dataset.currentMode;
            
        if (!formAgregarPaciente.checkValidity()) {
            formAgregarPaciente.classList.add('was-validated'); 
            return;
        }

        if(currentMode === 'add'){
            const confirmacion = await mostrarConfirmacion('¿Está seguro que desea guardar este paciente?');
            if (!confirmacion) {
                mostrarMensaje('Alta de paciente cancelada.', 'info');
                return; 
            }
        } else {
            const confirmacion = await mostrarConfirmacion('¿Está seguro que desea modificar los datos de este paciente?');
            if (!confirmacion) {
                mostrarMensaje('Modificación de datos de paciente cancelada.', 'info');
                return; 
            }
        }  
            
            const codigoPais = selectCodigoPais.value;
            const numeroLocal = inputNumeroLocal.value.replace(/\D/g, ''); 
            const fechaInscripcion = new Date();

            const pacienteData = {
                nomyap: inputAgregarNombreApellido.value,
                cedula: inputCedula.value,
                fechaNacimiento: inputFechaNacimiento.value,
                telefono: `${codigoPais}${numeroLocal}`,
                fechaCreacion: fechaInscripcion,
                gmail: inputGmail.value,
                genero: selectGenero.value,
            };

            const token = getAuthToken();

            if (!token) {
                mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                mostrarLogin();
                return;
            }

            if(currentMode ==='add'){
                try {
                    const response = await fetch(`${API_BASE_URL}/api/pacientes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(pacienteData)
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            mostrarMensaje('Error de autorización al agregar paciente. Token inválido o expirado. Cerrando sesión.', 'danger');
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al agregar paciente: ${response.statusText}`);
                    }

                    // const result = await response.json();
                    mostrarMensaje('Paciente agregado exitosamente.', 'success');

                    modalAgregarPaciente.hide();
                    formAgregarPaciente.reset();
                    formAgregarPaciente.classList.remove('was-validated');
                    renderPacientesTable(
                        'tablaPacientes', // ID de la tabla principal
                        'contadorPacientes',
                        'paginationControls',
                        'selectDiagnosticosBuscar',
                        'inputBuscarNombre',
                        'inputBuscarCedula',
                        'selectActive',
                        ['btnVerFicha', 'btnModificarDatosPersonales', 'btnEliminarPaciente'],
                        'tableLoadingOverlay'
                    );

                } catch (error) {
                    console.error('Error al agregar paciente:', error);
                    mostrarMensaje(error.message || 'Error al agregar paciente.', 'danger');
                }
            } else {
                const selectedPacienteRow = document.querySelector('#tablaPacientes tbody tr.table-selected');
                if (selectedPacienteRow){
                const id = selectedPacienteRow.dataset.pacienteId;
                try {
                    const response = await fetch(`${API_BASE_URL}/api/pacientes/modificarPaciente/${id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(pacienteData)
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            mostrarMensaje('Error de autorización al modificar datos. Token inválido o expirado. Cerrando sesión.', 'danger');
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al modificar datos: ${response.statusText}`);
                    }

                    // const result = await response.json();
                    mostrarMensaje('Datos modificados exitosamente.', 'success');

                    modalAgregarPaciente.hide();
                    formAgregarPaciente.reset();
                    formAgregarPaciente.classList.remove('was-validated');
                    renderPacientesTable(
                        'tablaPacientes', // ID de la tabla principal
                        'contadorPacientes',
                        'paginationControls',
                        'selectDiagnosticosBuscar',
                        'inputBuscarNombre',
                        'inputBuscarCedula',
                        'selectActive',
                        ['btnVerFicha', 'btnModificarDatosPersonales', 'btnEliminarPaciente'],
                        'tableLoadingOverlay'
                    );

                } catch (error) {
                    console.error('Error al modificar paciente:', error);
                    mostrarMensaje(error.message || 'Error al modificar paciente.', 'danger');
                }
            } else {
                mostrarMensaje('Por favor, selecciona un paciente de la tabla para modificar sus datos.', 'info');
            }  
         
        };
    });
}      

function inicializarEliminarPaciente(){
const btnEliminarPaciente = document.getElementById('btnEliminarPaciente');

btnEliminarPaciente.addEventListener('click', async (event) =>{
    event.preventDefault();
    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea eliminar este paciente?', 'Eliminar Elemento', 'Sí, Eliminar', 'Cancelar', 'btn-danger');
    if(!confirmacion){
        mostrarMensaje('Eliminación de paciente cancelada', 'info');
        return;
    }else{
        const token = getAuthToken();
            if (!token) {
                mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                mostrarLogin();
                return;
            }
        const selectedPacienteRow = document.querySelector('#tablaPacientes tbody tr.table-selected');
        if(!selectedPacienteRow){
            mostrarMensaje('Seleccione un paciente a eliminar', 'info');
            return;
        }else{
            const pacienteId = selectedPacienteRow.dataset.pacienteId;
            try {
                    const response = await fetch(`${API_BASE_URL}/api/pacientes/eliminarPaciente?pacienteId=${pacienteId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            mostrarMensaje('Error de autorización al eliminar paciente. Token inválido o expirado. Cerrando sesión.', 'danger');
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al eliminar paciente: ${response.statusText}`);
                    }

                    // const result = await response.json();
                    mostrarMensaje('Paciente eliminado exitosamente.', 'success');

                    renderPacientesTable(
                        'tablaPacientes',
                        'contadorPacientes',
                        'paginationControls',
                        'selectDiagnosticosBuscar',
                        'inputBuscarNombre',
                        'inputBuscarCedula',
                        'selectActive',
                        ['btnVerFicha', 'btnModificarDatosPersonales', 'btnEliminarPaciente'],
                        'tableLoadingOverlay');

                } catch (error) {
                    console.error('Error al eliminar paciente:', error);
                    mostrarMensaje(error.message || 'Error al eliminar paciente.', 'danger');
                }         
        };
    }
    });
}




export { 
    inicializarPatientTable, 
    renderPacientesTable, 
    inicializarAgregarModificarPaciente,
    inicializarEliminarPaciente
};