// Helpers para los eventos de auditoría (logger.auditar).

// Valor comparable/serializable: fechas como YYYY-MM-DD (hora local), vacíos como null.
function valorComparable(v) {
    if (v === undefined || v === null || v === '') return null;
    if (v instanceof Date) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    return String(v);
}

// Devuelve los campos de `despues` cuyo valor difiere de `antes`.
//  - Campos listados en `conValores`: { antes, despues } (para ver qué cambió).
//  - Resto: 'modificado' (datos personales como teléfono o email no se copian al log).
function diferencias(antes, despues, conValores = []) {
    const cambios = {};
    for (const campo of Object.keys(despues)) {
        const a = valorComparable(antes ? antes[campo] : undefined);
        const d = valorComparable(despues[campo]);
        if (a !== d) {
            cambios[campo] = conValores.includes(campo) ? { antes: a, despues: d } : 'modificado';
        }
    }
    return cambios;
}

module.exports = { diferencias, valorComparable };
