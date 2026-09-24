import { API_BASE_URL } from './config.js';
import { getAuthToken, mostrarLogin } from './login.js';
import { mostrarMensaje, mostrarConfirmacion } from './ui.js';
import { showLoadingIndicator, hideLoadingIndicator } from './utils.js';

const modalTarifaElement = document.getElementById('modalTarifa');
const modalTarifa = new bootstrap.Modal(modalTarifaElement);
const formTarifa = document.getElementById('formTarifa');

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
});

function formatearMonto(monto) {
    const n = Number(monto);
    return '$' + (isNaN(n) ? monto : n.toLocaleString('es-UY'));
}

// El backend envía las fechas como 'YYYY-MM-DD'. Se parte el string (sin new Date)
// para mostrarlas como 'dd-mm-yyyy' y evitar el corrimiento de zona horaria (ver CLAUDE.md).
function formatearFecha(fechaISO) {
    if (!fechaISO) return '—';
    const partes = fechaISO.split('-');
    if (partes.length !== 3) return fechaISO;
    const [anio, mes, dia] = partes;
    return `${dia}-${mes}-${anio}`;
}

// Maneja errores comunes de las respuestas de la API de tarifas.
async function manejarRespuesta(response, mensajeGenerico) {
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            mostrarLogin();
            throw new Error('No autorizado');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || response.statusText || mensajeGenerico);
    }
    return response.json().catch(() => ({}));
}

async function fetchTarifas() {
    const response = await fetch(`${API_BASE_URL}/api/tarifas`, {
        method: 'GET',
        headers: authHeaders()
    });
    const data = await manejarRespuesta(response, 'Error al obtener las tarifas.');
    return data.tarifas || [];
}

async function renderTarifasTable() {
    const tbody = document.getElementById('tbodyTarifas');
    const contador = document.getElementById('contadorTarifas');
    if (!tbody) return;

    showLoadingIndicator('tableLoadingOverlayTarifas');
    try {
        const tarifas = await fetchTarifas();
        tbody.replaceChildren();

        if (tarifas.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.className = 'text-center text-muted p-3';
            td.textContent = 'No hay tarifas cargadas.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            if (contador) contador.textContent = '0';
            return;
        }

        // Las filas vienen ordenadas por cantidadDias ASC, fechaDesde DESC:
        // la PRIMERA fila de cada cantidadDias es la más reciente (única borrable).
        const yaVistoMasReciente = new Set();

        tarifas.forEach(t => {
            const esMasReciente = !yaVistoMasReciente.has(t.cantidadDias);
            yaVistoMasReciente.add(t.cantidadDias);

            const tr = document.createElement('tr');

            const tdDias = document.createElement('td');
            tdDias.textContent = `${t.cantidadDias} ${t.cantidadDias === 1 ? 'día' : 'días'} por semana`;

            const tdMonto = document.createElement('td');
            tdMonto.textContent = formatearMonto(t.monto);

            const tdDesde = document.createElement('td');
            tdDesde.textContent = formatearFecha(t.fechaDesde);

            const tdHasta = document.createElement('td');
            tdHasta.textContent = t.fechaHasta ? formatearFecha(t.fechaHasta) : '—';

            const tdEstado = document.createElement('td');
            const badge = document.createElement('span');
            const clase = t.estado === 'Vigente' ? 'bg-success'
                        : t.estado === 'Programada' ? 'bg-info text-dark'
                        : 'bg-secondary';
            badge.className = `badge ${clase}`;
            badge.textContent = t.estado === 'Historica' ? 'Histórica' : t.estado;
            tdEstado.appendChild(badge);

            const tdAcciones = document.createElement('td');
            tdAcciones.className = 'text-end';

            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn btn-warning btn-sm me-2';
            btnEditar.textContent = 'Modificar';
            btnEditar.addEventListener('click', () => abrirModalEditar(t));
            tdAcciones.appendChild(btnEditar);

            // Sólo la tarifa más reciente de cada cantidadDias se puede eliminar.
            if (esMasReciente) {
                const btnEliminar = document.createElement('button');
                btnEliminar.className = 'btn btn-danger btn-sm';
                btnEliminar.textContent = 'Eliminar';
                btnEliminar.addEventListener('click', () => eliminarTarifa(t));
                tdAcciones.appendChild(btnEliminar);
            }

            tr.append(tdDias, tdMonto, tdDesde, tdHasta, tdEstado, tdAcciones);
            tbody.appendChild(tr);
        });

        if (contador) contador.textContent = String(tarifas.length);
    } catch (error) {
        console.error('Error en renderTarifasTable:', error);
        if (error.message !== 'No autorizado') {
            mostrarMensaje('Error al cargar las tarifas.', 'danger');
        }
    } finally {
        hideLoadingIndicator('tableLoadingOverlayTarifas');
    }
}

function poblarAniosTarifa() {
    const select = document.getElementById('selectAnioTarifa');
    if (!select) return;
    const currentYear = new Date().getFullYear();
    select.replaceChildren();
    for (let year = currentYear - 1; year <= currentYear + 2; year++) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        select.appendChild(option);
    }
    select.value = String(currentYear);
}

function configurarModalAlta() {
    document.getElementById('modalTarifaLabel').textContent = 'Agregar Tarifa';
    document.getElementById('inputModoTarifa').value = 'add';
    document.getElementById('inputFechaDesdeTarifaEdit').value = '';

    const selectDias = document.getElementById('selectCantidadDiasTarifa');
    selectDias.disabled = false;
    selectDias.value = '1';

    document.getElementById('inputMontoTarifa').value = '0';

    const grupoFecha = document.getElementById('grupoFechaTarifa');
    grupoFecha.classList.remove('d-none');
    poblarAniosTarifa();
    document.getElementById('selectMesTarifa').value = String(new Date().getMonth() + 1);

    document.getElementById('btnGuardarTarifa').textContent = 'Guardar Tarifa';
}

function abrirModalEditar(tarifa) {
    document.getElementById('modalTarifaLabel').textContent = 'Editar Monto de Tarifa';
    document.getElementById('inputModoTarifa').value = 'edit';
    document.getElementById('inputFechaDesdeTarifaEdit').value = tarifa.fechaDesde;

    const selectDias = document.getElementById('selectCantidadDiasTarifa');
    selectDias.value = String(tarifa.cantidadDias);
    selectDias.disabled = true; // la cantidad de días y la fecha identifican la tarifa: no se editan

    document.getElementById('inputMontoTarifa').value = tarifa.monto;

    // En edición sólo se corrige el monto; la fecha de vigencia no cambia.
    document.getElementById('grupoFechaTarifa').classList.add('d-none');

    document.getElementById('btnGuardarTarifa').textContent = 'Guardar Cambios';

    modalTarifa.show();
}

async function guardarTarifa(event) {
    event.preventDefault();

    const modo = document.getElementById('inputModoTarifa').value;
    const cantidadDias = parseInt(document.getElementById('selectCantidadDiasTarifa').value, 10);
    const monto = parseInt(document.getElementById('inputMontoTarifa').value, 10);

    if (isNaN(monto) || monto < 0) {
        mostrarMensaje('El monto debe ser un número mayor o igual a 0.', 'warning');
        return;
    }

    try {
        let response;
        if (modo === 'edit') {
            const fechaDesde = document.getElementById('inputFechaDesdeTarifaEdit').value;
            response = await fetch(`${API_BASE_URL}/api/tarifas`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ cantidadDias, fechaDesde, monto })
            });
        } else {
            const mes = String(document.getElementById('selectMesTarifa').value).padStart(2, '0');
            const anio = document.getElementById('selectAnioTarifa').value;
            const fechaDesde = `${anio}-${mes}-01`;
            response = await fetch(`${API_BASE_URL}/api/tarifas`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ cantidadDias, monto, fechaDesde })
            });
        }

        const data = await manejarRespuesta(response, 'Error al guardar la tarifa.');
        modalTarifa.hide();
        mostrarMensaje(data.message || 'Tarifa guardada exitosamente.', 'success');
        await renderTarifasTable();
    } catch (error) {
        console.error('Error al guardar tarifa:', error);
        if (error.message !== 'No autorizado') {
            mostrarMensaje(error.message || 'Error al guardar la tarifa.', 'danger');
        }
    }
}

async function eliminarTarifa(tarifa) {
    const confirmado = await mostrarConfirmacion(
        `¿Eliminar la tarifa de ${tarifa.cantidadDias} día(s) vigente desde ${tarifa.fechaDesde}? ` +
        `Se reactivará la tarifa anterior (si existía).`,
        'Eliminar Tarifa', 'Eliminar', 'Cancelar', 'btn-danger'
    );
    if (!confirmado) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/tarifas`, {
            method: 'DELETE',
            headers: authHeaders(),
            body: JSON.stringify({ cantidadDias: tarifa.cantidadDias, fechaDesde: tarifa.fechaDesde })
        });
        const data = await manejarRespuesta(response, 'Error al eliminar la tarifa.');
        mostrarMensaje(data.message || 'Tarifa eliminada exitosamente.', 'success');
        await renderTarifasTable();
    } catch (error) {
        console.error('Error al eliminar tarifa:', error);
        if (error.message !== 'No autorizado') {
            mostrarMensaje(error.message || 'Error al eliminar la tarifa.', 'danger');
        }
    }
}

function inicializarTarifas() {
    const btnAgregar = document.getElementById('btnAgregarTarifa');
    if (btnAgregar) {
        // El botón abre el modal vía data-bs-toggle; acá lo dejamos en modo "alta".
        btnAgregar.addEventListener('click', configurarModalAlta);
    }
    if (formTarifa) {
        formTarifa.addEventListener('submit', guardarTarifa);
    }
}

export { inicializarTarifas, renderTarifasTable };
