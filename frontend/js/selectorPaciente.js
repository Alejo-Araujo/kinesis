// Selector de paciente UNIFICADO y reutilizable.
// Reemplaza a los 4 modales duplicados ("Seleccionar Paciente") que existían
// para agenda clínica, calendario/sesión, cuotas y agenda personal.
//
// Uso:
//   import { abrirSelectorPaciente, cerrarSelectorPaciente } from './selectorPaciente.js';
//   abrirSelectorPaciente({
//     titulo: 'Agregar Paciente al Horario',
//     textoBoton: 'Agregar Paciente',
//     onSelect: async (paciente) => {   // paciente = { id, nombre, cedula }
//        ...  // lógica de cada pantalla
//        cerrarSelectorPaciente();      // cerrar en caso de éxito
//     }
//   });

import { renderPacientesTable, resetPaginaPacientes } from './pacientes.js';
import { mostrarMensaje } from './ui.js';

// Ids del único modal (definidos en index.html #modalSeleccionarPaciente)
const IDS = {
    modal: 'modalSeleccionarPaciente',
    label: 'modalSeleccionarPacienteLabel',
    tabla: 'tablaPacientesSelector',
    contador: 'contadorPacientesSelector',
    paginacion: 'paginationControlsSelector',
    diagnostico: 'selectDiagnosticosSelector',
    nombre: 'inputBuscarNombreSelector',
    cedula: 'inputBuscarCedulaSelector',
    activo: 'selectActiveSelector',
    overlay: 'tableLoadingOverlaySelector',
    btn: 'btnConfirmarSeleccionPaciente',
};

let modalInstance = null;
let onSelectActual = null;

function renderTabla() {
    renderPacientesTable(
        IDS.tabla,
        IDS.contador,
        IDS.paginacion,
        IDS.diagnostico,
        IDS.nombre,
        IDS.cedula,
        IDS.activo,
        [IDS.btn],
        IDS.overlay
    );
}

// Se llama una sola vez al iniciar la app.
export function initSelectorPaciente() {
    const modalEl = document.getElementById(IDS.modal);
    if (!modalEl) return;
    modalInstance = new bootstrap.Modal(modalEl);

    const btn = document.getElementById(IDS.btn);
    if (btn) {
        btn.addEventListener('click', () => {
            const fila = document.querySelector(`#${IDS.tabla} tbody tr.table-selected`);
            if (!fila || !fila.dataset.pacienteId) {
                mostrarMensaje('Por favor, selecciona un paciente de la tabla.', 'info');
                return;
            }
            const paciente = {
                id: fila.dataset.pacienteId,
                nombre: fila.children[1] ? fila.children[1].textContent.trim() : '',
                cedula: fila.children[2] ? fila.children[2].textContent.trim() : '',
            };
            if (typeof onSelectActual === 'function') {
                onSelectActual(paciente);
            }
        });
    }
}

// Abre el selector configurado para el contexto que lo invoca.
export function abrirSelectorPaciente({ titulo = 'Seleccionar Paciente', textoBoton = 'Seleccionar', onSelect } = {}) {
    onSelectActual = onSelect;

    const label = document.getElementById(IDS.label);
    if (label) label.textContent = titulo;

    const btn = document.getElementById(IDS.btn);
    if (btn) {
        btn.textContent = textoBoton;
        btn.disabled = true; // se habilita al seleccionar una fila (inicializarPatientTable)
    }

    // Reset de filtros
    const nombre = document.getElementById(IDS.nombre);
    const cedula = document.getElementById(IDS.cedula);
    const activo = document.getElementById(IDS.activo);
    const diag = document.getElementById(IDS.diagnostico);
    if (nombre) nombre.value = '';
    if (cedula) cedula.value = '';
    if (activo) activo.value = '1';
    if (diag) diag.value = '';

    // Reset de selección de fila
    const seleccionada = document.querySelector(`#${IDS.tabla} tbody tr.table-selected`);
    if (seleccionada) seleccionada.classList.remove('table-selected');

    resetPaginaPacientes();
    renderTabla();

    if (modalInstance) modalInstance.show();
}

export function cerrarSelectorPaciente() {
    if (modalInstance) modalInstance.hide();
}
