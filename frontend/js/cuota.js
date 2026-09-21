import { API_BASE_URL } from './config.js';
import { getAuthToken, mostrarLogin } from './login.js';
import { mostrarMensaje, mostrarConfirmacion, deseleccionarFilas } from './ui.js';
import { debounce, showLoadingIndicator, hideLoadingIndicator  } from './utils.js';
import { abrirSelectorPaciente, cerrarSelectorPaciente } from './selectorPaciente.js';

const modalRegistrarCuota = document.getElementById('modalRegistrarCuota');
const modalRegistrarCuotaElement = new bootstrap.Modal(modalRegistrarCuota);
const formRegistrarCuota = document.getElementById('formNuevaCuota');

const modalRegistrarPago = document.getElementById('modalRegistrarPagoCuota');
const modalRegistrarPagoElement = new bootstrap.Modal(modalRegistrarPago);
const formRegistrarPago = document.getElementById('formRegistrarPagoCuota');

// (El modal de selección de paciente ahora es el componente unificado 'selectorPaciente.js')

const modalGenerarBalance = document.getElementById('modalGenerarBalance');

const modalConfirmarRestauracion = document.getElementById('modalConfirmarRestauracion');
const modalConfirmarRestauracionElement = new bootstrap.Modal(modalConfirmarRestauracion);


let currentPage = 1;
const limitPerPage = 200;

// Formateo de los KPIs del modal de balance.
function fmtMoneda(v){ return '$' + Number(v || 0).toLocaleString('es-UY'); }
function fmtNumero(v){ return Number(v || 0).toLocaleString('es-UY'); }
function setKpi(id, texto){ const el = document.getElementById(id); if (el) el.textContent = texto; }

async function fetchCuota(idPaciente,mes,anio) {
const url = `${API_BASE_URL}/api/cuotas/getCuota?idPaciente=${idPaciente}&mes=${mes}&anio=${anio}`;
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
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener la cuota'}`);
        }
        const data = await response.json(); 
        return data;
    } catch (error) {
        console.error('Error en fetchCuota:', error);
        throw error;
    }   
}

async function fetchCuotas(){
    const filterParams = getFilterParams();

    try {
        const response = await fetch(`${API_BASE_URL}/api/cuotas?${filterParams}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                mostrarLogin();
                return; 
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener las cuotas'}`);
        }
        const data = await response.json(); 
        return data;
    } catch (error) {
        console.error('Error en fetchCuotas:', error);
        throw error;
    }
}

async function traerMontoCuota(idPaciente){
    try {
        const response = await fetch(`${API_BASE_URL}/api/cuotas/getMonto?idPaciente=${idPaciente}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        if (!response.ok) {
            if (response.status === 401) {
                mostrarLogin();
                return; 
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener el monto correspondiente al paciente'}`);
        }
        const data = await response.json(); 
        return data;
    } catch (error) {
        console.error('Error en traerMontoCuota:', error);
        throw error;
    }
}

function getFilterParams(){   
    const filtroPacienteNombreCuota = document.getElementById('filtroPacienteNombreCuota');
    const filtroPacienteCedulaCuota = document.getElementById('filtroPacienteCedulaCuota');
    const filtroEstadoCuota = document.getElementById('filtroEstadoCuota');
    const filtroMesCuota = document.getElementById('filtroMesCuota');
    const filtroSelectAnioCuotas = document.getElementById('anioCuotasFiltro');

    const params = new URLSearchParams();

    if (filtroPacienteNombreCuota && filtroPacienteNombreCuota.value) {
        params.append('nombre', filtroPacienteNombreCuota.value);
    }

    if (filtroPacienteCedulaCuota && filtroPacienteCedulaCuota.value.trim()) {
        params.append('cedula', filtroPacienteCedulaCuota.value.trim());
    }

    if (filtroMesCuota && filtroMesCuota.value.trim()) {
        params.append('mes', filtroMesCuota.value.trim());
    }

    if (filtroSelectAnioCuotas && filtroSelectAnioCuotas.value.trim()) {
        params.append('anio', filtroSelectAnioCuotas.value.trim());
    }

    if (filtroEstadoCuota && filtroEstadoCuota.value.trim()) {
        params.append('estado', filtroEstadoCuota.value.trim());
    }

    params.append('page', currentPage);
    params.append('limit', limitPerPage);

    return params.toString();
}

async function renderCuotaTable(){
    const tablaCuotasBody = document.getElementById('tbodyCuotas');
    const btnRegistrarPagoCuota = document.getElementById('btnRegistrarPagoCuota');
    const btnDarDeBajaCuota = document.getElementById('btnDarDeBajaCuota');

    const contador = document.getElementById('contadorCuotas');
    const tableLoadingOverlay = 'tableLoadingOverlayCuotas';


    tablaCuotasBody.innerHTML = '';
    showLoadingIndicator(tableLoadingOverlay);
    
    btnRegistrarPagoCuota.disabled = true;
    btnDarDeBajaCuota.disabled = true;

    try{
        const data = await fetchCuotas();
        const cuotas = data.cuotas;
        const totalPages = data.totalPages;


    if (cuotas.length === 0) {
            const row = tablaCuotasBody.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 8; 
            cell.textContent = 'No hay cuotas registradas.';
            cell.classList.add('text-center', 'text-muted');
            contador.textContent = 0;
            return;
        }
        contador.textContent = cuotas.length;

        // Rellenar la tabla con las cuotas
        cuotas.forEach(cuota => {
            const row = tablaCuotasBody.insertRow(); 

            row.dataset.idPaciente = cuota.idPaciente;
            row.dataset.mes = cuota.mes;
            row.dataset.anio = cuota.anio;

            //CAMBIAR CLASES
            switch(cuota.estado){
                case'Pendiente':
                    row.classList.add('table-pendiente');
                break;
                case 'Pagada':
                    row.classList.add('table-pagada');
                break;
                case 'Atrasada':
                    row.classList.add('table-atrasada');
                break;
                case 'Cancelada':
                    row.classList.add('table-cancelada');
                break;
            
            }

            const nombrePacienteCell = row.insertCell();
            nombrePacienteCell.textContent = cuota.nombre;

            const cedulaPacienteCell = row.insertCell();
            cedulaPacienteCell.textContent = cuota.cedula || '---';

            const periodoCell = row.insertCell();
            periodoCell.textContent = `${cuota.mes}/${cuota.anio}`;

            const montoCell = row.insertCell();
            montoCell.textContent = cuota.monto || '0';

            const fechaPagoCell = row.insertCell();
            if(cuota.fechaPago){
                const fecha = new Date(cuota.fechaPago);
                const dia = String(fecha.getDate()).padStart(2, '0');
                const mes = String(fecha.getMonth() + 1).padStart(2, '0'); 
                const anio = fecha.getFullYear();
                fechaPagoCell.textContent = `${dia}-${mes}-${anio}`;
            }else{
                fechaPagoCell.textContent = '---';
            }


            // const fechaBajaCell = row.insertCell();
            // if(cuota.fechaBaja){
            //     const fecha = new Date(cuota.fechaBaja);
            //     const dia = String(fecha.getDate()).padStart(2, '0');
            //     const mes = String(fecha.getMonth() + 1).padStart(2, '0'); 
            //     const anio = fecha.getFullYear();
            //     fechaBajaCell.textContent = `${dia}-${mes}-${anio}`;
            // }else{
            //     fechaBajaCell.textContent = '---';
            // }

            const estadoCell = row.insertCell();
            estadoCell.textContent = cuota.estado;
        });

        renderPaginationControls(totalPages);

    }catch (error) {
        console.error('Error al renderizar la tabla de cuotas:', error);
        tablaCuotasBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error al cargar las cuotas: ${error.message}</td></tr>`;
    }finally {
        hideLoadingIndicator(tableLoadingOverlay);
    }
}

function renderPaginationControls(totalPages){
    const paginationControls = document.getElementById('paginationControlsCuotas');
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
                renderCuotaTable();
            });
            pageLi.appendChild(pageLink);
            paginationControls.appendChild(pageLi);
        }
}


function setActionButtonsState(enable, buttons = []) {
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = !enable;
            }
        });
}


function inicializarTablaCuotas(){
    const botones = ['btnRegistrarPagoCuota','btnModificarCuota','btnDarDeBajaCuota'];
    setActionButtonsState(false,botones);

    // Controla la seleccion de filas y deshabilitacion/habilitacion de botones
    const tablaCuotasBody = document.getElementById('tbodyCuotas');
    if (tablaCuotasBody) {
        let selectedCuotaId = null;
        tablaCuotasBody.addEventListener('click', (event) => {
            let clickedRow = event.target.closest('tr');
            if (clickedRow) {
                const currentSelected = tablaCuotasBody.querySelector('.table-selected');
                if (currentSelected && currentSelected !== clickedRow) {
                    currentSelected.classList.remove('table-selected');
                }
                clickedRow.classList.toggle('table-selected');            

                if (clickedRow.classList.contains('table-selected')) {
                    selectedCuotaId = clickedRow.dataset.id;
                    const estadoCuota = clickedRow.querySelector('td:last-child').textContent;
                    if (estadoCuota === 'Pendiente' || estadoCuota === 'Atrasada' || estadoCuota === 'Pagada') {
                        document.getElementById('btnRegistrarPagoCuota').disabled = false;
                        document.getElementById('btnDarDeBajaCuota').disabled = false;
                    } else if (estadoCuota === 'Cancelada') {
                       //Los botones se quedan deshabilitados
                    } else {
                        setActionButtonsState(false, botones);
                    }
                } else {
                    selectedCuotaId = null;
                    setActionButtonsState(false, botones);
                }
            }
        });
    }

    const inputBuscarNombre = document.getElementById('filtroPacienteNombreCuota');
    const inputBuscarCedula = document.getElementById('filtroPacienteCedulaCuota');
    const selectEstado = document.getElementById('filtroEstadoCuota');
    const selectMes = document.getElementById('filtroMesCuota');
    const selectAnio = document.getElementById('anioCuotasFiltro');

    //Event listeners para los filtrosssss
    const applyFilters = debounce(() => {
        currentPage = 1;
        renderCuotaTable();
    }, 200);

    if (inputBuscarNombre) {
        inputBuscarNombre.addEventListener('input', applyFilters);
    }
    if (inputBuscarCedula) {
        inputBuscarCedula.addEventListener('input', applyFilters);
    }
    if (selectMes) {
        selectMes.addEventListener('change', applyFilters);
    }
    if(selectAnio){
        selectAnio.addEventListener('change', applyFilters);
    }

    if (selectEstado) {
        //Por ahora el estado cancelada no se muestra en los filtros  <option value="Cancelada">Cancelada</option>
        selectEstado.innerHTML = `
            <option value="Pendiente">Pendiente</option>
            <option value="Pagada">Pagada</option>
            <option value="Atrasada">Atrasada</option>
        `; 
        selectEstado.value = 'Pendiente';
        selectEstado.addEventListener('change', applyFilters);
    }

    // No se renderiza en el arranque: la tabla se carga al navegar a la vista
    // (mostrar -> deseleccionarFilas -> limpiarFiltros -> renderCuotaTable), que ya
    // está protegida por permiso de admin. Así los usuarios no-admin no disparan un 403.
}


function inicializarCuotaDetailModalListeners(){
    const btnRegistrarPagoCuota = document.getElementById('btnRegistrarPagoCuota');
    const btnSeleccionarPaciente = document.getElementById('selectPacienteBtnCuota');
    const btnGenerarBalance = document.getElementById('btnGenerarBalance');
    const btnConfirmarRestauracion = document.getElementById('btnConfirmarRestauracion');
    const btnCancelarRestauracion = document.getElementById('btnCancelarRestauracion');

    const selectPacienteId = document.getElementById('selectedPacienteIdCuota');
    const selectPacienteName = document.getElementById('selectedPacienteNameCuota');
    const selectMes = document.getElementById('selectMesNuevaCuota');
    const selectAnio = document.getElementById('selectAnioCuotasRegistro');
    const inputMonto = document.getElementById('inputMontoNuevaCuota');

    const btnConfirmarPago = document.getElementById('btnConfirmarPago');
    const labelModalPagoCuota = document.getElementById('modalRegistrarPagoCuotaLabel');
  
    const btnGuardarCuota = document.getElementById('btnGuardarCuota');
    const btnDarDeBajaCuota = document.getElementById('btnDarDeBajaCuota');

    const tbodyGruposRestauracion = document.getElementById('tbodyGruposRestauracion');
    
    modalRegistrarCuota.addEventListener('show.bs.modal', () => {
        selectPacienteId.value = '';
        selectPacienteName.value = '';
        const date = new Date();
        selectMes.value = date.getMonth() + 1;
        selectAnio.value = date.getFullYear();
        inputMonto.value = '0';
    });

    modalGenerarBalance.addEventListener('show.bs.modal', () => {

        document.getElementById('selectMesDesdeBalance').value='1';
        document.getElementById('selectAnioDesdeBalance').value='2025';
        document.getElementById('selectMesHastaBalance').value='1';
        document.getElementById('selectAnioHastaBalance').value='2025';

        ['ingresos1xSemana','ingresos2xSemana','ingresos3xSemana','ingresos4xSemana',
         'ingresos5xSemana','ingresosOtros','ingresosTotales'].forEach(id => setKpi(id, fmtMoneda(0)));

        ['cant1xSemana','cant2xSemana','cant3xSemana','cant4xSemana',
         'cant5xSemana','cantOtros','cantTotal'].forEach(id => setKpi(id, fmtNumero(0)));

    });

    btnRegistrarPagoCuota.addEventListener('click', async (event) => {
        event.preventDefault();

        document.getElementById('inputDescripcionPagoCuota').value = '';
        document.getElementById('selectMetodoPagoCuota').value = '';
        
        
        const selectedRow = document.querySelector('#tablaCuotas tbody tr.table-selected');
        try{
            if (!selectedRow) {
                mostrarMensaje('Por favor, selecciona una cuota de la tabla para registrar o modificar el pago.', 'info');
                return;
            }
            const idPaciente = selectedRow.dataset.idPaciente;
            const mes = selectedRow.dataset.mes;
            const anio = selectedRow.dataset.anio;
            const cuotaSeleccionada = await fetchCuota(idPaciente, mes, anio);


            const pagoCuotaPacienteNombre = document.getElementById('pagoCuotaPacienteNombre');
            const pagoCuotaPacienteId = document.getElementById('pagoCuotaPacienteId');
            const pagoCuotaPeriodo = document.getElementById('pagoCuotaPeriodo');
            const pagoCuotaMonto = document.getElementById('pagoCuotaMonto');
            const pagoCuotaDescripcion = document.getElementById('inputDescripcionPagoCuota');
            const pagoCuotaFechaPago = document.getElementById('inputFechaPagoCuota');
            const pagoCuotaMetodo = document.getElementById('selectMetodoPagoCuota');
            const pagoDescuentoCuota = document.getElementById('pagoDescuentoCuota');
            const pagoDescuentoMontoCuota = document.getElementById('pagoDescuentoMontoCuota');

            pagoDescuentoCuota.value = cuotaSeleccionada[0].descuento;
            pagoDescuentoMontoCuota.value = cuotaSeleccionada[0].montoDescuento || cuotaSeleccionada[0].monto;
            pagoCuotaPacienteNombre.value = cuotaSeleccionada[0].nombre;
            pagoCuotaPacienteId.value = cuotaSeleccionada[0].idPaciente;
            pagoCuotaPeriodo.value = `${cuotaSeleccionada[0].mes}/${cuotaSeleccionada[0].anio}`;
            pagoCuotaMonto.value = cuotaSeleccionada[0].monto;
            pagoCuotaDescripcion.value = cuotaSeleccionada[0].descripcion || '';

            if(cuotaSeleccionada[0].fechaPago){
                pagoCuotaFechaPago.value = cuotaSeleccionada[0].fechaPago.split('T')[0];
            }else{
                pagoCuotaFechaPago.value = '';
            }

            if(cuotaSeleccionada[0].descuento != 0){
                pagoDescuentoMontoCuota.parentElement.classList.remove('d-none');
            }

            pagoCuotaMetodo.value = cuotaSeleccionada[0].metodoPago || '';

            labelModalPagoCuota.textContent = 'Registrar Pago';
            btnConfirmarPago.textContent = 'Guardar Pago';
            modalRegistrarPago.setAttribute('data-idPaciente', idPaciente);
            modalRegistrarPago.setAttribute('data-mes', mes);
            modalRegistrarPago.setAttribute('data-anio', anio);

        } catch (error) {
            console.error('Error al obtener el ID de la cuota seleccionada:', error);
        }
        
        
    });

    btnConfirmarPago.addEventListener('click', async (event) => {
        
        event.preventDefault(); 
        if (!formRegistrarPago.checkValidity()) {
            formRegistrarPago.classList.add('was-validated'); 
            return;
        }
        
        const token = getAuthToken();
        if (!token) {
            mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
            mostrarLogin();
            return;
        }

        const selectedRow = document.querySelector('#tablaCuotas tbody tr.table-selected');
        if(!selectedRow){
            mostrarMensaje('Seleccione una cuota para registrar/modificar el pago.', 'danger');
            return;
        }

        const confirmacion = await mostrarConfirmacion('¿Está seguro que desea registrar/modificar el pago de la cuota?');
        if(!confirmacion){
            mostrarMensaje('Pago/Modificación cancelado/a.', 'info');
            return;
        }

        const idPaciente = selectedRow.dataset.idPaciente;
        const mes = selectedRow.dataset.mes;
        const anio = selectedRow.dataset.anio;

        const pagoCuotaMonto = document.getElementById('pagoCuotaMonto').value;
        const inputDescripcionPagoCuota = document.getElementById('inputDescripcionPagoCuota').value;
        const selectMetodoPagoCuota = document.getElementById('selectMetodoPagoCuota').value;
        const fechaPago = document.getElementById('inputFechaPagoCuota').value;
        const descuento = document.getElementById('pagoDescuentoCuota').value;
        const montoConDescuento = document.getElementById('pagoDescuentoMontoCuota').value;

        if(descuento % 1 !== 0 || descuento < 0 || descuento > 100){
           mostrarMensaje('El descuento debe ser un número entero entre 0 y 100.', 'warning');
           inputDescuento.value = '0';
           document.getElementById('pagoDescuentoMontoCuota').parentElement.classList.add('d-none');
           return;
       }

        const data = {
            idPaciente: idPaciente,
            mes: mes,
            anio: anio,
            monto: pagoCuotaMonto,
            descripcion: inputDescripcionPagoCuota,
            metodoPago: selectMetodoPagoCuota,
            fechaPago: fechaPago,
            descuento: descuento,
            montoDescuento: montoConDescuento
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/cuotas/registrarPago`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if(!response.ok) {
                if (response.status === 401) {
                    mostrarMensaje('Error de autorización al pagar/modificar cuota. Token inválido o expirado. Cerrando sesión.', 'danger');
                    mostrarLogin();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.message || `Error al pagar/modificar cuota: ${response.statusText}`);
            }

            const responseData = await response.json();

            console.log('Response Data:', responseData.gruposRestaurables);

            if(responseData.gruposRestaurables && responseData.gruposRestaurables.length > 0){
                tbodyGruposRestauracion.innerHTML = '';
                responseData.gruposRestaurables.forEach(grupo => {
                    const row = tbodyGruposRestauracion.insertRow();
                    row.insertCell().textContent = grupo.diaSemana;
                    row.insertCell().textContent = grupo.horaInicio;
                    row.insertCell().textContent = grupo.horaFin;
                });

                modalConfirmarRestauracion.dataset.idPaciente = idPaciente;
                modalRegistrarPagoElement.hide();
                modalConfirmarRestauracionElement.show();

                formRegistrarPago.reset();
                formRegistrarPago.classList.remove('was-validated');


            } else {
                mostrarMensaje('Pago/Modificación registrada exitosamente.', 'success');
                modalRegistrarPagoElement.hide();
                formRegistrarPago.reset();
                formRegistrarPago.classList.remove('was-validated');
                renderCuotaTable();
            }

            } catch (error) {
                mostrarMensaje('Error al pagar/modificar cuota.', 'danger');
            }
    });           
    
    btnConfirmarRestauracion.addEventListener('click', async () => {
        const idPaciente = modalConfirmarRestauracion.dataset.idPaciente;
        if (!idPaciente) return;

        showLoadingIndicator('loadingOverlayRestauracion');
        const token = getAuthToken();

        try {
            const response = await fetch(`${API_BASE_URL}/api/cuotas/restaurarGrupos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ idPaciente: idPaciente })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al restaurar grupos');
            }

            const data = await response.json();

            modalConfirmarRestauracionElement.hide();
            if(data.restaurados) {
                mostrarMensaje('Pago registrado y horarios restaurados exitosamente.', 'success');
            } else {
                mostrarMensaje('Pago registrado. No se encontraron grupos para restaurar.', 'info');
            }
            
            renderCuotaTable();

        } catch (error) {
            console.error(error);
            mostrarMensaje('Pago registrado, pero hubo un error al restaurar los grupos.', 'warning');
            modalConfirmarRestauracionElement.hide();
            renderCuotaTable();
        } finally {
            hideLoadingIndicator('loadingOverlayRestauracion');
        }
    });

    btnCancelarRestauracion.addEventListener('click', () => {
        modalConfirmarRestauracionElement.hide();
        mostrarMensaje('Pago registrado exitosamente. No se restauraron grupos.', 'success');
        renderCuotaTable();
    });

    btnSeleccionarPaciente.addEventListener('click', () => {
        abrirSelectorPaciente({
            titulo: 'Seleccionar Paciente',
            textoBoton: 'Seleccionar',
            onSelect: async (paciente) => {
                const pacienteId = paciente.id;
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
                        if (response.status === 401) {
                            mostrarLogin();
                            return;
                        }
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Error al obtener paciente: ${response.statusText}`);
                    }
                    const data = await response.json();
                    selectPacienteId.value = data.id;
                    selectPacienteName.value = data.nomyap;
                    cerrarSelectorPaciente();

                    const montoTraido = await traerMontoCuota(data.id);
                    inputMontoNuevaCuota.value = montoTraido.monto;
                } catch (error) {
                    console.error('Error en fetchPacienteById:', error);
                    mostrarMensaje(error.message || 'Error al cargar los datos del paciente.', 'danger');
                    return null;
                }
            }
        });
    });

    btnGuardarCuota.addEventListener('click', async (event) =>{
        event.preventDefault(); 
                if (!formRegistrarCuota.checkValidity()) {
                    formRegistrarCuota.classList.add('was-validated'); 
                    return;
                }
                const confirmacion = await mostrarConfirmacion('¿Está seguro que desea agregar esta cuota?');
                if (!confirmacion) {
                    mostrarMensaje('Registro de cuota cancelada.', 'info');
                    return; 
                }

                const token = getAuthToken();
                if (!token) {
                    mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
                    mostrarLogin();
                    return;
                }

                const cuotaData = {
                    idPaciente: selectPacienteId.value,
                    mes: selectMes.value,
                    anio: selectAnio.value,
                    monto: inputMonto.value,
                    montoDescuento: inputMonto.value
                };     
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/cuotas/agregarCuota`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(cuotaData)
                        });
                
                        if (!response.ok) {
                            if (response.status === 401) {
                                mostrarMensaje('Error de autorización al agregar cuota. Token inválido o expirado. Cerrando sesión.', 'danger');
                                mostrarLogin();
                                return;
                            }
                            const errorData = await response.json();
                            throw new Error(errorData.message || `Error al agregar cuota: ${response.statusText}`);
                        }

                        
                        mostrarMensaje(`Cuota agregada exitosamente.`, 'success');
                        

                        modalRegistrarCuotaElement.hide();
                        formRegistrarCuota.reset();
                        formRegistrarCuota.classList.remove('was-validated');
                        renderCuotaTable();

                    } catch (error) {
                        console.error('Error al agregar cuota:', error);
                        mostrarMensaje(error.message || 'Error al agregar cuota.', 'danger');
                    }                         
    });

    btnDarDeBajaCuota.addEventListener('click', async (event) => {
        event.preventDefault();

        const selectedRow = document.querySelector('#tablaCuotas tbody tr.table-selected');
        if (!selectedRow) {
            mostrarMensaje('Por favor, seleccione una cuota para dar de baja.', 'warning');
            return;
        }

        const confirmacion = await mostrarConfirmacion('¿Está seguro que desea dar de baja esta cuota?');
        if (!confirmacion) {
            mostrarMensaje('Baja de la cuota cancelada.', 'info');
            return;
        }

        const data = {
            idPaciente: selectedRow.dataset.idPaciente,
            mes: selectedRow.dataset.mes,
            anio: selectedRow.dataset.anio
        };

        const token = getAuthToken();
        if (!token) {
            mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
            mostrarLogin();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/cuotas/bajaCuota`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    mostrarMensaje('Error de autorización al dar de baja la cuota. Token inválido o expirado. Cerrando sesión.', 'danger');
                    mostrarLogin();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.message || `Error al dar de baja la cuota: ${response.statusText}`);
            }

            mostrarMensaje(`Cuota dada de baja exitosamente.`, 'success');
            renderCuotaTable();

        } catch (error) {
            console.error('Error al dar de baja la cuota:', error);
            mostrarMensaje(error.message || 'Error al dar de baja la cuota.', 'danger');
        }
    });

    btnGenerarBalance.addEventListener('click', async (event) => {
        event.preventDefault();

        const token = getAuthToken();
        if (!token) {
            mostrarMensaje('No hay token de autenticación disponible. Redirigiendo al login.', 'danger');
            mostrarLogin();
            return;
        }

        const formBalance = document.getElementById('formGenerarBalance');
        if (!formBalance.checkValidity()) {
            formBalance.classList.add('was-validated'); 
            return;
        }

        const mesDesde = document.getElementById('selectMesDesdeBalance');
        const anioDesde = document.getElementById('selectAnioDesdeBalance');
        const mesHasta = document.getElementById('selectMesHastaBalance');
        const anioHasta = document.getElementById('selectAnioHastaBalance');

        const fechaDesde = new Date(anioDesde.value, mesDesde.value - 1);
        const fechaHasta = new Date(anioHasta.value, mesHasta.value - 1);

        if (fechaDesde > fechaHasta) {
            mostrarMensaje('El rango de fechas es inválido. Asegúrese que la fecha "Desde" no sea posterior a la fecha "Hasta".', 'danger');
            return;
        }

        showLoadingIndicator('loadingOverlayBalance');
        const inputIngresos1xSemana = document.getElementById('ingresos1xSemana');
        const inputIngresos2xSemana = document.getElementById('ingresos2xSemana');
        const inputIngresos3xSemana = document.getElementById('ingresos3xSemana');
        const inputIngresos4xSemana = document.getElementById('ingresos4xSemana');
        const inputIngresos5xSemana = document.getElementById('ingresos5xSemana');
        const inputIngresosOtros = document.getElementById('ingresosOtros');
        const inputIngresosTotales = document.getElementById('ingresosTotales');

        const cant1xsemana = document.getElementById('cant1xSemana');
        const cant2xsemana = document.getElementById('cant2xSemana');
        const cant3xsemana = document.getElementById('cant3xSemana');
        const cant4xsemana = document.getElementById('cant4xSemana');
        const cant5xsemana = document.getElementById('cant5xSemana');
        const cantOtros = document.getElementById('cantOtros');
        const cantTotal = document.getElementById('cantTotal');

        const fechaDesdeStr = `${anioDesde.value}-${String(mesDesde.value).padStart(2, '0')}-01`;
        const fechaHastaStr = `${anioHasta.value}-${String(mesHasta.value).padStart(2, '0')}-01`;

        try {
            const response = await fetch(`${API_BASE_URL}/api/cuotas/generarBalance?fechaDesde=${fechaDesdeStr}&fechaHasta=${fechaHastaStr}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    mostrarMensaje('Error de autorización al generar balance. Token inválido o expirado. Cerrando sesión.', 'danger');
                    mostrarLogin();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.message || `Error al generar balance: ${response.statusText}`);
            }

            const result = await response.json(); 
        
            inputIngresos1xSemana.textContent = fmtMoneda(result.data.ingreso1xsemana);
            inputIngresos2xSemana.textContent = fmtMoneda(result.data.ingreso2xsemana);
            inputIngresos3xSemana.textContent = fmtMoneda(result.data.ingreso3xsemana);
            inputIngresos4xSemana.textContent = fmtMoneda(result.data.ingreso4xsemana);
            inputIngresos5xSemana.textContent = fmtMoneda(result.data.ingreso5xsemana);
            inputIngresosOtros.textContent = fmtMoneda(result.data.ingresoOtro);
            inputIngresosTotales.textContent = fmtMoneda(result.data.ingresoTotal);

            cant1xsemana.textContent = fmtNumero(result.data.cant1xsemana);
            cant2xsemana.textContent = fmtNumero(result.data.cant2xsemana);
            cant3xsemana.textContent = fmtNumero(result.data.cant3xsemana);
            cant4xsemana.textContent = fmtNumero(result.data.cant4xsemana);
            cant5xsemana.textContent = fmtNumero(result.data.cant5xsemana);
            cantOtros.textContent = fmtNumero(result.data.cantOtro);
            cantTotal.textContent = fmtNumero(result.data.cantTotal);

            mostrarMensaje(`Balance generado exitosamente.`, 'success');            
            } catch (error) {
                console.error('Error al generar balance:', error);
                mostrarMensaje(error.message || 'Error al generar balance.', 'danger');
            }finally{
                hideLoadingIndicator('loadingOverlayBalance');
            }
   });

   const inputDescuento = document.getElementById('pagoDescuentoCuota');
   inputDescuento.addEventListener('input', () => {
       const montoOriginal = parseFloat(document.getElementById('pagoCuotaMonto').value) || 0;
       const descuento = parseFloat(inputDescuento.value) || 0;

       const montoConDescuento = Math.floor(montoOriginal - (montoOriginal * (descuento / 100)));
       document.getElementById('pagoDescuentoMontoCuota').value = montoConDescuento.toFixed(2);

       if(descuento > 0){
           document.getElementById('pagoDescuentoMontoCuota').parentElement.classList.remove('d-none');
       }else{
           document.getElementById('pagoDescuentoMontoCuota').parentElement.classList.add('d-none');
       }
   });

}

function inicializarCuota(){
    inicializarTablaCuotas();
    inicializarCuotaDetailModalListeners();
}

export {
    inicializarCuota,
    renderCuotaTable
}