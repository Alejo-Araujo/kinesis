import { API_BASE_URL } from './config.js';
import { getAuthToken, removeAuthToken } from './login.js';
import { mostrarMensaje } from './ui.js';

const modalCambiarPasswordEl = document.getElementById('modalCambiarPassword');
const modalCambiarPassword = modalCambiarPasswordEl ? new bootstrap.Modal(modalCambiarPasswordEl) : null;

// Carga nombre + roles del usuario logueado en el menú de perfil.
async function cargarPerfil() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        if (!response.ok) return;
        const data = await response.json();

        const nombre = document.getElementById('perfilNombre');
        if (nombre) nombre.textContent = data.nomyap || 'Usuario';

        // "Administrar usuarios" (en el menú "Otros") solo para administradores.
        const liAdmin = document.getElementById('liAdministrarUsuarios');
        if (liAdmin) liAdmin.hidden = !data.esAdmin;
    } catch (error) {
        console.error('Error al cargar el perfil:', error);
    }
}

function cerrarSesion() {
    removeAuthToken();
    window.location.href = '/index.html';
}

async function cambiarPassword(event) {
    event.preventDefault();

    const actual = document.getElementById('inputPasswordActual').value;
    const nueva = document.getElementById('inputPasswordNueva').value;
    const nueva2 = document.getElementById('inputPasswordNueva2').value;

    if (nueva !== nueva2) {
        mostrarMensaje('Las contraseñas nuevas no coinciden.', 'warning');
        return;
    }
    if (nueva.length < 4) {
        mostrarMensaje('La contraseña nueva debe tener al menos 4 caracteres.', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            mostrarMensaje(data.message || 'Error al cambiar la contraseña.', 'danger');
            return;
        }
        if (modalCambiarPassword) modalCambiarPassword.hide();
        document.getElementById('formCambiarPassword').reset();
        mostrarMensaje(data.message || 'Contraseña actualizada exitosamente.', 'success');
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        mostrarMensaje('Error al cambiar la contraseña.', 'danger');
    }
}

function inicializarPerfil() {
    cargarPerfil();

    const btnCerrar = document.getElementById('btnCerrarSesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', (e) => { e.preventDefault(); cerrarSesion(); });
    }

    const btnCambiar = document.getElementById('btnCambiarPassword');
    if (btnCambiar) {
        btnCambiar.addEventListener('click', (e) => {
            e.preventDefault();
            const form = document.getElementById('formCambiarPassword');
            if (form) form.reset();
            if (modalCambiarPassword) modalCambiarPassword.show();
        });
    }

    const form = document.getElementById('formCambiarPassword');
    if (form) form.addEventListener('submit', cambiarPassword);
}

export { inicializarPerfil, cargarPerfil };
