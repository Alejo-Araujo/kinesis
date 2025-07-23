import { API_BASE_URL } from "./config.js";
import { getAuthToken } from "./login.js";

async function fetchFisios(){
    try {
        const response = await fetch(`${API_BASE_URL}/api/fisios/`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        }); 
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                mostrarLogin();
                return; 
            }
            const errorData = await response.text();
            throw new Error(`Error ${response.status}: ${errorData.message || response.statusText || 'Error desconocido al obtener los fisioterapeutas' }`);
        }
        const data = await response.json();
        return data; 
    } catch (error) {
        console.error("Error al obtener los fisios:", error);
        throw error;
    }
}


export { fetchFisios }