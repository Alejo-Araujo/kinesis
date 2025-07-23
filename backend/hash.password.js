const bcrypt = require('bcryptjs');

const passwordToHash = 'manya2809';

async function hashAndLogPassword() {
    try {
        // Genera un "salt" (valor aleatorio) para añadir seguridad al hash
        const saltRounds = 10; // Un valor de 10 es un buen equilibrio entre seguridad y rendimiento
        const salt = await bcrypt.genSalt(saltRounds);

        // Se hashea la contraseña
        const hashedPassword = await bcrypt.hash(passwordToHash, salt);

        //console.log('Contraseña en texto plano:', passwordToHash);
        console.log('Contraseña Hasheada (para tu DB):', hashedPassword);
    } catch (error) {
        console.error('Error al hashear la contraseña:', error);
    }
}

hashAndLogPassword();