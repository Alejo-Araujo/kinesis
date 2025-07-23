const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000' // Entorno de desarrollo
    : 'http://dbksoft.com:3000'; // Entorno de producción CAMBIAR CUANDO TENGA EL SERVER

export { API_BASE_URL };