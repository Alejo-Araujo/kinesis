import { inicializarNavbar, adjustBodyPadding, navItemActive } from './navbar.js';
import { inicializarAgregarModificarPaciente, inicializarPatientTable, inicializarEliminarPaciente } from './pacientes.js';
import { inicializarFichaMedica } from './fichaMedica.js';
import { inicializarAgenda } from './agenda.js';
import { mostrarLogin, inicializarLogin, ocultarLogin, getAuthToken } from './login.js';
import { inicializarNombreDiagnostico, inicializarAgregarModificarNombreDiagnostico, inicializarAgregarDiagnosticoPaciente,
         inicializarEliminarDiagnosticoPaciente, inicializarEliminarNombreDiagnostico } from './diagnosticos.js';
import { populateAllDiagnosticosSelects, populateAllFisiosSelects, populateAllYearSelects} from './utils.js';
import { mostrar } from './ui.js';
import { inicializarCalendario } from './calendario.js';
import { inicializarCuota } from './cuota.js';

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

    //PARA LA TABLA DE AGREGAR PACIENTE A UN HORARIO
    inicializarPatientTable(
        'tablaPacientesSeleccion',
        'inputBuscarNombreSeleccion',
        'inputBuscarCedulaSeleccion',
        'selectDiagnosticosBuscarSeleccion',
        'selectActiveSeleccion',
        'contadorPacientesSeleccion',
        'paginationControlsSeleccion',
        ['btnSeleccionarPacienteModal'],
        'tableLoadingOverlaySeleccion'
    );

    //PARA LA TABLA DE AGREGAR PACIENTE A UNA SESION
    inicializarPatientTable(
        'tablaPacientesSeleccionSesion',
        'inputBuscarNombreSeleccionSesion',
        'inputBuscarCedulaSeleccionSesion',
        'selectDiagnosticosBuscarSeleccionSesion',
        'selectActiveSeleccionSesion',
        'contadorPacientesSeleccionSesion',
        'paginationControlsSeleccionSesion',
        ['btnSeleccionarPacienteModalSesion'],
        'tableLoadingOverlaySeleccionSesion'
    );

    //PARA LA TABLA DE AGREGAR PACIENTE A CUOTA
    inicializarPatientTable(
        'tablaPacientesSeleccionCuota',
        'inputBuscarNombreSeleccionCuota',
        'inputBuscarCedulaSeleccionCuota',
        'selectDiagnosticosBuscarSeleccionCuota',
        'selectActiveSeleccionCuota',
        'contadorPacientesSeleccionCuota',
        'paginationControlsSeleccionCuota',
        ['btnSeleccionarPacienteCuotaModal'],
        'tableLoadingOverlaySeleccionCuota'
    );
    
    //PARA LA TABLA DE AGREGAR PACIENTE A FIJARSE HORARIO
    inicializarPatientTable(
        'tablaPacientesSeleccionFijarseHorario',
        'inputBuscarNombreSeleccionFijarseHorario',
        'inputBuscarCedulaSeleccionFijarseHorario',
        'selectDiagnosticosBuscarSeleccionFijarseHorario',
        'selectActiveSeleccionFijarseHorario',
        'contadorPacientesSeleccionFijarseHorario',
        'paginationControlsSeleccionFijarseHorario',
        ['btnSeleccionarPacienteModalFijarseHorario'],
        'tableLoadingOverlaySeleccionFijarseHorario'
    );



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

    populateAllDiagnosticosSelects();
    populateAllFisiosSelects();
    populateAllYearSelects();

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