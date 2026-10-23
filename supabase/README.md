# Backend de reservas — JC Barber

## Entrega y aplicación

Migración: [`migrations/202610190001_booking_backend.sql`](migrations/202610190001_booking_backend.sql).

Complemento (aplicar después):
[`migrations/202610200001_admin_handover.sql`](migrations/202610200001_admin_handover.sql).
Agrega la transferencia segura, sin modificar reservas ni configuración existentes.

Actualización comercial histórica del 2026-10-21 (tercera migración):
[`migrations/202610210001_customer_services.sql`](migrations/202610210001_customer_services.sql).
Carga corte general $18.000, barba $10.000 y cejas $8.000 (local, 30 min),
corte a domicilio $20.000 (45 min). Sustituye las franjas por 09:00–12:30 y
16:30–20:30 en ambas modalidades. Desactiva los servicios anteriores sin borrarlos,
conserva los comprobantes/reservas y el estado habilitado por día/modalidad.
Ejecutar una sola vez; no activa la agenda ni cambia descanso/traslado.

Actualización de domicilio del 2026-10-22 (cuarta migración):
[`migrations/202610220001_home_service_price.sql`](migrations/202610220001_home_service_price.sql).
Actualiza únicamente el precio de `Corte a domicilio`, modalidad exclusiva `home`,
de $20.000 a **$30.000**, dentro de una transacción y bajo `jc_private.lock_agenda()`.
Las reservas anteriores conservan su precio y snapshot originales; las nuevas usan
el precio actualizado. No cambia duración, activación, franjas, descanso ni traslados.

Precios vigentes confirmados por el propietario:

| Servicio | Modalidad | Precio | Duración |
| --- | --- | --- | --- |
| Corte general | Local | $18.000 | 30 min |
| Barba | Local | $10.000 | 30 min |
| Perfilado de cejas | Local | $8.000 | 30 min |
| Corte a domicilio (incluye barba y perfilado de cejas) | Domicilio | $30.000 | 45 min |

Aplicar cada migración **una sola vez**, en orden, con el propietario de migraciones `postgres` de Supabase (capacidad `BYPASSRLS`). Son transaccionales y requieren PostgreSQL 15 o posterior. No requieren extensiones: GiST para `tstzrange` y `gen_random_uuid()` están incluidos en PostgreSQL. Pueden ejecutarse desde SQL Editor o con el flujo de migraciones del proyecto Supabase. Si las tres primeras ya están aplicadas, ejecutar únicamente la cuarta.

Con `psql` y una conexión administrativa configurada en `PGDATABASE`:

```powershell
psql -X -v ON_ERROR_STOP=1 -f "supabase/migrations/202610190001_booking_backend.sql"
psql -X -v ON_ERROR_STOP=1 -f "supabase/migrations/202610200001_admin_handover.sql"
psql -X -v ON_ERROR_STOP=1 -f "supabase/migrations/202610210001_customer_services.sql"
psql -X -v ON_ERROR_STOP=1 -f "supabase/migrations/202610220001_home_service_price.sql"
```

No ejecutar `tests/bootstrap-local.sql` en Supabase: sólo emula roles/Auth para una base PostgreSQL vacía y descartable.

### Primer administrador

1. Crear el usuario en Supabase Auth y obtener su UUID.
2. En SQL Editor, como `postgres`, incorporarlo a la lista privada:

```sql
insert into jc_private.authorized_admins(user_id)
values ('UUID-REAL-DE-AUTH'::uuid)
on conflict (user_id) do nothing;
```

La autorización compara `auth.uid()` con esa lista en **cada RPC administrativa**. No se usa email, metadata editable ni el mero hecho de tener sesión. Para revocar acceso:

```sql
delete from jc_private.authorized_admins where user_id = 'UUID-REAL-DE-AUTH'::uuid;
```

La administración del allowlist es exclusiva de una conexión SQL confiable. Los administradores del panel tampoco tienen acceso directo a tablas.

### Transferencia de administración

Procedimiento completo con invitación, recuperación y entrega de infraestructura:
[`docs/RESERVAS.md`, secciones 8–10](../docs/RESERVAS.md#9-transferir-la-administración-al-peluquero).

- `jc_private.prepare_handover(source_uuid, target_uuid)`: sólo el propietario SQL.
  Verifica emisor autorizado y destinatario existente en Auth; agrega al destinatario
  y crea una preparación única. Rechaza otra preparación mientras haya una pendiente.
- `public.admin_confirm_handover(p_data jsonb)`: requiere authenticated + allowlist
  y que `auth.uid()` coincida con el destinatario pendiente. `p_data` es `{}`; no
  acepta identidad aportada por el cliente como autoridad. Registra `confirmed_at`.
- `jc_private.complete_handover(target_uuid)`: sólo el propietario SQL. Exige
  confirmación posterior a la preparación y de menos de 24 horas. Elimina todos
  los demás UUID de `authorized_admins` y marca completada la transferencia.
- Las tres escrituras usan `lock_agenda()` y READ COMMITTED como las reservas.
  RLS forzada y privilegios revocados en `jc_private.admin_handover`. No se exponen
  correos, UUID ajenos ni estados de transferencia al público.
- Cada RPC administrativa sigue verificando allowlist en servidor, incluso con
  un JWT emitido antes de la revocación. Para mutaciones, la comprobación ocurre
  después de tomar el lock. La tabla conserva la última entrega; guardar evidencia
  desde una conexión confiable antes de preparar una nueva o borrar un usuario Auth.

### Estado inicial y activación

- Singleton: `enabled=false`, timezone fija `America/Argentina/Buenos_Aires`, `slot_step_minutes=15`, `horizon_days=90`.
- `break_minutes`, `travel_before_minutes`, `travel_after_minutes`: **NULL**, no cero supuesto.
- Tras la tercera migración: cuatro servicios con precio/duración confirmados; servicio inicial conservado e inactivo.
- Tras la cuarta migración: domicilio a $30.000; los otros tres precios permanecen iguales.
- **28 franjas deshabilitadas**: cuatro por cada día 0–6, sin afirmar días de atención:
  - domicilio y local: `09:00–12:30` y `16:30–20:30`.

Para activar, enviar `admin_save_config` con servicios activos completos, al menos una franja habilitada y todos los minutos de descanso/traslado definidos. Domicilio requiere ambos traslados **mayores a cero** cuando haya servicios activos o franjas habilitadas de esa modalidad. Configuración incompleta puede guardarse con `enabled=false`. Un administrador puede consultar slots y crear turnos de prueba con la agenda desactivada **si la configuración está completa**; esas reservas son reales y ocupan la agenda.

## Contrato RPC para el frontend

Nombres y parámetros coinciden con el encargo; **no hay desviaciones de nombres, firmas ni JSON solicitado**. Todas las funciones públicas son `SECURITY DEFINER` y tienen `search_path=pg_catalog`; los objetos privados siempre están calificados por esquema. Las funciones temporales o de un usuario no pueden sustituir dependencias.

| RPC | Acceso | Retorno |
| --- | --- | --- |
| `public_catalog()` | anon / authenticated | Objeto JSON descrito abajo |
| `available_slots(p_service uuid, p_mode text, p_date date)` | anon / authenticated | Filas; PostgREST entrega un array |
| `create_booking(p_data jsonb)` | anon / authenticated | Comprobante JSON sin PII |
| `admin_snapshot(p_from date, p_to date)` | authenticated + allowlist | Snapshot JSON administrativo |
| `admin_save_config(p_data jsonb)` | authenticated + allowlist | `{"success":true}` |
| `admin_booking(p_data jsonb)` | authenticated + allowlist | Comprobante actualizado, con su estado real |
| `admin_block(p_data jsonb)` | authenticated + allowlist | `{"success":true,"id":"uuid"}` |
| `admin_confirm_handover(p_data jsonb)` | authenticated + allowlist + destinatario | `{"success":true}` |

### Catálogo y disponibilidad

```text
public_catalog() -> {
  enabled, timezone, horizon_days,
  services: [{id, name, price, duration_minutes, modes: ['local','home'], active}]
}
available_slots(...) -> [{starts_at, ends_at, price, duration_minutes}]
```

`modes` contiene las modalidades del servicio; puede ser sólo `['local']` o sólo `['home']`. El catálogo público entrega servicios válidos activos únicamente si `enabled=true`; desactivado devuelve `services:[]`. No expone franjas internas, razones de bloqueo, reservas, teléfono, dirección ni nombres de clientes.

La disponibilidad filtra fecha argentina, horizonte inclusivo desde hoy hasta hoy + `horizon_days`, futuro, grilla, franjas completas y cualquier ocupación de la agenda. Un administrador autenticado puede consultar con `enabled=false`; el público recibe `[]`. Los horarios mostrados son orientativos hasta confirmar: `create_booking` vuelve a validar bajo lock.

### Crear reserva e idempotencia

```json
{
  "request_id": "uuid-generado-por-el-cliente",
  "service_id": "uuid-del-catalogo",
  "mode": "home",
  "starts_at": "2026-11-02T13:15:00-03:00",
  "customer_name": "Nombre Apellido",
  "phone": "+5493329600000",
  "address": "Dirección del cliente",
  "notes": "Texto opcional"
}
```

Respuesta:

```text
{id, starts_at, ends_at, price, service_name, mode, status:'confirmed'}
```

- `request_id`: UUID nuevo por intención de reserva. Reutilizar exactamente el mismo UUID y payload al reintentar una petición cuya respuesta se perdió. Cambiar fecha, datos o servicio requiere un UUID nuevo.
- La clave sola **no permite recuperar una reserva**: debe coincidir todo el payload normalizado (servicio, instante, modalidad, nombre, teléfono, dirección y notas). Diferencias reciben `23505` sin exponer identificador, comprobante ni datos anteriores.
- Un retry idéntico devuelve el **comprobante original** incluso si posteriormente se desactiva la agenda, cancela o reprograma el turno. Es confirmación de la operación original, no una consulta al estado actual. La consulta administrativa es la fuente de estado actual.
- `starts_at` requiere ISO con `T` y `Z` u offset `±HH:mm`. Todos los timestamps de respuesta se serializan en UTC; el frontend presenta Argentina.
- Nombre y apellido: 3–120 caracteres, al menos dos componentes con letras, sin controles. Teléfono: 10–15 dígitos, primer dígito no cero, `+` opcional; sin espacios ni guiones.
- Dirección: requerida en `home`, 5–250 caracteres; opcional en `local` y hasta 250. Notas: opcionales, hasta 500. Ambos admiten ausencia o `null`.
- Textos se recortan en los extremos. Teléfono y campos obligatorios deben ser strings JSON. No se aceptan objetos/números como texto.
- Precio, duración y buffers se calculan en el servidor. Campos de precio/duración aportados al crear no alteran la reserva.

### Snapshot y configuración

```text
admin_snapshot(p_from, p_to) -> {
  settings: {enabled,timezone,break_minutes,travel_before_minutes,
    travel_after_minutes,slot_step_minutes,horizon_days},
  services: [{id,name,price,duration_minutes,modes,active}],
  hours: [{id,weekday,mode,start_time,end_time,enabled}],
  blocks: [{id,starts_at,ends_at,reason}],
  bookings: [{id,service_id,service_name,mode,starts_at,ends_at,
    occupied_start,occupied_end,price,customer_name,phone,address,notes,status}]
}
```

`weekday`: 0 domingo hasta 6 sábado. Fechas inclusivas, **máximo 366 días** (`p_to - p_from <= 365`). Devuelve reservas y bloqueos cuyo intervalo ocupado intersecta `[p_from 00:00, p_to+1 00:00)` en Argentina. Incluye canceladas para gestión e histórico; no hay filtros de estado implícitos. Servicios, settings y franjas no se recortan por ese rango.

`admin_save_config` recibe el objeto **completo** `{settings,services,hours}`; puede tomarse del snapshot, quitando `blocks` y `bookings`.

- Servicios nuevos: `id:null`; existentes: UUID conocido. Servicios omitidos se desactivan, no se borran (preserva referencias históricas). Recuperar snapshot tras guardar para obtener los UUID asignados.
- Franjas nuevas: `id:null` o ausente; existentes: UUID conocido. La lista reemplaza las franjas actuales. No se admiten solapamientos entre franjas habilitadas de **una misma modalidad**. Modalidades diferentes pueden compartir horario: la agenda única resuelve ocupación cruzada.
- Horas en `HH:mm` o `HH:mm:00`, sin segundos fraccionarios. No hay franjas nocturnas que crucen de día; dividirlas. Se admite `24:00` como fin.
- Límites: precio 0–10.000.000 (dos decimales almacenados), duración 1–480 minutos, descanso/traslados 0–240, paso 1–120, horizonte 1–366. Hasta 100 servicios y 200 franjas por guardado.
- Booleanos y números son tipos JSON reales. Valores de duración/minutos deben ser enteros. `null` sólo en precio/duración de borradores y buffers desconocidos con agenda desactivada.
- Timezone fija: no permite un cambio que reinterprete reservas existentes.
- Validación y escritura ocurren en la misma transacción. Cualquier error revierte **toda** la configuración.

### Política explícita de snapshots al cambiar configuración

Las reservas ya confirmadas son compromisos existentes. Se conservan **servicio/nombre, modalidad, precio, duración, descanso, traslados e intervalo ocupado** originales. Cambiar horarios/días, retirar un servicio, reducir horizonte, desactivar reservas o modificar precios/buffers **no desplaza, repricia, borra ni reduce la ocupación de reservas existentes**. Esas reservas pueden permanecer fuera de las nuevas franjas y siguen visibles en el snapshot administrativo. Los cambios sólo gobiernan altas posteriores.

Las nuevas reservas se comprueban contra el intervalo ocupado íntegro de las anteriores, aunque sus servicios o franjas hayan cambiado. La política no recalcula silenciosamente compromisos existentes. Para aplicar nuevas necesidades de traslado a un compromiso anterior, reprogramarlo explícitamente; el servidor usa el mayor buffer entre el original y el vigente y rechaza cualquier conflicto.

### Administración de reservas y bloqueos

```text
admin_booking({action:'create', ...mismos campos de create_booking})
admin_booking({action:'update', id, status?, starts_at?})
admin_block({action:'create', starts_at, ends_at, reason?})
admin_block({action:'delete', id})
```

- Crear manualmente también requiere `request_id` y respeta servicio activo, grilla, futuro, horizonte, franjas y buffers. Puede usarse con `enabled=false` si está configurado.
- Estados: `confirmed`, `completed`, `cancelled`, `no_show`. **Sólo cancelled libera ocupación**. Completed y no_show retienen ocupación.
- Reprogramación preserva servicio, duración y precio. Usa el máximo de cada buffer guardado/actual, las franjas y grilla actuales, y comprueba otros intervalos sin chocar con su propio intervalo anterior. Permite mover parcialmente sobre su antiguo horario.
- Reactivar una cancelada revalida igual que reprogramar. No se admite cambiar horario y dejar estado cancelado. Para mover una cancelada, incluir un estado no cancelado.
- Cambiar sólo estado en una reserva no cancelada preserva su snapshot, incluso si su configuración original fue retirada.
- Bloqueos afectan **ambas modalidades** y no requieren alinearse a la grilla ni a horarios de servicio. Requieren inicio menor que fin, timestamps finitos y motivo opcional de hasta 250 caracteres. Su intervalo no lleva buffers adicionales. Chocan con reservas y otros bloqueos.

## Atomicidad, aislamiento y permisos

La tabla privada `agenda` contiene reservas y bloqueos. La restricción `agenda_no_overlap` usa GiST sobre `tstzrange(occupied_start,occupied_end,'[)')`, excluyendo únicamente canceladas. La ocupación de una reserva es:

```text
[inicio - traslado_antes, fin_servicio + traslado_después + descanso)
```

En local ambos traslados son cero; el descanso siempre cuenta. **Toda la ocupación** debe caber en una misma franja de su modalidad. La grilla se ancla al inicio de franja: con traslado previo, se omiten los primeros inicios que no caben. También se exige que el traslado previo no comience en el pasado. Los intervalos adyacentes son válidos.

Todas las RPC mutantes toman el mismo `pg_advisory_xact_lock(741932,1)` **antes** de leer datos que deciden la escritura. Lo conservan hasta commit/rollback. Configuración, reservas, estados, reprogramaciones, bloqueos e idempotencia quedan serializados. Triggers de escritura usan el mismo lock en todas las tablas, incluido el allowlist. Usar las RPC para la operación de la aplicación; la conexión propietaria se reserva para migraciones/allowlist.

Requiere aislamiento **READ COMMITTED** (predeterminado de PostgreSQL/PostgREST). Una mutación en REPEATABLE READ o SERIALIZABLE recibe `40001`: evita decidir con un snapshot previo a la adquisición del lock. Reintentar toda la transacción en READ COMMITTED. GiST es además la barrera independiente contra solapamientos.

Todas las tablas están en `jc_private`, con RLS habilitada y forzada, sin policies permisivas; se revocan schema/table/function privileges a PUBLIC, anon y authenticated. Sólo los tres RPC públicos pueden ejecutarse por anon; los administrativos se conceden a authenticated y verifican allowlist dentro. Se revoca también EXECUTE por defecto para nuevas funciones del propietario de esta migración en ambos esquemas. El frontend no necesita ni debe utilizar claves de servicio.

### Errores mapeables

| SQLSTATE | Significado |
| --- | --- |
| `22023` | Datos, fecha, franjas o configuración inválidos |
| `23P01` | Turno/bloqueo en conflicto; refrescar disponibilidad |
| `23505` | Idempotency key con otros datos, o IDs/franjas duplicados en configuración |
| `42501` | Sin autorización administrativa o sin permiso de ejecución |
| `55000` | Agenda desactivada o configuración incompleta |
| `40001` | Aislamiento no admitido; reintentar transacción en READ COMMITTED |

Las RPC sanitizan errores de restricciones, casts e intervalos con mensajes españoles, sin DETAILS de filas ni PII. Un rechazo de permisos **antes de entrar a la función** (p.ej. anon llamando a admin) o de tipos de argumentos de PostgREST puede usar el mensaje estándar de PostgreSQL/PostgREST: mapear por código en el cliente. Esta limitación del motor no cambia el contrato JSON.

## Pruebas y evidencia

### Suite SQL funcional y de permisos

En una base de pruebas con las dos primeras migraciones (antes de la actualización
comercial), con `postgres`:

```powershell
psql -X -v ON_ERROR_STOP=1 -f "supabase/tests/booking.sql"
```

La suite usa fixtures sintéticos y rollback; falla al primer assertion/error inesperado. Cubre:

- seed desconocido/disabled y cuatro franjas por día;
- anon, authenticated sin allowlist y admin; acceso directo rechazado y RLS comprobada incluso otorgando permisos temporales;
- activación incompleta, traslados positivos, preview admin desactivado;
- catálogo sin PII, horizonte/futuro/grilla, límites de nombre/teléfono/notas/dirección;
- buffers completos, ocupación cruzada, bordes `[)`, filtros de slots;
- cancelación, completed/no_show, reactivación, reprogramación sobre intervalo propio y conflicto con otro;
- bloqueos en ambos sentidos, traslados anteriores/posteriores, solapamiento a medianoche argentina;
- idempotencia sin exposición, precio/duración de servidor, snapshots y buffers conservadores;
- guardado atómico, servicios nuevos con ID null, rechazo de aislamiento con snapshot persistente.

### PostgreSQL embebido aislado, sin dependencias de la aplicación

Opcional cuando no hay psql/Docker:

```powershell
# Crear supabase/.tools si todavía no existe.
npm.cmd install --prefix "supabase/.tools" --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.10
node "supabase/tests/run-pglite.mjs"
```

El runner crea una base en memoria, emula las piezas mínimas de Auth, aplica las
dos primeras migraciones y ejecuta `booking.sql`; luego aplica la tercera y ejecuta
`customer-services.sql`. Así verifica tanto el contrato inicial como su actualización
comercial. `.tools/` está ignorado en Git. No modifica package.json ni lockfiles.

La cuarta migración está cubierta por `tests/booking/customer.spec.js`: los casos
de cliente aplican la tercera y la cuarta sobre la fixture compartida. El caso de
actualización de precio aplica explícitamente la cuarta después de crear una reserva
a $20.000 y comprueba catálogo a $30.000, snapshot histórico íntegro, reintento con
comprobante original y nueva reserva a $30.000. El runner SQL anterior conserva la
evidencia histórica de la tercera migración y no ejecuta este caso. La ejecución
de esta prueba conectada queda a cargo del coordinador; la aplicación SQL remota
de la cuarta migración sigue pendiente.

Actualización 2026-10-20: el runner aplica **ambas migraciones**. La suite de navegador
`npm.cmd run test:booking` cubre además la transferencia real sobre SQL, rechazo
de finalización sin confirmación/vencida, confirmación por identidad incorrecta,
prohibición de autoalta, revocación de todas las RPC con el JWT anterior y la
continuidad de acceso del destinatario. Auth HTTP se simula; no certifica envío SMTP.

**Ejecutado y aprobado en esta entrega:** PGlite 0.5.10 / PostgreSQL 18.6, migración completa y suite SQL. La primera ejecución detectó una columna ambigua en `available_slots`; se corrigió y la ejecución final pasó, incluidas las validaciones y RLS añadidas posteriormente.

### Concurrencia nativa entre conexiones

Usar una base **descartable**, recién migrada, sin reservas y desactivada, conectándose como `postgres`. El runner prepara y restaura fixtures con commits entre sesiones:

```powershell
$env:JC_TEST_DATABASE_URL = 'postgresql://postgres:CLAVE@HOST:5432/BASE_DE_PRUEBAS'
# Opcional: $env:PSQL = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
node "supabase/tests/run-concurrency.mjs"
```

Dos procesos psql compiten; una tercera conexión observa `pg_stat_activity` y sólo libera la primera transacción tras comprobar que la segunda espera el advisory lock. Casos: reservas same-mode/cross-mode, reserva/bloqueo en ambos órdenes, retries idénticos y diferentes, desactivación/configuración contra reserva en ambos órdenes y snapshot resultante. El runner usa sólo APIs de Node y psql; no instala paquetes de la aplicación.

**Pendiente de ejecución nativa:** no se encontraron psql, Docker ni Supabase CLI en este entorno. `node --check supabase/tests/run-concurrency.mjs` sí pasó. PGlite no certifica concurrencia real de dos sesiones. También quedan pendientes aplicar la migración en el Supabase de destino y verificar el flujo PostgREST/JWT real con el frontend integrado.
