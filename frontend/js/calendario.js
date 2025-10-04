import { API_BASE_URL } from './config.js';
import { getAuthToken, mostrarLogin } from './login.js';
import { mostrarMensaje, mostrarConfirmacion, deseleccionarFilas } from './ui.js';

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearHeader = document.getElementById('currentMonthYear');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

const modalElementSession = document.getElementById('sessionDetailModal')
const sessionDetailModal = new bootstrap.Modal(modalElementSession);
const formAgregarSesion = document.getElementById('sessionForm');

const modalElementSesionesDias = document.getElementById('sesionDiaModal');
const modalSesionesDiasInstance = new bootstrap.Modal(modalElementSesionesDias);



const modalElementEstadisticasSesion = document.getElementById('modalEstadisticasSesiones');
const modalInstanceEstadisticasSesion = new bootstrap.Modal(modalElementEstadisticasSesion);
const formEstadisticas = document.getElementById('formFiltroSesiones');




let currentDate = new Date();

const calendarLoadingOverlay = document.getElementById('calendar-loading-overlay');

async function fetchSesiones(mes,anio){
const url = `${API_BASE_URL}/api/calendario/getSesiones?mes=${mes}&anio=${anio}`;
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
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener las seisones'}`);
        }
        const data = await response.json(); 
        return data;
    } catch (error) {
        console.error('Error en fetchSesiones:', error);
        throw error;
    }
}

async function fetchSesion(fecha,horaInicio,horaFin) {
const url = `${API_BASE_URL}/api/calendario/getSesion?fecha=${fecha}&horaInicio=${horaInicio}&horaFin=${horaFin}`;
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
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener la sesion'}`);
        }
        const data = await response.json(); 
        return data;
    } catch (error) {
        console.error('Error en fetchSesion:', error);
        throw error;
    }   
}


async function renderCalendar(month, year) { 
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    currentMonthYearHeader.textContent = `${monthNames[month]} ${year}`;

    calendarLoadingOverlay.classList.add('show');

    const MIN_DISPLAY_TIME_MS = 300;
    const minDisplayTimePromise = new Promise(resolve => setTimeout(resolve, MIN_DISPLAY_TIME_MS));

    calendarGrid.innerHTML = '';
    

    let sesiones = [];
    try {
        const fetchSessionsOperation = fetchSesiones(month, year);

        const [fetchedSesionesResult] = await Promise.all([
            fetchSessionsOperation,
            minDisplayTimePromise
        ]);
        
        sesiones = fetchedSesionesResult;
    } catch (error) {
        console.error("No se pudieron cargar las sesiones:", error);
        mostrarMensaje('No se pudieron cargar las sesiones del calendario. Intente de nuevo más tarde.', 'danger');
    } finally {
        calendarLoadingOverlay.classList.remove('show');
    }

    const sesionesPorDia = {};
    sesiones.forEach(session => {
          
      // sesion.fecha viene en formato 'YYYY-MM-DD'
        const sessionDate = session.fecha.split('T')[0] || session.fecha.substring(0, 10);
        if (!sesionesPorDia[sessionDate]) {
            sesionesPorDia[sessionDate] = [];
        }
        sesionesPorDia[sessionDate].push(session);
    });

    // Calcular el primer día del mes y dónde comienza
    const firstDayOfMonth = new Date(year, month, 1);
    let startDay = firstDayOfMonth.getDay();
    startDay = (startDay === 0) ? 6 : startDay - 1; // Ajuste para que Lunes sea el primer día de la semana (0)

    // Calcular días en el mes actual
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Días del mes anterior para rellenar los huecos al principio
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDay; i > 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'other-month');
        dayDiv.innerHTML = `<div class="day-number">${prevMonthDays - i + 1}</div>`;
        calendarGrid.appendChild(dayDiv);
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'current-month');
        
        // Formatear la fecha para que coincida con la clave en sesionesPorDia (YYYY-MM-DD)
        const formattedDay = String(i).padStart(2, '0');
        const formattedMonth = String(month + 1).padStart(2, '0'); // month es 0-11, sumamos 1 para 01-12
        const clickedDate = `${year}-${formattedMonth}-${formattedDay}`;

        dayDiv.setAttribute('data-bs-toggle', 'modal');
        dayDiv.setAttribute('data-bs-target', '#sesionDiaModal');

        dayDiv.setAttribute('data-date', clickedDate);
        dayDiv.innerHTML = `<div class="day-number">${i}</div><div class="sessions-container"></div>`;

        const sessionsForThisDay = sesionesPorDia[clickedDate] || []; // Obtener sesiones para este día
        const sessionsCount = sessionsForThisDay.length;

        if (sessionsCount > 0) {
            dayDiv.classList.add('has-sessions');
            const sessionsContainer = dayDiv.querySelector('.sessions-container'); 
            sessionsContainer.innerHTML = `<small class="session-count-text">${sessionsCount} sesi${sessionsCount !== 1 ? 'ones' : 'ón'}</small>`;
        }

       //LISTENER PARA LOS dayDiv
        dayDiv.addEventListener('click', (event) => {
            showModalElementSesionesDias(sessionsForThisDay, clickedDate);
        });

        calendarGrid.appendChild(dayDiv);
    }

    // Días del mes siguiente para rellenar el final
    const totalCells = startDay + daysInMonth;
    const remainingCells = 42 - totalCells; 
    for (let i = 1; i <= remainingCells; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'other-month');
        dayDiv.innerHTML = `<div class="day-number">${i}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
}

function showModalElementSesionesDias(sesiones, fecha){
    const modalTablaSesionesBody = document.getElementById('modalTablaSesionesBody');
    const modalTablaSesiones = document.getElementById('modalTablaSesiones');
    const noSesionesMensaje = document.getElementById('noSesionesMensaje');
    const modalDiaSesion = document.getElementById('modalDiaSesion'); 
    const btnModificarSesion = document.getElementById('btnModificarSesion');
    const btnEliminarSesion = document.getElementById('btnEliminarSesion');

    modalTablaSesionesBody.innerHTML = '';

    const partesFecha = fecha.split('-'); 
    const fechaBien = `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`;
    modalDiaSesion.textContent = fechaBien;
    
    btnModificarSesion.disabled = true;
    btnEliminarSesion.disabled = true;

    if (sesiones.length === 0) {
        modalTablaSesiones.style.display = 'none';
        noSesionesMensaje.style.display = 'block'; 
    } else {
        modalTablaSesiones.style.display = 'table';
        noSesionesMensaje.style.display = 'none'; 

        // Rellenar la tabla con las sesiones
        sesiones.forEach(sesion => {
            const row = modalTablaSesionesBody.insertRow(); 

            row.dataset.fecha = sesion.fecha;
            row.dataset.horaInicio = sesion.horaInicio;
            row.dataset.horaFin = sesion.horaFin; 
            
            const horaInicioCell = row.insertCell();
            horaInicioCell.textContent = sesion.horaInicio.slice(0, 5);

            const horaFinCell = row.insertCell();
            horaFinCell.textContent = sesion.horaFin.slice(0, 5);

            const fisioterapeutaCell = row.insertCell();
            fisioterapeutaCell.textContent = sesion.nombreFisio;

            const pacienteCell = row.insertCell();
            pacienteCell.textContent = sesion.nombrePaciente;

            row.addEventListener('click', () => {
                const isSelected = row.classList.contains('table-selected');

                // Desmarcar todas las filas previamente seleccionadas
                modalTablaSesionesBody.querySelectorAll('tr').forEach(r => {
                    r.classList.remove('table-selected');
                });
                
                if(isSelected){
                    row.classList.remove('table-selected');
                    btnModificarSesion.disabled = true;
                    btnEliminarSesion.disabled = true;
                }else{
                    row.classList.add('table-selected');
                    btnModificarSesion.disabled = false;
                    btnEliminarSesion.disabled = false; 
                }                
            });
        });
    }
    
}

function showModalElementSesionesEstadisticas(sesiones){
    const modalTablaSesionesBody = document.getElementById('modalTablaSesionesEstadisticasBody');
    const modalTablaSesiones = document.getElementById('modalTablaSesionesEstadisticas');
    const noSesionesMensaje = document.getElementById('noSesionesMensajeEstadisticas');
    const contador = document.getElementById('contadorSesionesEstadisticas');
   
    modalTablaSesionesBody.innerHTML = '';

    if (sesiones.length === 0) {
        modalTablaSesiones.style.display = 'none';
        noSesionesMensaje.style.display = 'block'; 
        contador.textContent = 0;
        return;
    } else {
        modalTablaSesiones.style.display = 'table';
        noSesionesMensaje.style.display = 'none'; 
        contador.textContent = sesiones.length;

        sesiones.forEach(sesion => {
            const row = modalTablaSesionesBody.insertRow(); 

            row.dataset.fecha = sesion.fecha;
            row.dataset.horaInicio = sesion.horaInicio;
            row.dataset.horaFin = sesion.horaFin; 
            
            const fecha = sesion.fecha.split('T')[0] || sesion.fecha.substring(0, 10);;
            const partesFecha = fecha.split('-'); 
            const fechaBien = `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`;

            const fechaCell = row.insertCell();
            fechaCell.textContent = fechaBien;

            const horaInicioCell = row.insertCell();
            horaInicioCell.textContent = sesion.horaInicio.slice(0, 5);

            const horaFinCell = row.insertCell();
            horaFinCell.textContent = sesion.horaFin.slice(0, 5);

            const fisioterapeutaCell = row.insertCell();
            fisioterapeutaCell.textContent = sesion.nombreFisio;

            const pacienteCell = row.insertCell();
            pacienteCell.textContent = sesion.nombrePaciente;

        });
    }
    
}


function inicializarCalendarioListeners(){
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate.getMonth(), currentDate.getFullYear());
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate.getMonth(), currentDate.getFullYear());
    });

    modalElementSession.addEventListener('show.bs.modal', (event) => {
        formAgregarSesion.reset();
        formAgregarSesion.classList.remove('was-validated');
    });

    modalElementEstadisticasSesion.addEventListener('show.bs.modal', (event) => {
        document.getElementById('modalTablaSesionesEstadisticasBody').innerHTML = '';
        formEstadisticas.reset();
        formEstadisticas.classList.remove('was-validated');
       
    });



const modalDiaSesion = document.getElementById('modalDiaSesion'); 
const btnGuardarSesion = document.getElementById('saveSessionBtn');
const btnModificarSesion = document.getElementById('btnModificarSesion');
const btnEliminarSesion = document.getElementById('btnEliminarSesion');

const btnAgregarSesion = document.getElementById('btnAgregarSesion');
const inputFechaAgregarSesion = document.getElementById('sessionDate');
const btnSeleccionarPaciente = document.getElementById('btnSeleccionarPacienteModalSesion');
const inputHoraInicioSesion = document.getElementById('sessionStartTime');
const inputHoraFinSesion = document.getElementById('sessionEndTime');
const selectFisioSesion = document.getElementById('selectFisiosSesion');
const selectPacienteSesionId = document.getElementById('selectedPacienteId');
const selectPacienteSesionName = document.getElementById('selectedPacienteName');
const tituloAgregarSesionModal = document.getElementById('sessionDetailModalLabel');

const selectPacienteModalSesion = document.getElementById('selectPacienteModalSesion');
const selectPacienteModalSesionInstance = new bootstrap.Modal(selectPacienteModalSesion);

    selectPacienteModalSesion.addEventListener('show.bs.modal', () => {
        deseleccionarFilas('divAgendaPersonal');
    })
    
    btnAgregarSesion.addEventListener('click', (event) => {
        
        const partesFecha = modalDiaSesion.textContent.split('-'); 
        const fechaBien = `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`;

        inputFechaAgregarSesion.value = fechaBien;

        inputHoraInicioSesion.value = '';
        inputHoraFinSesion.value = '';
        selectFisioSesion.value = '';
        selectPacienteSesionName.value = '';
        selectPacienteSesionId.value = '';
        tituloAgregarSesionModal.textContent = 'Agregar Sesion';
        btnGuardarSesion.textContent = 'Guardar sesión';
        modalElementSession.setAttribute('data-mode', 'add'); 
    });

    btnModificarSesion.addEventListener('click', async (event) => {
        
        const selectedRow = document.querySelector('#modalTablaSesiones tbody tr.table-selected');
        const fechaSeleccionada = selectedRow.dataset.fecha;
        const horaInicioSeleccionada = selectedRow.dataset.horaInicio;
        const horaFinSeleccionada = selectedRow.dataset.horaFin;

        try {
            const sesionSeleccionada = await fetchSesion(fechaSeleccionada, horaInicioSeleccionada, horaFinSeleccionada);
            if (!selectedRow) {
                mostrarMensaje('No se encontró la sesión para modificar.', 'info');
                return;
            }

            const fechaNueva =  sesionSeleccionada[0].fecha.split('T')[0];
            inputFechaAgregarSesion.value = fechaNueva;
            inputFechaAgregarSesion.disabled = true;
            inputHoraInicioSesion.value = sesionSeleccionada[0].horaInicio;
            inputHoraFinSesion.value = sesionSeleccionada[0].horaFin;

            selectFisioSesion.value = sesionSeleccionada[0].idFisio;
            //selectFisioSesion.textContent = selectFisioSesion.nombreFisio;
            selectPacienteSesionName.value = sesionSeleccionada[0].nombrePaciente;
            selectPacienteSesionId.value = sesionSeleccionada[0].idPaciente;
            //selectPacienteSesion.textContent = sesionSeleccionada.nombrePaciente;
            
            tituloAgregarSesionModal.textContent = 'Modificar Sesión';
            btnGuardarSesion.textContent = 'Guardar sesión modificada';
            modalElementSession.setAttribute('data-mode', 'edit'); 

            //esto es para identificar la sesion original a editar
            modalElementSession.setAttribute('data-original-date', fechaSeleccionada);
            modalElementSession.setAttribute('data-original-start-time', horaInicioSeleccionada);
            modalElementSession.setAttribute('data-original-end-time', horaFinSeleccionada);
        } catch (error) {
            mostrarMensaje('Error al obtener los datos de la sesion a modificar.', 'info');
            // sessionDetailModal.hide();
            return;
        }

    });

    btnGuardarSesion.addEventListener('click', async (event) => {
        event.preventDefault(); 
        const currentMode = modalElementSession.dataset.mode;     
        if (!formAgregarSesion.checkValidity()) {
            formAgregarSesion.classList.add('was-validated'); 
            return;
        }
        
                if(currentMode === 'add'){
                    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea agregar esta sesión?');
                    if (!confirmacion) {
                        mostrarMensaje('Alta de sesión cancelada.', 'info');
                        return; 
                    }
                } else {
                    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea modificar los datos de esta sesión?');
                    if (!confirmacion) {
                        mostrarMensaje('Modificación de datos de la sesión cancelada.', 'info');
                        return; 
                    }
                }  
                    const sesionData = {
                        fecha: inputFechaAgregarSesion.value,
                        horaInicio: inputHoraInicioSesion.value,
                        horaFin: inputHoraFinSesion.value,
                        idFisio: selectFisioSesion.value,
                        idPaciente: selectPacienteSesionId.value
                    };

                    const inicioTime = new Date('2000-01-01T' + sesionData.horaInicio);
                    const finTime = new Date('2000-01-01T' + sesionData.horaFin);

                    if (inicioTime >= finTime) {
                        mostrarMensaje('La hora de inicio tiene que ser menor a la hora final', 'warning'); 
                        return;
                    } 
        
                    const token = getAuthToken();
        
                    if (!token) {
                        mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                        mostrarLogin();
                        return;
                    }
        
                    if(currentMode ==='add'){
                        try {
                            const response = await fetch(`${API_BASE_URL}/api/calendario/agregarSesion`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(sesionData)
                            });
        
                            if (!response.ok) {
                                if (response.status === 401 || response.status === 403) {
                                    mostrarMensaje('Error de autorización al agregar sesión. Token inválido o expirado. Cerrando sesión.', 'danger');
                                    mostrarLogin();
                                    return;
                                }
                                const errorData = await response.json();
                                throw new Error(errorData.message || `Error al agregar sesión: ${response.statusText}`);
                            }
        
                            // const result = await response.json();
                            const mostrarFechaPartes = sesionData.fecha.split('-'); 
                            const fechaMostrar = `${mostrarFechaPartes[2]}-${mostrarFechaPartes[1]}-${mostrarFechaPartes[0]}`;
                            
                            mostrarMensaje(`Sesión agregada exitosamente. El ${fechaMostrar}, desde las ${sesionData.horaInicio} hasta las ${sesionData.horaFin}`, 'success');
        
                            sessionDetailModal.hide();
                            formAgregarSesion.reset();
                            formAgregarSesion.classList.remove('was-validated');
                            const fechaDate = new Date(sesionData.fecha);
                            renderCalendar(fechaDate.getMonth(),fechaDate.getFullYear());
                            modalSesionesDiasInstance.hide();

        
                        } catch (error) {
                            console.error('Error al agregar sesión:', error);
                            mostrarMensaje(error.message || 'Error al agregar sesión.', 'danger');
                        }
                    } else {
                        const selectedSesionRow = document.querySelector('#modalTablaSesiones tbody tr.table-selected');
                        if (selectedSesionRow){
                        const fecha = selectedSesionRow.dataset.fecha;
                        const horaInicio = selectedSesionRow.dataset.horaInicio;
                        const horaFin = selectedSesionRow.dataset.horaFin;


                        try {
                            const response = await fetch(`${API_BASE_URL}/api/calendario/modificarSesion?fechaOriginal=${fecha}&horaInicioOriginal=${horaInicio}&horaFinOriginal=${horaFin}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(sesionData)
                            });
        
                            if (!response.ok) {
                                if (response.status === 401 || response.status === 403) {
                                    mostrarMensaje('Error de autorización al modificar sesión. Token inválido o expirado. Cerrando sesión.', 'danger');
                                    mostrarLogin();
                                    return;
                                }
                                const errorData = await response.json();
                                throw new Error(errorData.message || `Error al modificar datos: ${response.statusText}`);
                            }
        
                            mostrarMensaje('Sesión modificada exitosamente.', 'success');
        
                            sessionDetailModal.hide();
                            formAgregarSesion.reset();
                            formAgregarSesion.classList.remove('was-validated');
                            const fechaDate = new Date(sesionData.fecha);
                            renderCalendar(fechaDate.getMonth(),fechaDate.getFullYear());
                            modalSesionesDiasInstance.hide();
        
                        } catch (error) {
                            console.error('Error al modificar sesión:', error);
                            mostrarMensaje(error.message || 'Error al modificar sesión.', 'danger');
                        }
                    } else {
                        mostrarMensaje('Por favor, selecciona una sesión de la tabla para modificar sus datos.', 'info');
                    }  
                 
                };
    });

    btnSeleccionarPaciente.addEventListener('click', async (event) => {                
        const selectedPacienteRow = document.querySelector('#tablaPacientesSeleccionSesion tbody tr.table-selected');
        if(selectedPacienteRow){
            const pacienteId = selectedPacienteRow.dataset.pacienteId; 
            if(pacienteId){            
                const token = getAuthToken();
                    if (!token) {
                        mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.','danger');
                        mostrarLogin();
                        return;
                    }
                    try {
                    const response = await fetch(`${API_BASE_URL}/api/pacientes/${pacienteId}`, {
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
                    selectPacienteSesionId.value = data.id;
                    selectPacienteSesionName.value = data.nomyap;
                    selectPacienteModalSesionInstance.hide();

                    } catch (error) {
                        console.error('Error en fetchPacienteById:', error);
                        mostrarMensaje(error.message || 'Error al cargar los datos del paciente.', 'danger');
                        return null;
                    }     
            }
        }
    });
        
    btnEliminarSesion.addEventListener('click', async(event) => {
    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea eliminar esta sesión?', 'Eliminar Elemento', 'Sí, Eliminar', 'Cancelar', 'btn-danger');
    if(!confirmacion){
        mostrarMensaje('Sesión no eliminada', 'info');
        return;
    }else{
        const token = getAuthToken();
            if (!token) {
                mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                mostrarLogin();
                return;
            }
    const selectedSesionRow = document.querySelector('#modalTablaSesiones tbody tr.table-selected');
        if (selectedSesionRow){
            const fecha = selectedSesionRow.dataset.fecha;
            const horaInicio = selectedSesionRow.dataset.horaInicio;
            const horaFin = selectedSesionRow.dataset.horaFin;
                try {
                    const response = await fetch(`${API_BASE_URL}/api/calendario/eliminarSesion?fecha=${fecha}&horaInicio=${horaInicio}&horaFin=${horaFin}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                            }
                         });
        
                            if (!response.ok) {
                                if (response.status === 401 || response.status === 403) {
                                    mostrarMensaje('Error de autorización al eliminar sesión. Token inválido o expirado. Cerrando sesión.', 'danger');
                                    mostrarLogin();
                                    return;
                                }
                                const errorData = await response.json();
                                throw new Error(errorData.message || `Error al eliminar sesión: ${response.statusText}`);
                            }
        
                            mostrarMensaje('Sesión eliminada exitosamente.', 'success');
        
                            sessionDetailModal.hide();
                            formAgregarSesion.reset();
                            formAgregarSesion.classList.remove('was-validated');
                            const fechaDate = new Date(fecha);
                            renderCalendar(fechaDate.getMonth(),fechaDate.getFullYear());
                            modalSesionesDiasInstance.hide();
        
                        } catch (error) {
                            console.error('Error al eliminar sesión:', error);
                            mostrarMensaje(error.message || 'Error al eliminar sesión.', 'danger');
                        }
                    } else {
                        mostrarMensaje('Por favor, selecciona una sesión de la tabla para eliminarla.', 'info');
                    }              
                }  
    });

    const btnVerEstadisticas = document.getElementById('btnVerSesionesEstadisticas');
    btnVerEstadisticas.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!formEstadisticas.checkValidity()) {
            formEstadisticas.classList.add('was-validated'); 
            return;
        }


        const token = getAuthToken();
        if (!token) {
            mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
            mostrarLogin();
            return;
        }

        const mes = document.getElementById('selectMesEstadisticas').value;
        const anio = document.getElementById('selectAniosEstadisticas').value;
        const fisio = document.getElementById('selectFisiosEstadisticas').value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/calendario/sesionPorFisio?anio=${anio}&mes=${mes}&fisio=${fisio}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                    }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    mostrarMensaje('Error de autorización al obtener las estadisticas por sesión. Token inválido o expirado. Cerrando sesión.', 'danger');
                    mostrarLogin();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.message || `Error al obtener las estadisticas por sesión: ${response.statusText}`);
            }
            const data = await response.json();         
            formEstadisticas.reset();
            formEstadisticas.classList.remove('was-validated');
            showModalElementSesionesEstadisticas(data);

        } catch (error) {
            console.error('Error al obtener las estadisticas por sesión:', error);
            mostrarMensaje(error.message || 'Error al obtener las estadisticas por sesión:', 'danger');
        }
    });
}

function inicializarCalendario() {
    renderCalendar(currentDate.getMonth(), currentDate.getFullYear());
    inicializarCalendarioListeners();
}






export {
    inicializarCalendario
}
