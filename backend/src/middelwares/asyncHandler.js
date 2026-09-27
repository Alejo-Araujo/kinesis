// Express 4 no captura los errores de handlers async: una excepción no atrapada
// terminaba como "unhandledRejection" y el proceso hacía process.exit(1).
// Este wrapper deriva cualquier error al manejador global de server.js (500 JSON).
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = asyncHandler;
