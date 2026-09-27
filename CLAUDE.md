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
    `DELETE /:id` (baja). **Reactivación**: si el `POST` trae la cédula de un usuario **dado de
    baja**, no se crea otro: se hace `UPDATE` de ese registro con `fechaBaja = NULL`, los datos del
    formulario, la contraseña inicial `"!" + cedula` y los roles según `esFisio`/`esAdmin` (200,
    `{ reactivado: true }`). Si la cédula es de un usuario activo → 409. **Rol obligatorio**: alta,
    reactivación y modificación exigen al menos un rol (`esFisio` y/o `esAdmin`), si no → 400.
    La baja de un fisio con `grupofisioterapeuta` vigentes responde **409
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
  `diaSemana` válido: Lunes..Sabado (sin Domingo; `isValidDiaSemana` es **síncrona**, si fuera
  async devolvería una Promise y nunca bloquearía). `horaInicio < horaFin`. Baja lógica con
  `fechaBaja`; `GET /api/agenda/horario` de un grupo dado de baja responde 404.
- **grupopaciente** / **grupofisioterapeuta**: inscripción de paciente/fisio a un grupo.
  PK = (idPaciente|idFisio, diaSemana, horaInicio, horaFin). Baja lógica con `fechaBaja`.
  Sólo se puede inscribir en grupos vigentes (404 si el grupo no existe o fue eliminado) y sólo
  pacientes no dados de baja. Sacar de un grupo a alguien que no está inscripto → 404.
- **sesion**: **PK compuesta `(fecha, horaInicio, horaFin)`** — sólo una sesión por
  franja horaria en toda la agenda. Campos `idFisio`, `idPaciente`, `monto`, etc.
  Fecha calendario real (rechaza `2026-02-30`), paciente activo, y un mismo paciente no puede
  tener dos sesiones solapadas el mismo día (409). Modificar una sesión no cambia su fecha.
- **cuota**: **PK `(idPaciente, mes, anio)`**. `monto` (tarifa base), `montoDescuento`
  (monto realmente cobrado), `descuento` (%), `fechaPago`, `metodoPago`, `fechaBaja`.
  - **Cuota del mes y grupos** (`backend/src/utils/cuotas.js` → `generarCuotaDelMesSiCorresponde`,
    usado al inscribir en un grupo y en `restaurarGrupos`): los grupos **sólo generan** la cuota
    cuando el paciente **no tiene ninguna cuota de ese mes** (en ningún estado) y el día es **menor
    a 25**; se crea con la tarifa vigente para su cantidad de grupos. **Una vez dada de alta, la
    cuota del mes no se modifica por cambios de grupos** (agregar, sacar o restaurar no tocan monto,
    pago ni estado; sacar del último grupo tampoco la cancela).
  - **Registrar pago**: 404 si la cuota no existe, 409 si está cancelada; `descuento` entero 0..100
    (0 es válido), `montoDescuento` entre 0 y `monto`, `fechaPago` fecha real, descripción admite
    tildes/ñ. Alta manual de cuota: mes 1..12, montos ≥ 0, paciente activo.
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
  = 1° de mes (el backend rechaza otra fecha de inicio). Tarifas actuales: 1→1500, 2→2600,
  3→3300, 4→4000, 5→5500. No se puede borrar la **única** tarifa de una `cantidadDias` (409).
  - **CRUD**: `/api/tarifas` (admin) — `tarifasController.js` / `tarifasRoutes.js`. `GET /` (historial con
    estado Vigente/Programada/Historica), `GET /vigentes`, `POST /` (alta vía SP), `PUT /` (corrige sólo el
    `monto` de una fila, identificada por PK), `DELETE /` (borra sólo la tarifa más reciente de una
    `cantidadDias` y reabre la anterior; las históricas no se borran). Frontend: `frontend/js/tarifas.js`,
    vista `#divTarifas` en el menú **Facturación → Tarifas**.
- **diagnostico** / **nombrediagnostico**: diagnósticos por paciente. Alta y modificación del
  nombre usan la misma validación (`isValidNombre`, sin HTML); la ficha además lo escapa al
  renderizar. Un paciente no puede tener dos veces el mismo diagnóstico (409).
- **paciente**: `genero` ∈ {M, F, O}; `fechaCreacion` la pone el servidor. La **baja** se bloquea
  si está en algún grupo o tiene sesiones **de hoy en adelante** (las pasadas son historial).
  **Reactivación**: si el alta trae la cédula de un paciente **dado de baja**, no se crea otro: se
  hace `UPDATE` de ese registro con `fechaBaja = NULL` y los datos del formulario (conserva
  `fechaCreacion`, historia clínica, cuotas y sesiones; queda `activo = 0` hasta inscribirlo en un
  grupo). Responde 200 `{ reactivado: true }` y no pasa por la advertencia de nombres similares.
  Cédula de un paciente activo → 409. Mismo criterio que la reactivación de usuarios.
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
  `authorizeAdmin`. El JWT payload lleva `{ idUsuario, cedula }`. `authenticateToken` además
  consulta la base en cada request: si el usuario fue dado de baja responde **401** aunque el
  token no haya vencido.
- **Errores en controllers**: todos los handlers de rutas van envueltos en `asyncHandler`
  (`middelwares/asyncHandler.js`); una excepción no atrapada llega al manejador global de
  `server.js` (500 JSON) en vez de tumbar el proceso (Express 4 no captura errores async y el
  `unhandledRejection` hace `process.exit(1)`). Validadores: usar `utils/validaciones.js`
  (toleran cualquier tipo: un número en vez de string debe dar 400, no excepción).
  JSON malformado → 400; ruta `/api/...` inexistente → 404 JSON.
- **Paginación**: `limit` se acota a 500 (pacientes y cuotas).

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
    middelwares/         # authMiddelware (authenticateToken, authorizeAdmin), asyncHandler
    utils/               # validaciones.js (fechas, email, teléfono), cuotas.js (cuota del mes)
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

## Pendientes conocidos (decididos, todavía NO implementar)

- **Usuario sin rol (datos viejos)**: desde 2026-09-26 no se puede crear ni dejar un usuario sin
  rol, pero los que ya existían así (hoy JUAN ANDRADA, id 4) siguen pudiendo loguearse y usar lo
  clínico hasta que se les asigne un rol o se los dé de baja.
- **Logs**: `crearLogger` (`plugins/logger.plugin.js`) acepta un solo argumento, así que en
  `logger.error('texto:', error.message)` la causa se pierde; además varios controllers usan un
  nombre de servicio equivocado. Usar template strings mientras tanto.
- **Crons**: los scripts de `cron/` no cierran el pool y el proceso no termina solo; el orden entre
  generación de cuotas y baja por deuda importa. Se maneja desde el hosting.
- Por diseño (confirmado): borrar un nombre de diagnóstico borra los diagnósticos de pacientes dados
  de baja; corregir el monto de una tarifa reclasifica el balance histórico (cruza por monto); el
  contador de pacientes muestra las filas de la página; el selector de pacientes filtra "Activos";
  la tarifa se elige por cantidad de **grupos** (en producción nadie está en dos grupos el mismo
  día); se permiten grupos superpuestos; una sola sesión por franja horaria no es un problema;
  MariaDB queda sin `STRICT_TRANS_TABLES` (las validaciones están en el backend).

## Historial

- 2026-08-30: corregidos 14 bugs (ver `Desktop/archivos_modificados_gestionFisioterapia.txt`)
  y cargados ~300 pacientes de prueba en `kinesis` (cédulas 61000000-61000299).
- 2026-09-26: test integral (API + UI) y corrección de los hallazgos: caída del server por tipos
  inesperados, cuota pagada cancelada/borrada al sacar/reinscribir en grupos, XSS en nombre de
  diagnóstico, "Cancelar" que igual ejecutaba en la agenda, baja de paciente con condición de
  sesiones invertida, validación de día de semana, token de usuario dado de baja, validaciones
  de pagos/cuotas/tarifas/sesiones/usuarios, calendario el día 1, año por defecto en Cuotas.
