import { API_BASE_URL } from './config.js';
import { inicializarAplicacionPrincipal } from './main.js';
import { mostrarMensaje } from './ui.js';

let divLogin;
let loginForm; 
let loginCedulaInput;
let loginPasswordInput;
let rememberMeCheckbox;
let divPrincipal;
let divLoginError;
let pantallaCarga;


function mostrarLoginError(message) {
    divLoginError.textContent = message;
    divLoginError.classList.remove('d-none');
}

function ocultarLoginError() {
    divLoginError.classList.add('d-none');
    divLoginError.textContent = '';
}

//ESTO SE LLAMA MOSTRAR LOGIN PORQUE YA LA ESTABA LLAMANDO DESDE 40 LUGARES DISTINTOS 
// Y LA TUVE QUE CAMBIAR Y NO TENIA GANAS DE CAMBIARLE EL NOMBRE :)
function mostrarLogin(){
    removeAuthToken();
    mostrarMensaje('SESIÓN EXPIRADA, REDIRIGIENDO AL LOGIN','danger');
    setTimeout(() => {
        window.location.href = '/index.html'; 
    }, 2000);
}

function mostrarLoginElementos() {
    removeAuthToken();
    if (divLogin) divLogin.classList.remove('d-none'); 
    if (divPrincipal) divPrincipal.classList.add('d-none');
    if (pantallaCarga) pantallaCarga.classList.add('d-none');
    loginForm.reset();
    ocultarLoginError();
}

function ocultarLogin() {
    if (divLogin) divLogin.classList.add('d-none'); 
    if (divPrincipal) divPrincipal.classList.remove('d-none');
    if (pantallaCarga) pantallaCarga.classList.add('d-none');
}

function guardarAuthToken(token, rememberMe) {
    if (rememberMe) {
        localStorage.setItem('jwt_token', token);
        sessionStorage.removeItem('jwt_token'); 
    } else {
        sessionStorage.setItem('jwt_token', token);
        localStorage.removeItem('jwt_token');
    }
}

function getAuthToken() {
    return localStorage.getItem('jwt_token') || sessionStorage.getItem('jwt_token');
}


function removeAuthToken() {
    localStorage.removeItem('jwt_token');
    sessionStorage.removeItem('jwt_token');
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function handleLoginSubmit(event) {
    event.preventDefault(); 
    ocultarLoginError(); 

    const cedula = loginCedulaInput.value;
    const password = loginPasswordInput.value;
    const rememberMe = rememberMeCheckbox.checked;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, 
            {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cedula, password, rememberMe })
        });

        const data = await response.json();

        if (response.ok) { 
            guardarAuthToken(data.token, rememberMe);
            console.log('Login exitoso:', data.user.cedula);
            ocultarLogin();
            inicializarAplicacionPrincipal();
            return true;
        } else { 
            mostrarLoginError(data.message || 'Error desconocido al iniciar sesión.');
            console.error('Error en el login:', data.message);
            return false;
        }
    } catch (error) {
        console.error('Error de red o del servidor:', error);
        mostrarLoginError('Error de conexión. Intenta de nuevo más tarde.');
        return false;
    }
}

async function inicializarLogin() { 
    divLogin = document.getElementById('divLogin');
    loginForm = document.getElementById('loginForm');
    loginCedulaInput = document.getElementById('loginCedula');
    loginPasswordInput = document.getElementById('loginPassword');
    rememberMeCheckbox = document.getElementById('rememberMe');
    divLoginError = document.getElementById('divLoginError');
    divPrincipal = document.getElementById('divPrincipal');
    pantallaCarga = document.getElementById('initial-loading-overlay');

    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('loginPassword');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            const icon = this.querySelector('i');
            icon.classList.toggle('bi-eye'); 
            icon.classList.toggle('bi-eye-slash');
        });
    }

    if (!loginForm){
        console.error(`login.js: No se encontró el formulario de login (ID: ${loginForm}).`);
        return false;       
    }

    const token = getAuthToken();
    let autenticado = false;

    if (!token) {
        mostrarLoginElementos();
        loginForm.addEventListener('submit', handleLoginSubmit);
    } else {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/validateToken`, { 
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

        if (response.ok) {
            console.log('Token de autenticación válido. Ocultando UI de login.');
            ocultarLogin(); 
            autenticado = true; 
        } else { 
            mostrarLogin();
            loginForm.addEventListener('submit', handleLoginSubmit);
        }
    } catch (error) {
        console.error('Error al validar el token con el servidor:', error);
        removeAuthToken(); 
        mostrarLogin();
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    }
    return autenticado;
}


export { 
    mostrarLogin,
    mostrarLoginError,
    ocultarLogin,
    ocultarLoginError,
    getAuthToken,
    guardarAuthToken,
    handleLoginSubmit,
    inicializarLogin,
};