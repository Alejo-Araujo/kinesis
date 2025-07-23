import { inicializarNavbar, adjustBodyPadding, navItemActive } from './navbar.js';
import { inicializarAgregarModificarPaciente, inicializarPatientTable, inicializarEliminarPaciente } from './pacientes.js';
import { inicializarFichaMedica } from './fichaMedica.js';
import { inicializarAgenda } from './agenda.js';
import { mostrarLogin, inicializarLogin, ocultarLogin, getAuthToken } from './login.js';
import { inicializarNombreDiagnostico, inicializarAgregarModificarNombreDiagnostico, inicializarAgregarDiagnosticoPaciente,
         inicializarEliminarDiagnosticoPaciente } from './diagnosticos.js';
import { populateAllDiagnosticosSelects, populateAllFisiosSelects } from './utils.js';
import { mostrar } from './ui.js';
import { inicializarCalendario } from './calendario.js';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

// function checkAuthStatus() {
//     const token = getAuthToken();
//     if (token) {
//         // En una aplicación real, aquí también podrías querer verificar la validez del token
//         // contra una ruta de verificación en el backend, o al menos decodificarlo
//         // para ver si expiró (usando jwt-decode, pero solo para UI, no seguridad).
//         // Por ahora, asumimos que si hay un token, el usuario está "conectado".
//         ocultarLogin(); // Si hay token, oculta el login y muestra el contenido principal
//         //console.log('Usuario ya conectado.');
//     } else {
//         mostrarLogin(); // Si no hay token, muestra el formulario de login
//         console.log('Usuario no conectado. Mostrar formulario de login.');
//     }
// }

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





    
    inicializarFichaMedica();
    
    inicializarAgenda();
    inicializarCalendario();
    
    inicializarAgregarModificarPaciente();
    inicializarEliminarPaciente();

    inicializarAgregarModificarNombreDiagnostico();
    inicializarAgregarDiagnosticoPaciente();
    inicializarEliminarDiagnosticoPaciente();
    
    inicializarNombreDiagnostico();

    populateAllDiagnosticosSelects();
    populateAllFisiosSelects();

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