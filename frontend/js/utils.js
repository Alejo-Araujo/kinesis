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

function showLoadingIndicator(tableLoadingOverlay) {
    const overlay = document.getElementById(tableLoadingOverlay);
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
    }
}

function hideLoadingIndicator(tableLoadingOverlay) {
    const overlay = document.getElementById(tableLoadingOverlay);
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 200);
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


export { 
    populateSelect,  
    populateAllDiagnosticosSelects, 
    debounce, 
    showLoadingIndicator, 
    hideLoadingIndicator,
    separarNumeroConRegex,
    populateAllFisiosSelects
 };