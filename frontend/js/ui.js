import { renderPacientesTable } from "./pacientes.js";
import { renderNombresDiagnosticosTable } from "./diagnosticos.js";
import { renderCuotaTable } from "./cuota.js";
import { esAdministrador } from "./login.js";
import { inicializarCuota } from "./cuota.js";
import { renderTarifasTable } from "./tarifas.js";
import { renderUsuariosTable } from "./usuarios.js";

async function mostrar(divId) {

    const verificacion = await verificarAutorizacion(divId);
    if(!verificacion){
        mostrarMensaje('No tienes permiso para acceder a esta sección.','danger');
        return false;
    }

    const divAMostrar = document.getElementById(divId);
    const contenedores = document.querySelectorAll('div.container');
    
    contenedores.forEach(div => {
        if (div.id !== 'messageContainer') {
            div.classList.add('d-none');
        }
    });

    if (divAMostrar) {
        divAMostrar.classList.remove('d-none');
    } else {
        console.warn(`Advertencia: El elemento con ID ${divId} no fue encontrado en el DOM.`);
    }

    if (divId === 'divCuotas'){
        const selectanio = document.getElementById('anioCuotasFiltro');
        const currentYear = new Date().getFullYear();

        const startYearRange = 2025;

        const startYear = Math.min(startYearRange, currentYear);
        const endYear = currentYear + 1;

        selectanio.innerHTML = '';
        for (let year = startYear; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year.toString();
            option.textContent = year;
            selectanio.appendChild(option);
        }
        
        selectanio.value = currentYear.toString();
        deseleccionarFilas(divAMostrar.id);
    }else if (divId === 'divTarifas'){
        renderTarifasTable();
    }else if (divId === 'divUsuarios'){
        renderUsuariosTable();
    }else{
        const divsConTablas = ['divPaciente', 'divNombreDiagnostico'];
        if (divsConTablas.includes(divId)) {
            deseleccionarFilas(divAMostrar.id);
        }
    }
}


async function verificarAutorizacion(divId){
    switch(divId){
        case 'divTarifas':
        case 'divUsuarios':
        case 'divCuotas':
            return await esAdministrador();

        default:
            return true;
    }
}

function deseleccionarFilas(divId){
    const divsConTablas = ['divPaciente', 'divNombreDiagnostico', 'divCuotas'];
    if(divsConTablas.includes(divId)){
        let tablaId = '';
        switch(divId){
            case 'divPaciente':
                tablaId = 'tablaPacientes';
                limpiarFiltros('filtrosPacienteContainer',() => renderPacientesTable(
                        'tablaPacientes', 
                        'contadorPacientes',
                        'paginationControls',
                        'selectDiagnosticosBuscar',
                        'inputBuscarNombre',
                        'inputBuscarCedula',
                        'selectActive',
                        ['btnVerFicha', 'btnModificarDatosPersonales', 'btnEliminarPaciente'],
                        'tableLoadingOverlay'));
            break;
            case 'divNombreDiagnostico':
                tablaId = 'tablaNombresDiagnosticos';
                limpiarFiltros('filtrosDiagnosticoContainer',() => renderNombresDiagnosticosTable());
            break;
            case 'divCuotas':
                tablaId = 'tablaCuotas';
                limpiarFiltros('filtrosCuotasContainer', () => {
                    renderCuotaTable();
                });
            break;
            }
    if (tablaId) { 
        try {
            let tablaBody = document.querySelector(`#${tablaId} tbody`);
                let selectedRows = tablaBody.querySelectorAll('.table-selected');
                selectedRows.forEach(row => {
                    row.classList.remove('table-selected');
                });
        } catch (error) {
            console.error(`Error al deseleccionar filas en #${tablaId}:`, error);
        }
    }
    
    }
}

function limpiarFiltros(containerId, renderTable) {
    const filtrosContainer = document.getElementById(containerId);
    const campos = filtrosContainer.querySelectorAll('input[type="text"], select');

    const mesActual = new Date().getMonth() + 1;

    campos.forEach(campo => {
        if (campo.type === 'text') {
            campo.value = '';
        } else if (campo.tagName === 'SELECT') {
            if (campo.id.startsWith('filtroMes')) {
                campo.value = mesActual;
            } else {
                campo.selectedIndex = 0;
            }
        }
    });

    renderTable();
}

function mostrarMensaje(mensaje, tipo = 'info', duracion = 5000) {
    const container = document.getElementById('messageContainer');
    const oldAlerts = container.querySelectorAll('.alert:not(.show)');
    oldAlerts.forEach(alert => alert.remove());

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show`;
    alertDiv.role = 'alert';

    let iconClass = '';
    switch (tipo) {
        case 'success':
            iconClass = 'bi bi-check-circle-fill';
            break;
        case 'danger':
            iconClass = 'bi bi-x-circle-fill';
            break;
        case 'warning':
            iconClass = 'bi bi-exclamation-triangle-fill';
            break;
        case 'info':
            iconClass = 'bi bi-info-circle-fill';
            break;
        default:
            iconClass = 'bi bi-info-circle-fill';
    }

    // Se construye el contenido con la API del DOM y textContent para evitar XSS:
    // el mensaje puede provenir de errores del servidor y no debe interpretarse como HTML.
    const icon = document.createElement('i');
    icon.className = `${iconClass} me-2`;

    const span = document.createElement('span');
    span.className = 'fs-5';
    span.textContent = mensaje;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('data-bs-dismiss', 'alert');
    closeBtn.setAttribute('aria-label', 'Close');

    alertDiv.append(icon, document.createTextNode(' '), span, closeBtn);

    container.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.classList.remove('show');
        alertDiv.addEventListener('transitionend', () => {
            alertDiv.remove(); 
        }, { once: true });
    }, duracion);
}

function mostrarConfirmacion(message, title = 'Confirmar Operación', confirmText = 'Confirmar', cancelText = 'Cancelar', confirmBtnType = 'btn-primary') {
    return new Promise(resolve => {
        const confirmModalElement = document.getElementById('confirmModal');
        if (!confirmModalElement) {
            console.error('Error: El elemento "confirmModal" no se encontró en el DOM. Asegúrate de que el HTML del modal esté presente.');
            resolve(false);
            return;
        }


        let confirmModal = new bootstrap.Modal(confirmModalElement);
        // let confirmModal = bootstrap.Modal.getInstance(confirmModalElement);
        // if (!confirmModal) {
        //     confirmModal = new bootstrap.Modal(confirmModalElement);
        // }
        confirmModalElement.style.zIndex = 2000;

        const modalTitle = confirmModalElement.querySelector('.modal-title');
        const modalBody = confirmModalElement.querySelector('.modal-body');
        const btnConfirm = confirmModalElement.querySelector('#btnConfirmAction');
        const btnCancel = confirmModalElement.querySelector('.btn-secondary[data-bs-dismiss="modal"]');

        if (!modalTitle || !modalBody || !btnConfirm || !btnCancel) {
            console.error('Error: Algunos elementos internos del modal de confirmación no se encontraron.');
            resolve(false);
            return;
        }
        
        modalTitle.textContent = title;
        modalBody.textContent = message;
        btnConfirm.textContent = confirmText;
        btnCancel.textContent = cancelText;

        btnConfirm.classList.remove('btn-primary', 'btn-danger', 'btn-success', 'btn-warning', 'btn-info', 'btn-secondary', 'btn-light', 'btn-dark');
        btnConfirm.classList.add(confirmBtnType); 

        btnCancel.classList.add('btn-secondary');
        
        function handleConfirmation(result) {
            confirmModal.hide(); 
            resolve(result); 
            confirmModalElement._isResolved = true; 
            

            btnConfirm.removeEventListener('click', confirmModalElement._handleConfirmClick);
            btnCancel.removeEventListener('click', confirmModalElement._handleCancelClick);
            confirmModalElement.removeEventListener('hidden.bs.modal', confirmModalElement._handleModalHidden);
        }

        const handleConfirmClick = () => handleConfirmation(true);
        const handleCancelClick = () => handleConfirmation(false);
        const handleModalHidden = () => {
            if (!confirmModalElement._isResolved) {
                handleConfirmation(false); 
            }
        };

        confirmModalElement._handleConfirmClick = handleConfirmClick;
        confirmModalElement._handleCancelClick = handleCancelClick;
        confirmModalElement._handleModalHidden = handleModalHidden;

        btnConfirm.addEventListener('click', confirmModalElement._handleConfirmClick);
        btnCancel.addEventListener('click', confirmModalElement._handleCancelClick);
        confirmModalElement.addEventListener('hidden.bs.modal', confirmModalElement._handleModalHidden);

        confirmModalElement._isResolved = false; 
        confirmModal.show();
    });
}

export { mostrar, mostrarMensaje, mostrarConfirmacion, deseleccionarFilas  };
