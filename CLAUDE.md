# CLAUDE.md — gestionFisioterapia

Sistema de gestión para un centro de fisioterapia/kinesiología: pacientes, agenda
de horarios grupales, sesiones (calendario), cuotas mensuales y balance.

## Stack

- **Backend**: Node.js + Express (`backend/`). MySQL/MariaDB vía `mysql2/promise`
  (pool en `backend/src/db.js`). Auth con JWT (`jsonwebtoken`) + `bcryptjs`.
  Logs con `winston` (`backend/plugins/logger.plugin.js`). Crons en `backend/src/cron/`.
- **Frontend**: HTML + JS vanilla como **módulos ES** (`frontend/js/*.js`), Bootstrap 5.
  El backend sirve el frontend estático y hace fallback SPA a `index.html`.
- **DB**: base `kinesis` en MySQL local. Node fijado por `.nvmrc`.

## Cómo ejecutar

```bash
cd backend
npm install
npm run dev      # nodemon (recarga en caliente); o `npm start` para node plano
```

- Servidor: `http://localhost:3000` (`PORT` del `.env`, default 3000). Sirve API y frontend.
- **Configuración por entorno (unificada, sin editar código):** toda la config va en
  `backend/.env`. Plantilla versionada en `backend/.env.example` — copiar a `.env` y
  completar valores (`cp .env.example .env`). Mismas variables en dev y prod, cambiando
  sólo los valores. Variables: `NODE_ENV` (development|production), `PORT`,
  `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/DB_PORT`, `JWT_SECRET`, `TWILIO_*`.
  - `server.js` carga el `.env` por ruta absoluta (`path.join(__dirname,'..','.env')`),
    así funciona igual con `nodemon`, `node` directo o en producción (no depende del cwd).
  - Con `NODE_ENV=production` se silencian los logs de depuración de conexión.
  - En producción, `PORT` (p.ej. 50001) y demás valores se definen en el `.env` (o como
    variables del sistema, que tienen prioridad sobre el archivo).
- **Frontend (`frontend/js/config.js`):** el `API_BASE_URL` se resuelve automáticamente:
  `localhost/127.0.0.1` → `http://localhost:3000`; cualquier otro host → `window.location.origin`
  (mismo origen que sirve el frontend, sin dominio/puerto hardcodeado). Se puede forzar con
  `window.__API_BASE_URL__`.
- **Redirect de producción (`frontend/index.html`):** un `<script>` en el `<head>`
  replica el comportamiento original: si `window.location.port !== '50001'` redirige a
  `http://centrokinesis.uy:50001`. Es dev-safe: en `localhost/127.0.0.1/file://` no hace
  nada. Cambiar la URL/puerto en ese `<script>` si cambia el destino de producción.
  Ojo: es distinto de `API_BASE_URL` (uno redirige el navegador, el otro dirige los fetch).
- `backend/hash.password.js` genera hashes bcrypt; la contraseña se pasa por argumento
  (`node hash.password.js <password>`) o `PASSWORD_TO_HASH` (sin credenciales hardcodeadas).
- No hay tests automatizados en `package.json` (`npm test` es un stub).

## Modelo de datos (tablas principales de `kinesis`)

- **paciente**: `id` (AI), `nomyap`, `cedula` (UNIQUE, 8 dígitos), `gmail`, `telefono`
  (formato `+598...`), `fechaNacimiento`, `fechaCreacion`, `activo` (0/1), `genero`
  (`M`/`F`/`O`), `recibirSMS`, `fechaBaja`. Baja lógica = `fechaBaja` NOT NULL.
- **usuario** / **fisioterapeuta** / **administrador**: usuarios del sistema; un
  fisio/admin referencia `idUsuario`. Fisios activos: id 1 (ALEJO ARAUJO) y 2 (PABLO MEDINA).
  El usuario id 1 es administrador.
  - **Baja de fisio**: un fisio está de baja si `fisioterapeuta.fechaBaja` **o** `usuario.fechaBaja`
    NOT NULL. `getAllFisios` (fuente de todos los `select[id^="selectFisios"]`: sesión, estadísticas,
    agregar a grupo) filtra ambas, así que un fisio de baja **no aparece** para asignar. La agenda
    tampoco lo lista en los grupos (`agendaController` filtra `f.fechaBaja`/`u.fechaBaja` en el JOIN).
    Al asignar un fisio (a grupo o a sesión) el backend valida `fisioActivo(idFisio)` (defensa aunque
    el dropdown ya no lo muestre). El **histórico de sesiones sí muestra** el nombre del fisio de baja
    (calendarioController usa JOIN sin filtro de baja, a propósito). No hay ABM de fisios: la baja se
    hace por SQL (setear `fechaBaja`); conviene además dar de baja sus `grupofisioterapeuta` activos.
  - **ABM de usuarios** (solo admin): `/api/usuarios` (`usuariosController.js`/`usuariosRoutes.js`),
    `GET` (lista con `esFisio`/`esAdmin`/`activo`), `POST` (alta: contraseña inicial automática
    **`"!" + cedula`** hasheada; roles vía flags `esFisio`/`esAdmin`), `PUT /:id` (datos + toggle de
    roles; activar rol = `INSERT ... ON DUPLICATE KEY UPDATE fechaBaja=NULL` por el `UNIQUE(idUsuario)`),
    `DELETE /:id` (baja). La baja de un fisio con `grupofisioterapeuta` vigentes responde **409
    `{enGrupos, cantidad}`** salvo `?force=1`, que da de baja en cascada (grupos + fisio + admin +
    usuario) en transacción. Salvaguardas anti-lockout: no auto-baja, no quitarse el propio admin, no
    dejar el sistema sin admins. Frontend: vista `#divUsuarios` (`usuarios.js`) desde el menú **Otros**.
  - **Auth extra**: `GET /api/auth/me` → `{idUsuario, nomyap, cedula, esFisio, esAdmin}` (alimenta el
    menú de perfil arriba a la derecha: `perfil.js`). `PUT /api/auth/password` → cambio de contraseña
    self-service para cualquier usuario logueado (verifica la actual con `bcrypt.compare`).
  - **Menú de perfil** (navbar, `perfil.js`): icono `bi-person-circle` + nombre; opciones "Cambiar
    contraseña" y "Cerrar sesión" para todos. "Administrar usuarios" (`#liAdministrarUsuarios`) vive en
    el dropdown **"Otros"** de la navbar y `perfil.js` lo muestra solo a admins (se decide con
    `/api/auth/me`).
- **grupo**: horario recurrente. **PK compuesta** `(diaSemana, horaInicio, horaFin)`.
  `diaSemana` válido: Lunes..Sabado (sin Domingo). Baja lógica con `fechaBaja`.
- **grupopaciente** / **grupofisioterapeuta**: inscripción de paciente/fisio a un grupo.
  PK = (idPaciente|idFisio, diaSemana, horaInicio, horaFin). Baja lógica con `fechaBaja`.
- **sesion**: **PK compuesta `(fecha, horaInicio, horaFin)`** — sólo una sesión por
  franja horaria en toda la agenda. Campos `idFisio`, `idPaciente`, `monto`, etc.
- **cuota**: **PK `(idPaciente, mes, anio)`**. `monto` (tarifa base), `montoDescuento`
  (monto realmente cobrado), `descuento` (%), `fechaPago`, `metodoPago`, `fechaBaja`.
- **tarifagrupo**: `cantidadDias` (1..5) -> `monto`, con vigencia `fechaDesde/fechaHasta`.
  **PK compuesta `(cantidadDias, fechaDesde)`** (migración `backend/sql/2026-09-21_tarifa_vigencia.sql`):
  admite historial de tarifas por cantidad de días. La tarifa **vigente** es la fila con
  `fechaHasta IS NULL` (rango abierto); las históricas tienen `fechaHasta`. Regla: para una
  misma `cantidadDias` sólo puede haber UNA tarifa vigente por rango (los rangos no se solapan).
  Toda selección de tarifa (generación de cuota, recálculo, `getMonto`) filtra por vigencia
  usando como referencia el **1° del mes de la cuota**
  (`DATE_FORMAT(CURDATE(),'%Y-%m-01') BETWEEN fechaDesde AND IFNULL(fechaHasta,'9999-12-31')`).
  El alta de tarifa usa `CALL sp_nueva_tarifa(cantidadDias, monto, fechaDesde)`, que cierra la
  vigente e inserta la nueva atómicamente (con guarda anti-solapamiento). Convención: `fechaDesde`
  = 1° de mes. Tarifas actuales: 1→1500, 2→2600, 3→3300, 4→4000, 5→5500.
  - **CRUD**: `/api/tarifas` (admin) — `tarifasController.js` / `tarifasRoutes.js`. `GET /` (historial con
    estado Vigente/Programada/Historica), `GET /vigentes`, `POST /` (alta vía SP), `PUT /` (corrige sólo el
    `monto` de una fila, identificada por PK), `DELETE /` (borra sólo la tarifa más reciente de una
    `cantidadDias` y reabre la anterior; las históricas no se borran). Frontend: `frontend/js/tarifas.js`,
    vista `#divTarifas` en el menú **Facturación → Tarifas**.
- **diagnostico** / **nombrediagnostico**: diagnósticos por paciente.
- **view_cuota_estado** (VIEW sobre `cuota`): agrega columna `estado`:
  `Cancelada` (fechaBaja), `Pagada` (fechaPago), `Pendiente` (mes actual y día < 25),
  `Atrasada` (mes pasado, o mes actual con día >= 25). El día 25 del mes es el corte.

## Convenciones importantes / gotchas

- **Meses estilo JS (0-11) en el frontend**: el frontend envía `mes` como 0-11 y el
  backend suma `+1` para consultar MySQL (`MONTH()` es 1-12). Al escribir/consultar
  endpoints de calendario, respetar esa convención (`mesNum + 1`).
- **Zona horaria al parsear fechas `YYYY-MM-DD`**: `new Date('2026-09-01')` se parsea
  como UTC medianoche; en Uruguay (UTC-3) `getMonth()` (local) devuelve el mes anterior
  (agosto). No usar `new Date(str).getMonth()` para derivar el mes de un string de fecha;
  partir el string en componentes (`str.split('-')`) o usar `getUTCMonth()`. (Fue el bug
  del balance en `generarBalance`.)
- **Bajas lógicas, no borrado físico**: pacientes, grupos y cuotas usan `fechaBaja`.
  Toda query de listado debe filtrar `fechaBaja IS NULL` (incluidos los COUNT de paginación).
- **`db.execute` (UPDATE/DELETE)**: usar `result.affectedRows` para saber si afectó filas;
  `result.insertId` sólo tiene sentido en INSERT (vale 0 en UPDATE).
- **Códigos HTTP**: 201 sólo para creación real; 200 para update/delete/consulta.
- **Validaciones con falsy**: cuidado con `!valor` cuando `0` es válido (montos, descuentos).
- **Frontend seguro**: insertar texto dinámico con `textContent`/DOM API, nunca por
  `innerHTML` con interpolación (riesgo XSS). No depender de "variables globales por id"
  del navegador; usar `document.getElementById`.
- **Auth**: rutas protegidas con `authenticateToken`; las de cuotas además con
  `authorizeAdmin`. El JWT payload lleva `{ idUsuario, cedula }`.

## Verificar cambios contra la app en local

- Levantar el server (`npm run dev`) y golpear los endpoints con un token JWT firmado
  con el `JWT_SECRET` del `.env` (payload `{ idUsuario:1, cedula:'54444050' }` = admin).
- Para lógica de frontend aislada, se pueden extraer funciones y correrlas bajo `jsdom`
  (ya es dependencia del backend).
- Para scripts Node sueltos fuera de `backend/`, usar
  `NODE_PATH=backend/node_modules` para resolver `mysql2`, `jsonwebtoken`, etc.

## Estructura

```
backend/
  src/
    server.js            # bootstrap Express, monta rutas, sirve frontend
    db.js                # pool mysql2
    controllers/         # pacientes, auth, agenda, calendario, cuotas, diagnosticos, ...
    routes/              # una ruta por dominio
    middelwares/         # authMiddelware (authenticateToken, authorizeAdmin), multer
    cron/                # tareas del 1° de mes (generación de cuotas)
  plugins/logger.plugin.js
frontend/
  index.html
  js/                    # módulos ES: pacientes, agenda, calendario, cuota, ui, login, ...
    selectorPaciente.js  # componente ÚNICO "Seleccionar Paciente" reutilizable
```

- **Sistema de diseño (`frontend/styles.css`):** paleta por tokens en `:root` —
  **primitivos** (`--c-brand #223D52` marca, `--c-accent #2563C9` acción, grises, estados)
  → **semánticos** que los referencian. Para retocar el look se cambian los primitivos.
  Solo modo claro (el modo oscuro se implementó y luego se quitó a pedido del cliente).

- **Selector de paciente unificado (`frontend/js/selectorPaciente.js`):** un solo modal
  (`#modalSeleccionarPaciente`) reemplaza a los 4 pickers duplicados. Se abre con
  `abrirSelectorPaciente({ titulo, textoBoton, onSelect })` — `onSelect(paciente)` recibe
  `{ id, nombre, cedula }` — y se cierra con `cerrarSelectorPaciente()`. La tabla usa el
  motor compartido `inicializarPatientTable`/`renderPacientesTable` de `pacientes.js`.

## Historial

- 2026-08-30: corregidos 14 bugs (ver `Desktop/archivos_modificados_gestionFisioterapia.txt`)
  y cargados ~300 pacientes de prueba en `kinesis` (cédulas 61000000-61000299).
