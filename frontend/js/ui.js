import { renderPacientesTable } from "./pacientes.js";
import { renderNombresDiagnosticosTable } from "./diagnosticos.js";
import { renderCuotaTable } from "./cuota.js";
import { getAuthToken } from "./login.js";
import { inicializarCuota } from "./cuota.js";

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

    //Esto es para que entre solamente cuando la unica forma en la que se 
    // deseleccionan las filas y limpian los filtros es al cambiar de pestaña
    const divsConTablas = ['divPaciente', 'divNombreDiagnostico', 'divCuotas'];
    if (divsConTablas.includes(divId)) {
        deseleccionarFilas(divAMostrar.id);
    }
}

async function verificarAutorizacion(divId){
    switch(divId){
        case 'divCuotas':
            const token = getAuthToken();
            try{
                const response = await fetch('/api/auth/isAdministrador', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok){
                    const data = await response.json();
                    console.error('Error del servidor:', data.message);
                    return false;
                }

                const data = await response.json();
                return data.resultado;

            } catch (error) {
                console.error('Error al verificar autorización:', error);
                mostrarMensaje('Error al verificar autorización.');
                return false;
            }


        default:
            return true;
    }
}

function deseleccionarFilas(divId){
    const divsConTablas = ['divPaciente', 'divNombreDiagnostico', 'divAgenda', 'divAgendaPersonal', 'divAgendaFijarseHorario', 'divCuotas', 'divCuotasPaciente'];
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
            case 'divAgenda':
                tablaId = 'tablaPacientesSeleccion';
                limpiarFiltros( 'filtrosPacienteSeleccionContainer', () => renderPacientesTable(
                    'tablaPacientesSeleccion',
                    'contadorPacientesSeleccion',
                    'paginationControlsSeleccion',
                    'selectDiagnosticosBuscarSeleccion',
                    'inputBuscarNombreSeleccion',
                    'inputBuscarCedulaSeleccion',
                    'selectActiveSeleccion',
                    ['btnSeleccionarPacienteModal'],
                    'tableLoadingOverlaySeleccion'));
            break;
            case 'divNombreDiagnostico':
                tablaId = 'tablaNombresDiagnosticos';
                limpiarFiltros('filtrosDiagnosticoContainer',() => renderNombresDiagnosticosTable());
            break;
            case 'divAgendaPersonal':
                tablaId = 'tablaPacientesSeleccionSesion';
                limpiarFiltros( 'filtrosPacienteSeleccionContainerSesion', () => renderPacientesTable(
                    'tablaPacientesSeleccionSesion',
                    'contadorPacientesSeleccionSesion',
                    'paginationControlsSeleccionSesion',
                    'selectDiagnosticosBuscarSeleccionSesion',
                    'inputBuscarNombreSeleccionSesion',
                    'inputBuscarCedulaSeleccionSesion',
                    'selectActiveSeleccionSesion',
                    ['btnSeleccionarPacienteModalSesion'],
                    'tableLoadingOverlaySeleccionSesion'));
            break;
            case 'divCuotasPaciente':
                tablaId = 'tablaPacientesSeleccionCuota';
                limpiarFiltros('filtrosPacienteCuotaContainer', () => renderPacientesTable(
                    'tablaPacientesSeleccionCuota',
                    'contadorPacientesSeleccionCuota',
                    'paginationControlsSeleccionCuota',
                    'selectDiagnosticosBuscarSeleccionCuota',
                    'inputBuscarNombreSeleccionCuota',
                    'inputBuscarCedulaSeleccionCuota',
                    'selectActiveSeleccionCuota',
                    ['btnSeleccionarPacienteCuotaModal'],
                    'tableLoadingOverlaySeleccionCuota'
                ));
            break;
            case 'divAgendaFijarseHorario':
                tablaId = 'tablaPacientesSeleccionFijarseHorario';
                limpiarFiltros('filtrosPacienteSeleccionContainerFijarseHorario', () => renderPacientesTable(
                    'tablaPacientesSeleccionFijarseHorario',
                    'contadorPacientesSeleccionFijarseHorario',
                    'paginationControlsSeleccionFijarseHorario',
                    'selectDiagnosticosBuscarSeleccionFijarseHorario',
                    'inputBuscarNombreSeleccionFijarseHorario',
                    'inputBuscarCedulaSeleccionFijarseHorario',
                    'selectActiveSeleccionFijarseHorario',
                    ['btnSeleccionarPacienteModalFijarseHorario'],
                    'tableLoadingOverlaySeleccionFijarseHorario'
                ));
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

    alertDiv.innerHTML = `
        <i class="${iconClass} me-2"></i> <span class="fs-5">${mensaje}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

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
        // Mensaje de error si el modal no se encuentra (buena práctica)
        if (!confirmModalElement) {
            console.error('Error: El elemento "confirmModal" no se encontró en el DOM. Asegúrate de que el HTML del modal esté presente.');
            resolve(false);
            return;
        }

        const confirmModal = new bootstrap.Modal(confirmModalElement);
        confirmModalElement.style.zIndex = 2000; // Asegura que esté por encima de otros elementos

        const modalTitle = confirmModalElement.querySelector('.modal-title');
        const modalBody = confirmModalElement.querySelector('.modal-body');
        const btnConfirm = confirmModalElement.querySelector('#btnConfirmAction');
        const btnCancel = confirmModalElement.querySelector('.btn-secondary[data-bs-dismiss="modal"]');

        // Mensaje de error si los elementos internos del modal no se encuentran
        if (!modalTitle || !modalBody || !btnConfirm || !btnCancel) {
            console.error('Error: Algunos elementos internos del modal de confirmación no se encontraron.');
            resolve(false);
            return;
        }
        
        modalTitle.textContent = title;
        modalBody.textContent = message;
        btnConfirm.textContent = confirmText;
        btnCancel.textContent = cancelText;

        // Limpiar clases de tipo de botón anteriores y añadir la nueva
        btnConfirm.classList.remove('btn-primary', 'btn-danger', 'btn-success', 'btn-warning', 'btn-info', 'btn-secondary', 'btn-light', 'btn-dark');
        btnConfirm.classList.add(confirmBtnType); // Añade el tipo de botón especificado

        // Asegurar que el botón de cancelar siempre sea btn-secondary (si no lo es ya)
        btnCancel.classList.add('btn-secondary');
        
        // --- INICIO DE LA SECCIÓN CRÍTICA DE MANEJADORES DE EVENTOS ---

        // Definimos handleConfirmation como una declaración de función para asegurar su disponibilidad
        function handleConfirmation(result) {
            confirmModal.hide(); // Oculta el modal
            resolve(result); // Resuelve la Promise con el resultado (true/false)
            confirmModalElement._isResolved = true; // Marca que la Promise ha sido resuelta

            // Eliminar los event listeners para evitar llamadas múltiples y fugas de memoria
            btnConfirm.removeEventListener('click', confirmModalElement._handleConfirmClick);
            btnCancel.removeEventListener('click', confirmModalElement._handleCancelClick);
            confirmModalElement.removeEventListener('hidden.bs.modal', confirmModalElement._handleModalHidden);
        }

        // Definimos los manejadores de eventos. Son funciones flecha para mantener el 'this' correcto
        // y cierran sobre 'handleConfirmation'.
        const handleConfirmClick = () => handleConfirmation(true);
        const handleCancelClick = () => handleConfirmation(false);
        const handleModalHidden = () => {
            // Si el modal se cierra de forma inesperada (ej. clic fuera o tecla Esc)
            if (!confirmModalElement._isResolved) {
                handleConfirmation(false); // Considerar como una cancelación
            }
        };

        // Almacenar las referencias de las funciones en el elemento del modal
        // Esto es CRÍTICO para que removeEventListener funcione correctamente,
        // ya que necesita la MISMA instancia de la función que se añadió.
        confirmModalElement._handleConfirmClick = handleConfirmClick;
        confirmModalElement._handleCancelClick = handleCancelClick;
        confirmModalElement._handleModalHidden = handleModalHidden;

        // Añadir los event listeners usando las referencias ALMACENADAS
        // (Esto asegura que removeEventListener pueda encontrarlos y quitarlos)
        btnConfirm.addEventListener('click', confirmModalElement._handleConfirmClick);
        btnCancel.addEventListener('click', confirmModalElement._handleCancelClick);
        confirmModalElement.addEventListener('hidden.bs.modal', confirmModalElement._handleModalHidden);

        // --- FIN DE LA SECCIÓN CRÍTICA ---

        confirmModalElement._isResolved = false; // Reinicia el estado de resolución del modal
        confirmModal.show(); // Muestra el modal
    });
}

export { mostrar, mostrarMensaje, mostrarConfirmacion, deseleccionarFilas  };
