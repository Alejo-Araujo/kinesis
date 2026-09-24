const db = require('../db');
const bcrypt = require('bcryptjs');
const crearLogger = require('../../plugins/logger.plugin.js');
const logger = crearLogger('usuariosController.js');

function isValidCedula(cedula) {
    return typeof cedula === 'string' && /^\d{7,8}$/.test(cedula.trim());
}

function esForce(req) {
    return req.query.force === '1' || req.query.force === 'true';
}

// ---- Helpers de roles (usan una conexión con transacción) ----

async function fisioIdDeUsuario(conn, idUsuario) {
    const [rows] = await conn.execute('SELECT id FROM fisioterapeuta WHERE idUsuario = ?', [idUsuario]);
    return rows.length ? rows[0].id : null;
}

// Grupos vigentes en los que participa el fisio de ese usuario.
async function gruposVigentes(conn, idUsuario) {
    const [rows] = await conn.execute(
        `SELECT gf.diaSemana, gf.horaInicio, gf.horaFin
         FROM grupofisioterapeuta gf
         JOIN fisioterapeuta f ON f.id = gf.idFisio
         WHERE f.idUsuario = ? AND gf.fechaBaja IS NULL`,
        [idUsuario]
    );
    return rows;
}

// Activar rol (INSERT o reactivar la fila existente gracias al UNIQUE(idUsuario)).
async function activarFisio(conn, idUsuario) {
    await conn.execute(
        `INSERT INTO fisioterapeuta (idUsuario, fechaAsignacion, fechaBaja)
         VALUES (?, CURDATE(), NULL)
         ON DUPLICATE KEY UPDATE fechaBaja = NULL, fechaAsignacion = CURDATE()`,
        [idUsuario]
    );
}
async function activarAdmin(conn, idUsuario) {
    await conn.execute(
        `INSERT INTO administrador (idUsuario, fechaAsignacion, fechaBaja)
         VALUES (?, CURDATE(), NULL)
         ON DUPLICATE KEY UPDATE fechaBaja = NULL, fechaAsignacion = CURDATE()`,
        [idUsuario]
    );
}
async function desactivarFisio(conn, idUsuario) {
    await conn.execute('UPDATE fisioterapeuta SET fechaBaja = CURDATE() WHERE idUsuario = ? AND fechaBaja IS NULL', [idUsuario]);
}
async function desactivarAdmin(conn, idUsuario) {
    await conn.execute('UPDATE administrador SET fechaBaja = CURDATE() WHERE idUsuario = ? AND fechaBaja IS NULL', [idUsuario]);
}
// Da de baja las inscripciones vigentes del fisio a grupos.
async function bajaGruposDeFisio(conn, idUsuario) {
    await conn.execute(
        `UPDATE grupofisioterapeuta SET fechaBaja = CURDATE()
         WHERE fechaBaja IS NULL
           AND idFisio = (SELECT id FROM fisioterapeuta WHERE idUsuario = ?)`,
        [idUsuario]
    );
}
async function contarAdminsActivos(conn) {
    const [rows] = await conn.execute('SELECT COUNT(*) AS n FROM administrador WHERE fechaBaja IS NULL');
    return rows[0].n;
}
async function esAdminActivo(conn, idUsuario) {
    const [rows] = await conn.execute('SELECT 1 FROM administrador WHERE idUsuario = ? AND fechaBaja IS NULL LIMIT 1', [idUsuario]);
    return rows.length > 0;
}
async function esFisioActivo(conn, idUsuario) {
    const [rows] = await conn.execute('SELECT 1 FROM fisioterapeuta WHERE idUsuario = ? AND fechaBaja IS NULL LIMIT 1', [idUsuario]);
    return rows.length > 0;
}

// ---- Endpoints ----

async function getUsuarios(req, res) {
    try {
        const incluirBajas = req.query.incluirBajas === '1' || req.query.incluirBajas === 'true';
        const whereActivos = incluirBajas ? '' : 'WHERE u.fechaBaja IS NULL';

        const [rows] = await db.execute(
            `SELECT u.id, u.nomyap, u.cedula, u.gmail, u.telefono,
                DATE_FORMAT(u.fechaNacimiento, '%Y-%m-%d') AS fechaNacimiento,
                u.fechaBaja,
                EXISTS(SELECT 1 FROM fisioterapeuta f WHERE f.idUsuario = u.id AND f.fechaBaja IS NULL) AS esFisio,
                EXISTS(SELECT 1 FROM administrador a WHERE a.idUsuario = u.id AND a.fechaBaja IS NULL) AS esAdmin
             FROM usuario u
             ${whereActivos}
             ORDER BY u.nomyap ASC`
        );

        const usuarios = rows.map(u => ({
            ...u,
            activo: u.fechaBaja === null,
            esFisio: !!u.esFisio,
            esAdmin: !!u.esAdmin
        }));

        res.status(200).json({ usuarios });
    } catch (error) {
        logger.error('Error al obtener usuarios:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al obtener usuarios.' });
    }
}

async function crearUsuario(req, res) {
    const { nomyap, cedula, gmail, telefono, fechaNacimiento, esFisio, esAdmin } = req.body;

    if (!nomyap || !nomyap.trim()) {
        return res.status(400).json({ message: 'El nombre y apellido es requerido.' });
    }
    if (!cedula || !isValidCedula(String(cedula))) {
        return res.status(400).json({ message: 'La cédula es requerida y debe tener 7 u 8 dígitos.' });
    }

    const ced = String(cedula).trim();
    const conn = await db.getConnection();
    try {
        const [dup] = await conn.execute('SELECT id FROM usuario WHERE cedula = ?', [ced]);
        if (dup.length > 0) {
            return res.status(409).json({ message: 'Ya existe un usuario con esa cédula.' });
        }

        // Contraseña inicial automática: "!" + cédula.
        const passwordHash = await bcrypt.hash('!' + ced, 10);

        await conn.beginTransaction();
        const [ins] = await conn.execute(
            `INSERT INTO usuario (nomyap, cedula, gmail, telefono, fechaNacimiento, passwordUser, fechaCreacion)
             VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
            [nomyap.trim(), ced, gmail || null, telefono || null, fechaNacimiento || null, passwordHash]
        );
        const idUsuario = ins.insertId;

        if (esFisio) await activarFisio(conn, idUsuario);
        if (esAdmin) await activarAdmin(conn, idUsuario);

        await conn.commit();
        res.status(201).json({ message: 'Usuario creado exitosamente.', id: idUsuario });
    } catch (error) {
        await conn.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ya existe un usuario con esa cédula.' });
        }
        logger.error('Error al crear usuario:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al crear usuario.' });
    } finally {
        conn.release();
    }
}

async function actualizarUsuario(req, res) {
    const id = parseInt(req.params.id, 10);
    const { nomyap, cedula, gmail, telefono, fechaNacimiento, esFisio, esAdmin } = req.body;
    const solicitante = parseInt(req.user.idUsuario, 10);

    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }
    if (!nomyap || !nomyap.trim()) {
        return res.status(400).json({ message: 'El nombre y apellido es requerido.' });
    }
    if (!cedula || !isValidCedula(String(cedula))) {
        return res.status(400).json({ message: 'La cédula es requerida y debe tener 7 u 8 dígitos.' });
    }

    const ced = String(cedula).trim();
    const conn = await db.getConnection();
    try {
        const [existe] = await conn.execute('SELECT id FROM usuario WHERE id = ? AND fechaBaja IS NULL', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const [dup] = await conn.execute('SELECT id FROM usuario WHERE cedula = ? AND id <> ?', [ced, id]);
        if (dup.length > 0) {
            return res.status(409).json({ message: 'Ya existe otro usuario con esa cédula.' });
        }

        const eraFisio = await esFisioActivo(conn, id);
        const eraAdmin = await esAdminActivo(conn, id);
        const quiereFisio = !!esFisio;
        const quiereAdmin = !!esAdmin;

        // Salvaguardas anti-lockout al quitar admin.
        if (eraAdmin && !quiereAdmin) {
            if (id === solicitante) {
                return res.status(400).json({ message: 'No podés quitarte tu propio rol de administrador.' });
            }
            if ((await contarAdminsActivos(conn)) <= 1) {
                return res.status(400).json({ message: 'No podés dejar el sistema sin administradores.' });
            }
        }

        // Quitar rol fisio estando en grupos vigentes: requiere confirmación (force).
        if (eraFisio && !quiereFisio) {
            const grupos = await gruposVigentes(conn, id);
            if (grupos.length > 0 && !esForce(req)) {
                return res.status(409).json({
                    enGrupos: true,
                    cantidad: grupos.length,
                    message: `El fisioterapeuta está en ${grupos.length} grupo(s) vigente(s).`
                });
            }
        }

        await conn.beginTransaction();

        await conn.execute(
            `UPDATE usuario SET nomyap = ?, cedula = ?, gmail = ?, telefono = ?, fechaNacimiento = ?
             WHERE id = ?`,
            [nomyap.trim(), ced, gmail || null, telefono || null, fechaNacimiento || null, id]
        );

        // Rol fisio
        if (quiereFisio && !eraFisio) {
            await activarFisio(conn, id);
        } else if (!quiereFisio && eraFisio) {
            await bajaGruposDeFisio(conn, id);
            await desactivarFisio(conn, id);
        }

        // Rol admin
        if (quiereAdmin && !eraAdmin) {
            await activarAdmin(conn, id);
        } else if (!quiereAdmin && eraAdmin) {
            await desactivarAdmin(conn, id);
        }

        await conn.commit();
        res.status(200).json({ message: 'Usuario actualizado exitosamente.' });
    } catch (error) {
        await conn.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ya existe otro usuario con esa cédula.' });
        }
        logger.error('Error al actualizar usuario:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al actualizar usuario.' });
    } finally {
        conn.release();
    }
}

async function bajaUsuario(req, res) {
    const id = parseInt(req.params.id, 10);
    const solicitante = parseInt(req.user.idUsuario, 10);

    if (isNaN(id)) {
        return res.status(400).json({ message: 'ID de usuario inválido.' });
    }
    if (id === solicitante) {
        return res.status(400).json({ message: 'No podés darte de baja a vos mismo.' });
    }

    const conn = await db.getConnection();
    try {
        const [existe] = await conn.execute('SELECT id FROM usuario WHERE id = ? AND fechaBaja IS NULL', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado o ya dado de baja.' });
        }

        // No dejar el sistema sin administradores.
        if (await esAdminActivo(conn, id) && (await contarAdminsActivos(conn)) <= 1) {
            return res.status(400).json({ message: 'No podés dar de baja al único administrador activo.' });
        }

        // Si es fisio y está en grupos vigentes, requiere confirmación (force).
        const grupos = await gruposVigentes(conn, id);
        if (grupos.length > 0 && !esForce(req)) {
            return res.status(409).json({
                enGrupos: true,
                cantidad: grupos.length,
                message: `El fisioterapeuta está en ${grupos.length} grupo(s) vigente(s). ¿Darlo de baja igual?`
            });
        }

        await conn.beginTransaction();
        // Baja en cascada: grupos vigentes del fisio + rol fisio + rol admin + usuario.
        await bajaGruposDeFisio(conn, id);
        await desactivarFisio(conn, id);
        await desactivarAdmin(conn, id);
        await conn.execute('UPDATE usuario SET fechaBaja = CURDATE() WHERE id = ?', [id]);
        await conn.commit();

        res.status(200).json({ message: 'Usuario dado de baja exitosamente.' });
    } catch (error) {
        await conn.rollback();
        logger.error('Error al dar de baja usuario:', error.message);
        logger.error(error.stack);
        res.status(500).json({ message: 'Error interno del servidor al dar de baja usuario.' });
    } finally {
        conn.release();
    }
}

module.exports = {
    getUsuarios,
    crearUsuario,
    actualizarUsuario,
    bajaUsuario
};
