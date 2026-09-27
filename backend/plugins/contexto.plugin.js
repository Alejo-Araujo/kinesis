// Contexto por request (AsyncLocalStorage): permite que cualquier log emitido durante un
// request lleve el requestId y el id del usuario autenticado sin tener que pasar `req`.
//
// - server.js crea el contexto (después de express.json(), porque los parsers de body
//   basados en streams pierden el contexto asíncrono).
// - authenticateToken completa `idUsuario` al validar el token.
// - Los crons corren dentro de un contexto con idUsuario = 'sistema'.
const { AsyncLocalStorage } = require('async_hooks');

const contextoRequest = new AsyncLocalStorage();

function obtenerContexto() {
    return contextoRequest.getStore() || null;
}

// Ejecuta `fn` dentro de un contexto nuevo (usado por crons y scripts).
function ejecutarConContexto(contexto, fn) {
    return contextoRequest.run(contexto, fn);
}

// Middleware que re-entra al contexto del request. Necesario después de middlewares
// basados en streams (p.ej. multer), que continúan fuera del contexto asíncrono original.
function reanudarContexto(req, res, next) {
    if (req.contexto) {
        contextoRequest.enterWith(req.contexto);
    }
    next();
}

module.exports = {
    contextoRequest,
    obtenerContexto,
    ejecutarConContexto,
    reanudarContexto
};
