import { inicializarNavbar, adjustBodyPadding, navItemActive } from './navbar.js';
import { inicializarAgregarModificarPaciente, inicializarPatientTable, inicializarEliminarPaciente } from './pacientes.js';
import { inicializarFichaMedica } from './fichaMedica.js';
import { inicializarAgenda } from './agenda.js';
import { mostrarLogin, inicializarLogin, ocultarLogin, getAuthToken, esAdministrador } from './login.js';
import { inicializarNombreDiagnostico, inicializarAgregarModificarNombreDiagnostico, inicializarAgregarDiagnosticoPaciente,
         inicializarEliminarDiagnosticoPaciente, inicializarEliminarNombreDiagnostico } from './diagnosticos.js';
import { populateAllDiagnosticosSelects, populateAllFisiosSelects, populateAllYearSelects} from './utils.js';
import { mostrar } from './ui.js';
import { inicializarCalendario } from './calendario.js';
import { inicializarCuota } from './cuota.js';
import { inicializarTarifas } from './tarifas.js';
import { initSelectorPaciente } from './selectorPaciente.js';

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function initializeAppAndHidePreloader() {
    const initialLoadingOverlay = document.getElementById('initial-loading-overlay');
    const token = getAuthToken();

    await new Promise(resolve => setTimeout(resolve, 1000)); 

    if (token) {
        ocultarLogin();
    } else {
        mostrarLogin(); 
    }

    if (initialLoadingOverlay) {
        initialLoadingOverlay.style.opacity = '0';

        initialLoadingOverlay.addEventListener('transitionend', function handler() {
            initialLoadingOverlay.removeEventListener('transitionend', handler);
            initialLoadingOverlay.classList.add('d-none'); 
            initialLoadingOverlay.remove();
        }, { once: true });
    }
}

function inicializarAplicacionPrincipal(){
    window.addEventListener('resize', adjustBodyPadding);

    inicializarNavbar(cambioDeVista);

    //PARA LA TABLA PRINCIPAL
    inicializarPatientTable(
        'tablaPacientes',
        'inputBuscarNombre',
        'inputBuscarCedula',
        'selectDiagnosticosBuscar',
        'selectActive',
        'contadorPacientes',
        'paginationControls',
        ['btnVerFicha', 'btnModificarDatosPersonales', 'btnEliminarPaciente'],
        'tableLoadingOverlay'
        
    );

    //PARA EL SELECTOR DE PACIENTE UNIFICADO (reemplaza a los 4 modales duplicados)
    inicializarPatientTable(
        'tablaPacientesSelector',
        'inputBuscarNombreSelector',
        'inputBuscarCedulaSelector',
        'selectDiagnosticosSelector',
        'selectActiveSelector',
        'contadorPacientesSelector',
        'paginationControlsSelector',
        ['btnConfirmarSeleccionPaciente'],
        'tableLoadingOverlaySelector'
    );
    initSelectorPaciente();



    inicializarFichaMedica();
    
    inicializarAgenda();
    inicializarCalendario();
    
    inicializarAgregarModificarPaciente();
    inicializarEliminarPaciente();

    inicializarAgregarModificarNombreDiagnostico();
    inicializarAgregarDiagnosticoPaciente();
    inicializarEliminarDiagnosticoPaciente();
    inicializarEliminarNombreDiagnostico();
    
    inicializarNombreDiagnostico();

    inicializarCuota();
    inicializarTarifas();

    populateAllDiagnosticosSelects();
    populateAllFisiosSelects();
    populateAllYearSelects();

    // El menú "Facturación" arranca oculto (hidden en el HTML) y sólo se muestra si el
    // usuario logueado es administrador (tabla `administrador`).
    aplicarPermisosFacturacion();

    initializeAppAndHidePreloader();
    mostrar('divAgenda');
    navItemActive('divAgenda');
    adjustBodyPadding();

};


window.addEventListener('DOMContentLoaded', async () => {
    const usuarioAutenticado = await inicializarLogin();
    if (usuarioAutenticado){
        inicializarAplicacionPrincipal();
    } else {
        console.log("Usuario no autenticado. La UI de login ya ha sido mostrada. Esperando login.");
    }
});


async function aplicarPermisosFacturacion() {
    const liFacturacion = document.getElementById('liFacturacion');
    if (!liFacturacion) return;
    const admin = await esAdministrador();
    liFacturacion.hidden = !admin;
}

function cambioDeVista(divId) {
    switch (divId) {
        case 'divFichaMedica':
            break;
        case 'divAgenda':
           // renderAgenda();
            break;
        case 'divPaciente':
            //renderPacientesTable();
            break;
    }
}

export { inicializarAplicacionPrincipal };