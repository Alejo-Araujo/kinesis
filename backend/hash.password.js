const bcrypt = require('bcryptjs');
const crypto = require('crypto');
//console.log(crypto.randomBytes(64).toString('hex'));

// La contraseña a hashear NO se hardcodea: se pasa como argumento de linea de
// comandos (node hash.password.js <password>) o mediante la variable de entorno
// PASSWORD_TO_HASH. Asi no queda ninguna credencial fija en el codigo.
const passwordToHash = process.argv[2] || process.env.PASSWORD_TO_HASH;

async function hashAndLogPassword() {
    try {
        if (!passwordToHash) {
            console.error('Uso: node hash.password.js <password>  (o define PASSWORD_TO_HASH en el entorno).');
            process.exit(1);
        }
        // Genera un "salt" (valor aleatorio
        // ) para añadir seguridad al hash
        const saltRounds = 10; // Un valor de 10 es un buen equilibrio entre seguridad y rendimiento
        const salt = await bcrypt.genSalt(saltRounds);

        // Se hashea la contraseña
        const hashedPassword = await bcrypt.hash(passwordToHash, salt);

        console.log('Contraseña en texto plano:', passwordToHash);
        console.log('Contraseña Hasheada (para tu DB):', hashedPassword);
    } catch (error) {
        console.error('Error al hashear la contraseña:', error);
    }
}

hashAndLogPassword();