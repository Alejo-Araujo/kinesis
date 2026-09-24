import { fetchDiagnosticos } from './diagnosticos.js';
import { fetchFisios } from './fisioterapeutas.js';

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function populateSelect(selectId, data, firstOptionText = "Seleccione...", firstOptionValue = "") {
    const selectElement = document.getElementById(selectId);

    if (!selectElement) {
        console.warn(`Elemento <select> con ID "${selectId}" no encontrado. No se pudo rellenar.`);
        return;
    }

    selectElement.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = firstOptionValue;
    defaultOption.textContent = firstOptionText;
    // defaultOption.disabled = true;
    selectElement.appendChild(defaultOption);

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.nombre || item.nomyap;
        selectElement.appendChild(option);
    });
}

async function populateAllFisiosSelects(firstOptionText = "Seleccione...", firstOptionValue = "") {
    const fisios = await fetchFisios();
    const selectElementsToPopulate = document.querySelectorAll('select[id^="selectFisios"]');



    if (fisios && fisios.length > 0) {
        if (selectElementsToPopulate.length > 0) {
            selectElementsToPopulate.forEach(selectElement => {
                populateSelect(selectElement.id, fisios, firstOptionText, firstOptionValue);
                selectElement.disabled = false;
            });
        } else {
            console.warn("No se encontraron elementos <select> en el DOM cuyo ID empiece por 'selectFisios'.");
        }
    } else {
        console.warn("No se recibieron datos de los fisios o el array está vacío. No se pudieron rellenar los selects.");
        selectElementsToPopulate.forEach(selectElement => {
            selectElement.disabled = true;
            selectElement.innerHTML = `<option value="">No hay fisios disponibles</option>`;
        });
    }
}

async function populateAllDiagnosticosSelects(firstOptionText = "Seleccione...", firstOptionValue = "") {
    const diagnosticos = await fetchDiagnosticos();
    const selectElementsToPopulate = document.querySelectorAll('select[id^="selectDiagnosticos"]');

    if (diagnosticos && diagnosticos.length > 0) {
        if (selectElementsToPopulate.length > 0) {
            selectElementsToPopulate.forEach(selectElement => {
                populateSelect(selectElement.id, diagnosticos, firstOptionText, firstOptionValue);
                selectElement.disabled = false;
            });
        } else {
            console.warn("No se encontraron elementos <select> en el DOM cuyo ID empiece por 'selectDiagnosticos'.");
        }
    } else {
        console.warn("No se recibieron datos de diagnósticos o el array está vacío. No se pudieron rellenar los selects.");
        selectElementsToPopulate.forEach(selectElement => {
            selectElement.disabled = true;
            selectElement.innerHTML = `<option value="">No hay diagnósticos disponibles</option>`;
        });
    }
}

async function populateAllYearSelects() {
    const selectElementsToPopulate = document.querySelectorAll('select[id^="selectAnio"]');
    const currentYear = new Date().getFullYear();
    const startYearRange = 2025;

    const startYear = Math.min(startYearRange, currentYear);
    const endYear = currentYear + 1;

    if (selectElementsToPopulate.length > 0) {
        selectElementsToPopulate.forEach(selectElement => {
            selectElement.innerHTML = '';
            for (let year = startYear; year <= endYear; year++) {
                const option = document.createElement('option');
                option.value = year.toString();
                option.textContent = year;
                selectElement.appendChild(option);
            }
        });

    } else {
        console.warn("No se encontraron elementos <select> cuyo ID empiece por 'selectAnio'.");
    }
}

function showLoadingIndicator(tableLoadingOverlay) {
    const overlay = document.getElementById(tableLoadingOverlay);
    if (overlay) {
        const parentContainer = overlay.parentElement;
        
        // Asignar una altura mínima al contenedor padre para que el overlay no se corte
        // El valor de 150px es un buen punto de partida, puedes ajustarlo.
        if (parentContainer) {
            parentContainer.style.minHeight = '150px';
        }

        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    }
}

function hideLoadingIndicator(tableLoadingOverlay) {
    const overlay = document.getElementById(tableLoadingOverlay);
    if (overlay) {
        const parentContainer = overlay.parentElement;
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 200);

        if (parentContainer) {
            parentContainer.style.minHeight = 'auto';
        }
    }
}

function separarNumeroConRegex(numeroCompleto) {
    // Expresión regular:
    // ^\+           -> Coincide con el inicio de la cadena y el signo '+'
    // (\d{1,4})     -> Captura 1 a 4 dígitos (el código de país, ajusta el rango si es necesario)
    // (.*)          -> Captura el resto de la cadena (el número de teléfono)
    const regex = /^\+(\d{1,3})(.*)$/;
    const match = numeroCompleto.match(regex);

    if (match) {
        // match[0] es la cadena completa
        // match[1] es el primer grupo capturado (el código de país sin el '+')
        // match[2] es el segundo grupo capturado (el número de teléfono)
        return {
            codigoPais: '+' + match[1],
            numeroTelefono: match[2]
        };
    } else {
        console.warn("El formato del número no coincide con el patrón esperado.");
        return {
            codigoPais: '',
            numeroTelefono: numeroCompleto
        };
    }
}


// Construye los controles de paginación (flechas « ‹ › » + números) dentro del <ul> dado.
// - ul: elemento <ul.pagination> contenedor.
// - currentPage / totalPages: estado actual.
// - onGoTo(page): callback al navegar a una página válida distinta de la actual.
// Muestra sólo una ventana de números (primera, última y la actual ±1) con elipsis
// para que no se desborde cuando hay muchas páginas.
function renderPaginacion(ul, currentPage, totalPages, onGoTo) {
    if (!ul) return;
    ul.innerHTML = '';
    if (totalPages <= 1) return;

    const agregarItem = (etiqueta, page, { disabled = false, active = false, aria } = {}) => {
        const li = document.createElement('li');
        li.className = 'page-item';
        if (disabled) li.classList.add('disabled');
        if (active) li.classList.add('active');

        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = etiqueta;
        if (aria) a.setAttribute('aria-label', aria);
        a.addEventListener('click', (e) => {
            e.preventDefault();
            if (disabled || active || page < 1 || page > totalPages || page === currentPage) return;
            onGoTo(page);
        });

        li.appendChild(a);
        ul.appendChild(li);
    };

    const agregarElipsis = () => {
        const li = document.createElement('li');
        li.className = 'page-item disabled';
        const span = document.createElement('span');
        span.className = 'page-link';
        span.textContent = '…';
        li.appendChild(span);
        ul.appendChild(li);
    };

    // « primera y ‹ anterior
    agregarItem('«', 1, { disabled: currentPage === 1, aria: 'Primera página' });
    agregarItem('‹', currentPage - 1, { disabled: currentPage === 1, aria: 'Página anterior' });

    // Ventana de números: primera, última y la actual ±1, con elipsis entre saltos.
    const numeros = [...new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])]
        .filter(p => p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);
    let anterior = 0;
    for (const p of numeros) {
        if (p - anterior > 1) agregarElipsis();
        agregarItem(String(p), p, { active: p === currentPage });
        anterior = p;
    }

    // › siguiente y » última
    agregarItem('›', currentPage + 1, { disabled: currentPage === totalPages, aria: 'Página siguiente' });
    agregarItem('»', totalPages, { disabled: currentPage === totalPages, aria: 'Última página' });
}

export {
    populateSelect,
    populateAllDiagnosticosSelects,
    debounce,
    showLoadingIndicator,
    hideLoadingIndicator,
    separarNumeroConRegex,
    populateAllFisiosSelects,
    populateAllYearSelects,
    renderPaginacion
 };