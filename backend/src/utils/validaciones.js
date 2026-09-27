// Validaciones compartidas entre controllers.
// Todas toleran valores de cualquier tipo (número, objeto, null): nunca lanzan,
// así un body malformado responde 400 en lugar de romper el request.

function esTexto(valor) {
    return typeof valor === 'string';
}

// Fecha calendario real en formato YYYY-MM-DD (rechaza 2026-02-30, 2026-13-01, etc.).
// Se valida por componentes para no depender de la zona horaria ni del "rollover" de Date.
function esFechaISOValida(valor) {
    if (!esTexto(valor) || !/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return false;
    const [anio, mes, dia] = valor.trim().split('-').map(Number);
    if (mes < 1 || mes > 12 || dia < 1) return false;
    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return dia <= diasDelMes;
}

// Fecha de hoy (hora local del servidor) en formato YYYY-MM-DD.
function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function esEmailValido(valor) {
    return esTexto(valor) && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(valor.trim());
}

// Devuelve el teléfono normalizado (+ y dígitos) o null si el formato es inválido.
// Formato esperado: "+" + código de país + número (ej: +59899123456).
function normalizarTelefono(valor) {
    if (!esTexto(valor)) return null;
    const limpio = valor.replace(/[^+\d]/g, '');
    if (!/^\+\d{7,}$/.test(limpio)) return null;
    return limpio;
}

module.exports = {
    esTexto,
    esFechaISOValida,
    hoyISO,
    esEmailValido,
    normalizarTelefono
};
