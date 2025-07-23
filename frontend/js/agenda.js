import { API_BASE_URL } from './config.js';
import { getAuthToken, mostrarLogin } from './login.js';
import { mostrarMensaje, mostrarConfirmacion } from './ui.js';
import { deseleccionarFilas } from './ui.js';

const agendaDetailModalElement = document.getElementById('agendaDetailModal');
const agendaDetailModal = new bootstrap.Modal(agendaDetailModalElement);

const modalElement = document.getElementById('selectPacienteModal');
const modalAgregarPaciente = new bootstrap.Modal(modalElement);

const modalElementFisio = document.getElementById('modalAgregarFisios');
const modalAgregarFisio = new bootstrap.Modal(modalElementFisio);



async function fetchHorariosCompletos(){
    const url = `${API_BASE_URL}/api/agenda/horariosCompletos`;

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
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener los horarios completos'}`);
        }
        const data = await response.json(); 
        return data;
    } catch (error) {
        console.error('Error en fetchHorariosCompletos:', error);
        throw error;
    }
}

async function fetchHorarioByCompositeKey(diaSemana, horaInicio, horaFin) {
    const url = `${API_BASE_URL}/api/agenda/horario?diaSemana=${encodeURIComponent(diaSemana)}&horaInicio=${encodeURIComponent(horaInicio)}&horaFin=${encodeURIComponent(horaFin)}`;
    
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
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener el horario por clave compuesta'}`);
        }
        const data = await response.json(); 
        // Tu backend debería devolver un array con 1 elemento si lo encuentra, o un array vacío.
        // Asegúrate de que este fetch devuelva el objeto de horario directamente.
        return data; // Retorna el primer (y único) horario encontrado, o null
    } catch (error) {
        console.error(`Error en fetchHorarioByCompositeKey(${diaSemana}, ${horaInicio}, ${horaFin}):`, error);
        throw error;
    }
}

async function renderAgendaTable() {
    const tableBody = document.querySelector(`#tablaAgendaSemanal tbody`);
    if (!tableBody) return;

    tableBody.innerHTML = '';

    try {
        const horariosRaw = await fetchHorariosCompletos();
        if (horariosRaw.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 7;
            cell.textContent = 'No hay horarios disponibles. Agrega un horario para empezar.';
            cell.classList.add('text-center', 'text-muted');
            return;
        }

        

        const horariosPorDiaHora = {};
        horariosRaw.forEach(horario => { 
            if (!horariosPorDiaHora[horario.diaSemana]) {
                horariosPorDiaHora[horario.diaSemana] = {};
            }
            const horaKey = `${horario.horaInicio}-${horario.horaFin}`;
            horariosPorDiaHora[horario.diaSemana][horaKey] = horario;
        });

        const horasUnicas = Array.from(new Set(horariosRaw.map(h => `${h.horaInicio}-${h.horaFin}`))).sort();

        const diasSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

        horasUnicas.forEach(horaKey => {
            const row = tableBody.insertRow();
            const cellHora = row.insertCell(0);
            cellHora.textContent = horaKey;

            diasSemana.forEach(dia => {
                const cell = row.insertCell();
                const horarioEnCelda = horariosPorDiaHora[dia] && horariosPorDiaHora[dia][horaKey];

                if (horarioEnCelda) {
                   

                    cell.innerHTML = `
                        <div class="d-flex flex-column align-items-center">
                            <span class="badge bg-primary rounded-pill">${horarioEnCelda.pacientes.length || 0} Pacientes</span>
                        </div>
                    `;
                    cell.classList.add('table-cell-custom-color', 'clickable-schedule-cell'); 
                    cell.addEventListener('click', () => {
                        showAgendaDetailModal(horarioEnCelda);
                    });

                } else {
                    cell.textContent = ''; 
                    cell.classList.add('table-light');
                }
            });
        });

    } catch (error) {
        console.error('Error al renderizar la tabla de agenda:', error);
        const row = tableBody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 7;
        cell.textContent = 'Error al cargar la agenda. Por favor, intente de nuevo.';
        cell.classList.add('text-danger', 'text-center');
    }
}

function showAgendaDetailModal(horario) {
    agendaDetailModalElement.dataset.currentHorario = JSON.stringify(horario);

    document.getElementById('modalHorario').textContent = `${horario.horaInicio} - ${horario.horaFin}`;
    document.getElementById('modalDia').textContent = horario.diaSemana;
    document.getElementById('modalCantidad').textContent = horario.pacientes.length || 0;

    const modalIntegrantesList = document.getElementById('modalIntegrantesList');
    const modalFisioterapeutasList = document.getElementById('modalFisioterapeutasList');
    const noParticipantsMessage = document.getElementById('noParticipantsMessage');
    const noFisioterapeutasMessage = document.getElementById('noFisioterapeutasMessage');

    modalIntegrantesList.innerHTML = '';
    modalFisioterapeutasList.innerHTML = '';
    document.getElementById('btnEliminarPacienteHorario').disabled = true;
    document.getElementById('btnEliminarFisioterapeutaHorario').disabled = true;


    if (horario.pacientes && horario.pacientes.length > 0) {
        noParticipantsMessage.classList.add('d-none'); 
        horario.pacientes.forEach(paciente => {
            const li = document.createElement('li');
            li.classList.add('list-group-item', 'list-group-item-action');
            li.textContent = paciente.nombreCompleto;
            li.setAttribute('data-id', paciente.idPaciente);
            li.addEventListener('click', (event) => handleSelection(event.currentTarget, 'paciente'));
            modalIntegrantesList.appendChild(li);
        });
    } else {
        noParticipantsMessage.classList.remove('d-none'); 
    }
    if (horario.fisioterapeutas && horario.fisioterapeutas.length > 0) {
        noFisioterapeutasMessage.classList.add('d-none'); 
        horario.fisioterapeutas.forEach(fisio => {
            const li = document.createElement('li');
            li.classList.add('list-group-item', 'list-group-item-action');
            li.textContent = fisio.nombreFisio; // Asumiendo que el nombre del fisio se llama 'nombreFisio'
            li.setAttribute('data-id', fisio.idFisioterapeuta); // Almacena el ID del fisio
            li.addEventListener('click', (event) => handleSelection(event.currentTarget, 'fisio'));
            modalFisioterapeutasList.appendChild(li);
        });
    } else {
        noFisioterapeutasMessage.classList.remove('d-none'); 
    }

    agendaDetailModal.show();
}


function handleSelection(clickedLi, type) {
    const listContainer = clickedLi.parentElement; 
    const deleteButton = (type === 'paciente') ?
        document.getElementById('btnEliminarPacienteHorario') :
        document.getElementById('btnEliminarFisioterapeutaHorario');

    const wasAlreadySelected = clickedLi.classList.contains('active');

    Array.from(listContainer.children).forEach(li => {
        li.classList.remove('active');
    });

    if (!wasAlreadySelected) {
        clickedLi.classList.add('active'); 
        deleteButton.disabled = false;
    } else {
        deleteButton.disabled = true;
    }
}


function inicializarAgendaDetailModalListeners() {
    agendaDetailModalElement.addEventListener('hidden.bs.modal', () => {
        
        delete agendaDetailModalElement.dataset.currentHorario;

        document.getElementById('btnEliminarPacienteHorario').disabled = true;
        document.getElementById('btnEliminarFisioterapeutaHorario').disabled = true;

        document.getElementById('modalIntegrantesList').innerHTML = '';
        document.getElementById('modalFisioterapeutasList').innerHTML = '';
        document.getElementById('noParticipantsMessage').classList.add('d-none');
        document.getElementById('noFisioterapeutasMessage').classList.add('d-none');

    });

    document.getElementById('btnSeleccionarPacienteModal').addEventListener('click', async () => {
        

        const horarioDataString = agendaDetailModalElement.dataset.currentHorario;
        if (horarioDataString) {
            const currentHorario = JSON.parse(horarioDataString);
            const diaSemana = currentHorario.diaSemana;
            const horaInicio = currentHorario.horaInicio;
            const horaFin = currentHorario.horaFin;

            if(!diaSemana || !horaInicio || !horaFin){
                mostrarMensaje('No se pudieron obtener los datos del horario.', 'warning');
            } else {
            
                const selectedPacienteRow = document.querySelector('#tablaPacientesSeleccion tbody tr.table-selected');
            if(selectedPacienteRow){
                const pacienteId = selectedPacienteRow.dataset.pacienteId; 
                if(pacienteId){
                    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea agregar el paciente a este horario?');
                    if(!confirmacion){
                        mostrarMensaje('Paciente no agregado', 'info');
                    }
    
                    const grupoPacienteData = {
                        diaSemana: diaSemana,
                        horaInicio: horaInicio,
                        horaFin: horaFin,
                        idPaciente: pacienteId
                    }
                    const token = getAuthToken();

                    if (!token) {
                        mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.','danger');
                        mostrarLogin();
                        return;
                    }

                    try {
                    const response = await fetch(`${API_BASE_URL}/api/agenda/agregarPacienteGrupo`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(grupoPacienteData)
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            mostrarMensaje('Error de autorización al agregar paciente. Token inválido o expirado. Cerrando sesión.','danger');
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al agregar paciente: ${response.statusText}`);
                    }
                    mostrarMensaje('Paciente agregado exitosamente.', 'success');

                    modalAgregarPaciente.hide();
                    const horarioActualizado = await fetchHorarioByCompositeKey(diaSemana, horaInicio, horaFin);
                    if (horarioActualizado) {
                        modalAgregarPaciente.hide();
                        showAgendaDetailModal(horarioActualizado);
                        renderAgendaTable(); 
                    } else {
                        agendaDetailModal.hide(); 
                        renderAgendaTable();
                        mostrarMensaje('Paciente agregado, pero no se pudo actualizar el detalle del horario. Reabrir el modal para ver los cambios.', 'warning');
                    }
                    

                } catch (error) {
                    console.error('Error al agregar paciente:', error);
                    mostrarMensaje(error.message || 'Error al agregar paciente.', 'danger');
                }
                }else{
                    mostrarMensaje('No se pudo obtener el ID del paciente seleccionado.', 'warning');
                }
            }else{
                mostrarMensaje('Por favor, selecciona un paciente de la tabla para agregarlo al horario.', 'info');
            }
        }      
        } else {
            mostrarMensaje('Error: No hay un horario seleccionado en el modal.', 'danger');
        }
    });

    document.getElementById('btnEliminarPacienteHorario').addEventListener('click', async () => {
        const horarioDataString = agendaDetailModalElement.dataset.currentHorario;

        if (horarioDataString) {
            const currentHorario = JSON.parse(horarioDataString);
            const diaSemana = currentHorario.diaSemana;
            const horaInicio = currentHorario.horaInicio;
            const horaFin = currentHorario.horaFin;
        


            if(!diaSemana || !horaInicio || !horaFin){
                mostrarMensaje('No se pudieron obtener los datos del horario.', 'warning');
            } else {
            
                const selectedPacienteLi = document.querySelector('#modalIntegrantesList li.active');  
            if(selectedPacienteLi){
                const pacienteId = selectedPacienteLi.dataset.id;
                if(pacienteId){
                    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea eliminar el paciente de este horario?', 'Eliminar Elemento', 'Sí, Eliminar', 'Cancelar', 'btn-danger');
                    if(!confirmacion){
                        mostrarMensaje('Paciente no eliminado', 'info');
                    }
    
                    const grupoPacienteData = {
                        diaSemana: diaSemana,
                        horaInicio: horaInicio,
                        horaFin: horaFin,
                        idPaciente: pacienteId
                    }
                    const token = getAuthToken();

                    if (!token) {
                        mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.','danger');
                        mostrarLogin();
                        return;
                    }

                    try {
                    const response = await fetch(`${API_BASE_URL}/api/agenda/eliminarPacienteGrupo`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(grupoPacienteData)
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
                    mostrarMensaje('Paciente eliminado exitosamente.', 'success');

                    const horarioActualizado = await fetchHorarioByCompositeKey(diaSemana, horaInicio, horaFin);
                    
                    if (horarioActualizado) {
                        showAgendaDetailModal(horarioActualizado);
                        renderAgendaTable(); 
                    } else {
                        agendaDetailModal.hide(); 
                        renderAgendaTable();
                        mostrarMensaje('Paciente elimiado, pero no se pudo actualizar el detalle del horario. Reabrir el modal para ver los cambios.', 'warning');
                    }
                    

                } catch (error) {
                    console.error('Error al eliminar paciente:', error);
                    mostrarMensaje(error.message || 'Error al eliminar paciente.', 'danger');
                }
                }else{
                    mostrarMensaje('No se pudo obtener el ID del paciente seleccionado.', 'warning');
                }
            }else{
                mostrarMensaje('Por favor, selecciona un paciente de la tabla para eliminarlo del horario.', 'info');
            }
        }      
        } else {
            mostrarMensaje('Error: No hay un horario seleccionado en el modal.', 'danger');
        }
    });

    document.getElementById('btnAgregarFisios').addEventListener('click', async () => {
        const horarioDataString = agendaDetailModalElement.dataset.currentHorario;
        if (horarioDataString) {
            const currentHorario = JSON.parse(horarioDataString);
            const diaSemana = currentHorario.diaSemana;
            const horaInicio = currentHorario.horaInicio;
            const horaFin = currentHorario.horaFin;

            if(!diaSemana || !horaInicio || !horaFin){
                mostrarMensaje('No se pudieron obtener los datos del horario.', 'warning');
            } else {
            
                const fisioId = document.getElementById('selectFisios').value;
                if(fisioId){
                    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea agregar el Fisioterapeuta a este horario?');
                    if(!confirmacion){
                        mostrarMensaje('Fisioterapeuta no agregado', 'info');
                    }
    
                    const grupoFisioData = {
                        diaSemana: diaSemana,
                        horaInicio: horaInicio,
                        horaFin: horaFin,
                        idFisio: fisioId
                    }
                    const token = getAuthToken();

                    if (!token) {
                        mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                        mostrarLogin();
                        return;
                    }

                    try {
                    const response = await fetch(`${API_BASE_URL}/api/agenda/agregarFisioGrupo`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(grupoFisioData)
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            mostrarMensaje('Error de autorización al agregar fisioterapeuta. Token inválido o expirado. Cerrando sesión.', 'danger');
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al agregar fisioterapeuta: ${response.statusText}`);
                    }
                    mostrarMensaje('Fisioterapeuta agregado exitosamente.', 'success');

                    modalAgregarFisio.hide();
                    const horarioActualizado = await fetchHorarioByCompositeKey(diaSemana, horaInicio, horaFin);
                    if (horarioActualizado) {
                        modalAgregarFisio.hide();
                        showAgendaDetailModal(horarioActualizado);
                        renderAgendaTable(); 
                    } else {
                        agendaDetailModal.hide(); 
                        renderAgendaTable();
                        mostrarMensaje('Fisioterapeuta agregado, pero no se pudo actualizar el detalle del horario. Reabrir el modal para ver los cambios.', 'warning');
                    }
                    

                } catch (error) {
                    console.error('Error al agregar fisioterapeuta:', error);
                    mostrarMensaje(error.message || 'Error al agregar fisioterapeuta.', 'danger');
                }
                }else{
                    mostrarMensaje('No se pudo obtener el ID del fisioterapeuta seleccionado.', 'warning');
                }
        }      
        } else {
            mostrarMensaje('Error: No hay un horario seleccionado en el modal.', 'danger');
        }
    });

    document.getElementById('btnEliminarFisioterapeutaHorario').addEventListener('click', async () => {
        const horarioDataString = agendaDetailModalElement.dataset.currentHorario;

        if (horarioDataString) {
            const currentHorario = JSON.parse(horarioDataString);
            const diaSemana = currentHorario.diaSemana;
            const horaInicio = currentHorario.horaInicio;
            const horaFin = currentHorario.horaFin;
        


            if(!diaSemana || !horaInicio || !horaFin){
                mostrarMensaje('No se pudieron obtener los datos del horario.', 'warning');
            } else {
            
                const selectedFisioLi = document.querySelector('#modalFisioterapeutasList li.active');  
            if(selectedFisioLi){
                const fisioId = selectedFisioLi.dataset.id;
                if(fisioId){
                    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea eliminar el fisioterapeuta de este horario?', 'Eliminar Elemento', 'Sí, Eliminar', 'Cancelar', 'btn-danger');
                    if(!confirmacion){
                        mostrarMensaje('Fisioterapeuta no eliminado', 'info');
                    }
    
                    const grupoFisioData = {
                        diaSemana: diaSemana,
                        horaInicio: horaInicio,
                        horaFin: horaFin,
                        idFisio: fisioId
                    }
                    const token = getAuthToken();

                    if (!token) {
                        mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.','danger');
                        mostrarLogin();
                        return;
                    }

                    try {
                    const response = await fetch(`${API_BASE_URL}/api/agenda/eliminarFisioGrupo`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(grupoFisioData)
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            mostrarMensaje('Error de autorización al eliminar fisioterapeuta. Token inválido o expirado. Cerrando sesión.','danger');
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al eliminar fisioterapeuta: ${response.statusText}`);
                    }
                    mostrarMensaje('Fisioterapeuta eliminado exitosamente.', 'success');

                    const horarioActualizado = await fetchHorarioByCompositeKey(diaSemana, horaInicio, horaFin);
                    
                    if (horarioActualizado) {
                        showAgendaDetailModal(horarioActualizado);
                        renderAgendaTable(); 
                    } else {
                        agendaDetailModal.hide(); 
                        renderAgendaTable();
                        mostrarMensaje('Fisioterapeuta elimiado, pero no se pudo actualizar el detalle del horario. Reabrir el modal para ver los cambios.', 'warning');
                    }
                    

                } catch (error) {
                    console.error('Error al eliminar fisioterapeuta:', error);
                    mostrarMensaje(error.message || 'Error al eliminar fisioterapeuta.', 'danger');
                }
                }else{
                    mostrarMensaje('No se pudo obtener el ID del fisioterapeuta seleccionado.', 'warning');
                }
            }else{
                mostrarMensaje('Por favor, selecciona un fisioterapeuta de la tabla para eliminarlo del horario.', 'info');
            }
        }      
        } else {
            mostrarMensaje('Error: No hay un horario seleccionado en el modal.', 'danger');
        }
    });

    document.getElementById('btnEliminarHorario').addEventListener('click', async () => {
        const horarioDataString = agendaDetailModalElement.dataset.currentHorario;

        if (horarioDataString) {
            const currentHorario = JSON.parse(horarioDataString);
            const diaSemana = currentHorario.diaSemana;
            const horaInicio = currentHorario.horaInicio;
            const horaFin = currentHorario.horaFin;

            if(!diaSemana || !horaInicio || !horaFin){
                mostrarMensaje('No se pudieron obtener los datos del horario.', 'warning');
            } else {
            
                
                    const confirmacion = await mostrarConfirmacion('¿Está seguro que desea eliminar el grupo?', 'Eliminar Elemento', 'Sí, Eliminar', 'Cancelar', 'btn-danger');
                    if(!confirmacion){
                        mostrarMensaje('Grupo no eliminado', 'info');
                        return;
                    }
    
                    const grupoData = {
                        diaSemana: diaSemana,
                        horaInicio: horaInicio,
                        horaFin: horaFin
                    }
                    const token = getAuthToken();

                    if (!token) {
                        mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.','danger');
                        mostrarLogin();
                        return;
                    }

                    try {
                    const response = await fetch(`${API_BASE_URL}/api/agenda/eliminarGrupo`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(grupoData)
                    });

                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            mostrarMensaje('Error de autorización al eliminar el grupo. Token inválido o expirado. Cerrando sesión.','danger');
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al eliminar el grupo: ${response.statusText}`);
                    }
                    mostrarMensaje('Grupo eliminado exitosamente.', 'success');
                    agendaDetailModal.hide();


                    const horarioActualizado = await fetchHorarioByCompositeKey(diaSemana, horaInicio, horaFin);
                    
                    if (horarioActualizado) {
                        showAgendaDetailModal(horarioActualizado);
                        renderAgendaTable(); 
                    } else {
                        agendaDetailModal.hide(); 
                        renderAgendaTable();
                        mostrarMensaje('Grupo elimiado, pero no se pudo actualizar el detalle del horario. Reabrir el modal para ver los cambios.', 'warning');
                    }
                    

                } catch (error) {
                    console.error('Error al eliminar grupo:', error);
                    mostrarMensaje(error.message || 'Error al eliminar grupo.', 'danger');
                }
        }      
        } else {
            mostrarMensaje('Error: No hay un horario seleccionado en el modal.', 'danger');
        }
    });
    
}


function inicializarAddHorarioModal() {
    const addHorarioModalElement = document.getElementById('addHorarioModal');
    if (!addHorarioModalElement) {
        console.error('El modal de agregar horario no fue encontrado.');
        return;
    }
    
    let addHorarioModal = bootstrap.Modal.getInstance(addHorarioModalElement);
    if (!addHorarioModal) {
        addHorarioModal = new bootstrap.Modal(addHorarioModalElement);
    }

    const formAddHorario = document.getElementById('formAddHorario');
    const selectDiaHorario = document.getElementById('selectAddDiaHorario');
    const inputHoraInicio = document.getElementById('inputAddHoraInicio');
    const inputHoraFin = document.getElementById('inputAddHoraFin');
    const btnGuardarHorario = document.getElementById('btnAddHorario');

    addHorarioModalElement.addEventListener('show.bs.modal', function() {
        formAddHorario.reset();
        formAddHorario.classList.remove('was-validated');
    });

    if (btnGuardarHorario) {
        btnGuardarHorario.addEventListener('click', async function(event) {
            event.preventDefault(); 

            if (!formAddHorario.checkValidity()) {
                formAddHorario.classList.add('was-validated');
                return;
            }

            const diaSemana = selectDiaHorario.value;
            const horaInicio = inputHoraInicio.value;
            const horaFin = inputHoraFin.value;

            if (horaInicio >= horaFin) {
                mostrarMensaje('La hora de inicio debe ser anterior a la hora de fin.','danger');
                inputHoraFin.setCustomValidity('La hora de fin debe ser posterior a la hora de inicio.');
                formAddHorario.classList.add('was-validated');
                return;
            } else {
                inputHoraFin.setCustomValidity(''); 
            }

            const authenticateToken = getAuthToken();
            try {
                const response = await fetch('/api/agenda/horario', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authenticateToken}`
                    },
                    body: JSON.stringify({ diaSemana, horaInicio, horaFin })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al guardar el horario.');
                }

                mostrarMensaje('Horario guardado exitosamente!', 'success');
                addHorarioModal.hide(); 
                renderAgendaTable();

            } catch (error) {
                console.error('Error al guardar horario:', error);
                mostrarMensaje(error.message || 'Ocurrió un error al guardar el horario.', 'danger');
            }
        });
    }
}


function inicializarAgenda() {
    renderAgendaTable();
    inicializarAgendaDetailModalListeners();
    inicializarAddHorarioModal();
    modalElement.addEventListener('show.bs.modal', function () {
    deseleccionarFilas('divAgenda');
});
}


export { 
    inicializarAgenda
 };