// URL base de la API — se resuelve automaticamente segun el entorno:
//  - Desarrollo (localhost / 127.0.0.1): backend local en el puerto 3000.
//  - Produccion: mismo origen desde el que se sirve el frontend. Como el backend
//    Express sirve la API y el frontend juntos, no hay dominio ni puerto hardcodeado;
//    se adapta solo a cualquier host/puerto donde se despliegue.
// Se puede forzar una URL concreta definiendo window.__API_BASE_URL__ antes de cargar este modulo.
const esLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL =
    (typeof window !== 'undefined' && window.__API_BASE_URL__) ||
    (esLocal ? 'http://localhost:3000' : window.location.origin);

export { API_BASE_URL };