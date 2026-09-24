import { API_BASE_URL } from './config.js';
import { getAuthToken, mostrarLogin } from './login.js';
import { mostrarMensaje, mostrarConfirmacion } from './ui.js';
import { showLoadingIndicator, hideLoadingIndicator } from './utils.js';

const modalUsuarioEl = document.getElementById('modalUsuario');
const modalUsuario = new bootstrap.Modal(modalUsuarioEl);
const formUsuario = document.getElementById('formUsuario');

const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`
});

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

async function fetchUsuarios() {
    const response = await fetch(`${API_BASE_URL}/api/usuarios`, { headers: authHeaders() });
    const data = await manejarRespuesta(response, 'Error al obtener los usuarios.');
    return data.usuarios || [];
}

function iconoBool(valor) {
    const i = document.createElement('i');
    i.className = valor ? 'bi bi-check-circle-fill text-success' : 'bi bi-dash-lg text-muted';
    return i;
}

async function renderUsuariosTable() {
    const tbody = document.getElementById('tbodyUsuarios');
    const contador = document.getElementById('contadorUsuarios');
    if (!tbody) return;

    showLoadingIndicator('tableLoadingOverlayUsuarios');
    try {
        const usuarios = await fetchUsuarios();
        tbody.replaceChildren();

        if (usuarios.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.className = 'text-center text-muted p-3';
            td.textContent = 'No hay usuarios.';
            tr.appendChild(td);
            tbody.appendChild(tr);
            if (contador) contador.textContent = '0';
            return;
        }

        usuarios.forEach(u => {
            const tr = document.createElement('tr');

            const tdNombre = document.createElement('td');
            tdNombre.textContent = u.nomyap;

            const tdCedula = document.createElement('td');
            tdCedula.textContent = u.cedula;

            const tdFisio = document.createElement('td');
            tdFisio.appendChild(iconoBool(u.esFisio));

            const tdAdmin = document.createElement('td');
            tdAdmin.appendChild(iconoBool(u.esAdmin));

            const tdAcciones = document.createElement('td');
            tdAcciones.className = 'text-end';
            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn btn-warning btn-sm me-2';
            btnEditar.textContent = 'Modificar';
            btnEditar.addEventListener('click', () => abrirModalEditar(u));
            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'btn btn-danger btn-sm';
            btnEliminar.textContent = 'Eliminar';
            btnEliminar.addEventListener('click', () => eliminarUsuario(u));
            tdAcciones.append(btnEditar, btnEliminar);

            tr.append(tdNombre, tdCedula, tdFisio, tdAdmin, tdAcciones);
            tbody.appendChild(tr);
        });

        if (contador) contador.textContent = String(usuarios.length);
    } catch (error) {
        console.error('Error en renderUsuariosTable:', error);
        if (error.message !== 'No autorizado') {
            mostrarMensaje('Error al cargar los usuarios.', 'danger');
        }
    } finally {
        hideLoadingIndicator('tableLoadingOverlayUsuarios');
    }
}

function configurarModalAlta() {
    document.getElementById('modalUsuarioLabel').textContent = 'Agregar Usuario';
    document.getElementById('inputIdUsuario').value = '';
    formUsuario.reset();
    document.getElementById('notaPasswordUsuario').classList.remove('d-none');
    document.getElementById('btnGuardarUsuario').textContent = 'Guardar Usuario';
}

function abrirModalEditar(u) {
    document.getElementById('modalUsuarioLabel').textContent = 'Editar Usuario';
    document.getElementById('inputIdUsuario').value = u.id;
    document.getElementById('inputNombreUsuario').value = u.nomyap || '';
    document.getElementById('inputCedulaUsuario').value = u.cedula || '';
    document.getElementById('inputEmailUsuario').value = u.gmail || '';
    document.getElementById('inputTelefonoUsuario').value = u.telefono || '';
    document.getElementById('inputFechaNacUsuario').value = u.fechaNacimiento || '';
    document.getElementById('checkEsFisio').checked = !!u.esFisio;
    document.getElementById('checkEsAdmin').checked = !!u.esAdmin;
    // En edición la contraseña no se toca (se cambia con "Cambiar contraseña").
    document.getElementById('notaPasswordUsuario').classList.add('d-none');
    document.getElementById('btnGuardarUsuario').textContent = 'Guardar Cambios';
    modalUsuario.show();
}

function leerFormulario() {
    return {
        nomyap: document.getElementById('inputNombreUsuario').value.trim(),
        cedula: document.getElementById('inputCedulaUsuario').value.trim(),
        gmail: document.getElementById('inputEmailUsuario').value.trim() || null,
        telefono: document.getElementById('inputTelefonoUsuario').value.trim() || null,
        fechaNacimiento: document.getElementById('inputFechaNacUsuario').value || null,
        esFisio: document.getElementById('checkEsFisio').checked,
        esAdmin: document.getElementById('checkEsAdmin').checked
    };
}

async function guardarUsuario(event) {
    event.preventDefault();
    const id = document.getElementById('inputIdUsuario').value;
    const payload = leerFormulario();

    if (!payload.nomyap) { mostrarMensaje('El nombre y apellido es requerido.', 'warning'); return; }
    if (!/^\d{7,8}$/.test(payload.cedula)) { mostrarMensaje('La cédula debe tener 7 u 8 dígitos.', 'warning'); return; }

    try {
        let response;
        if (id) {
            response = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, {
                method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
            });
            // Quitar rol fisio estando en grupos vigentes -> confirmar y reintentar con force.
            if (response.status === 409) {
                const d = await response.json().catch(() => ({}));
                if (d.enGrupos) {
                    const ok = await mostrarConfirmacion(
                        `${d.message} Al quitarle el rol de fisioterapeuta se lo dará de baja de esos grupos. ¿Continuar?`,
                        'Quitar rol de fisioterapeuta', 'Continuar', 'Cancelar', 'btn-danger'
                    );
                    if (!ok) return;
                    response = await fetch(`${API_BASE_URL}/api/usuarios/${id}?force=1`, {
                        method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
                    });
                } else {
                    mostrarMensaje(d.message || 'Conflicto al actualizar el usuario.', 'danger');
                    return;
                }
            }
        } else {
            response = await fetch(`${API_BASE_URL}/api/usuarios`, {
                method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
            });
        }

        const data = await manejarRespuesta(response, 'Error al guardar el usuario.');
        modalUsuario.hide();
        mostrarMensaje(data.message || 'Usuario guardado exitosamente.', 'success');
        await renderUsuariosTable();
    } catch (error) {
        console.error('Error al guardar usuario:', error);
        if (error.message !== 'No autorizado') {
            mostrarMensaje(error.message || 'Error al guardar el usuario.', 'danger');
        }
    }
}

async function eliminarUsuario(u) {
    const confirmado = await mostrarConfirmacion(
        `¿Dar de baja al usuario "${u.nomyap}"?`,
        'Eliminar Usuario', 'Eliminar', 'Cancelar', 'btn-danger'
    );
    if (!confirmado) return;

    try {
        let response = await fetch(`${API_BASE_URL}/api/usuarios/${u.id}`, {
            method: 'DELETE', headers: authHeaders()
        });

        // Está en grupos vigentes -> avisar y ofrecer baja en cascada (force).
        if (response.status === 409) {
            const d = await response.json().catch(() => ({}));
            if (d.enGrupos) {
                const ok = await mostrarConfirmacion(
                    `${d.message} Se darán de baja todas sus inscripciones a grupos, sus roles y el usuario.`,
                    'El fisioterapeuta está en grupos', 'Dar de baja igual', 'Cancelar', 'btn-danger'
                );
                if (!ok) return;
                response = await fetch(`${API_BASE_URL}/api/usuarios/${u.id}?force=1`, {
                    method: 'DELETE', headers: authHeaders()
                });
            } else {
                mostrarMensaje(d.message || 'No se pudo dar de baja el usuario.', 'danger');
                return;
            }
        }

        const data = await manejarRespuesta(response, 'Error al dar de baja el usuario.');
        mostrarMensaje(data.message || 'Usuario dado de baja exitosamente.', 'success');
        await renderUsuariosTable();
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        if (error.message !== 'No autorizado') {
            mostrarMensaje(error.message || 'Error al dar de baja el usuario.', 'danger');
        }
    }
}

function inicializarUsuarios() {
    const btnAgregar = document.getElementById('btnAgregarUsuario');
    if (btnAgregar) btnAgregar.addEventListener('click', configurarModalAlta);
    if (formUsuario) formUsuario.addEventListener('submit', guardarUsuario);
}

export { inicializarUsuarios, renderUsuariosTable };
