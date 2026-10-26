# Plan de implementación — JC BARBER

> Documento ejecutable por distintos agentes de IA, con continuidad en disco, coordinación de subagentes y verificación automática.
>
> **Encargo activo (2026-10-25, última instrucción):** el botón "Continuar" tiene que llevar al paso siguiente. Al elegir el corte general aparece "Continuar" y debe pasar al día y el horario; al elegir el día y el horario hay que bajar/pasar solo al paso de registrarse; y el corte a domicilio debe mostrar el mismo botón "Continuar" que avanza al siguiente paso. Sobre `index.html`, `src/styles.css` y `src/main.js`.
>
> **Encargo anterior (2026-10-25):** acomodar los horarios por modalidad. Corte a domicilio: de 07:00 a 08:30 y de 12:45 a 15:45. En el local: de 09:00 a 12:30 y de 16:30 a 20:30.
>
> **Encargo anterior (2026-10-25):** el bloque de condiciones de la membresía queda centrado (caja y contenido); los turnos del domingo sólo pueden ser de corte a domicilio porque la peluquería está cerrada los domingos; y toda la página debe verse bien en el celular y en la computadora (responsive).
>
> **Encargo anterior (2026-10-25):** el corte a domicilio pasa a costar $20.000 de lunes a sábados y $30.000 los domingos; además, en el paso de servicios se agregan tres tarjetas de membresías (2 cortes $30.000, 3 cortes $45.000, 4 cortes $50.000) con sus 5 condiciones, en cuadrados como el corte general y el domicilio.
>
> **Encargo anterior (2026-10-25):** servicios: dejar sólo dos tarjetas ("Corte general" y "Corte a domicilio"); al seleccionar el corte general, debajo aparecen las opciones para sumar barba, perfilado de cejas o ambos. Todo lo demás del flujo se mantiene como está.
>
> **Encargo del 2026-10-22:** tres pasos: 1) cuatro tarjetas de servicios con precios confirmados, 2) calendario y lista desplegable de horarios de 30 minutos en local / 45 a domicilio, 3) nombre y apellido, dirección para domicilio y confirmación por WhatsApp. Conservar los colores actuales. Este encargo reemplaza el diseño de cuatro/cinco pasos de R11.

## 1. Objetivo y resultado esperado

Crear en esta carpeta una web profesional, rápida, accesible y adaptable a celulares para **JC BARBER**, usando su logo y fotografías reales. Debe permitir elegir una fecha y un horario deseados para un corte a domicilio y continuar por WhatsApp con un mensaje preparado; además debe mostrar la dirección proporcionada y el enlace directo a Instagram.

El trabajo se ejecutará con decisiones técnicas autónomas, comprobaciones reproducibles y un registro que permita retomar sin depender de la conversación anterior.

### Datos confirmados

| Dato | Valor exacto / tratamiento |
| --- | --- |
| Marca | JC BARBER |
| Logo | `logo.jpg`, comprobado visualmente: marca negra sobre fondo blanco |
| Galería | `corte1.jpeg`, `corte2.jpeg`, `corte3.jpeg`, `corte4.jpeg`, `corte5.jpeg` |
| Servicio confirmado | Corte de pelo a domicilio |
| WhatsApp visible | `+54 9 3329 60-6138` |
| WhatsApp normalizado | `5493329606138` |
| Enlace base | `https://wa.me/5493329606138` |
| Dirección visible | `AVENIDA SAN MARTIN 743` |
| Instagram | `@jc_barberhouse` |
| Enlace Instagram | `https://www.instagram.com/jc_barberhouse/` |
| TikTok | `@jcbarberhouse` — `https://www.tiktok.com/@jcbarberhouse?_r=1&_t=ZS-9AfYPGAygh0` |
| Idioma | Español de Argentina, `lang="es-AR"` |
| Zona horaria de los turnos | `America/Argentina/Buenos_Aires` |

### Límites funcionales que deben reflejarse en la interfaz

- El calendario **solicita un turno**. Sin un backend de agenda no puede conocer ocupación, bloquear reservas simultáneas ni confirmar disponibilidad.
- El botón abre WhatsApp con el texto precargado. El visitante pulsa enviar dentro de WhatsApp; el enlace web no envía mensajes por sí solo.
- Mostrar junto al formulario: **“Elegí tu fecha y horario preferidos. Confirmamos disponibilidad por WhatsApp.”**
- No mostrar “turno confirmado” ni “mensaje enviado” por haber abierto un enlace.
- Dirección y atención a domicilio deben convivir sin suponer que existe atención presencial reservable. Usar “Ubicación de referencia: AVENIDA SAN MARTIN 743” y destacar el servicio a domicilio.
- No inventar ciudad, coordenadas, horarios comerciales, precios, servicios adicionales, testimonios, años de experiencia ni zona de cobertura.

## 2. Estado operativo — leer primero al retomar

Esta sección y el tablero son la **única fuente editable de avance**. Los handoffs históricos conservan evidencia, pero no son otro tablero.

| Campo | Estado actual |
| --- | --- |
| Fecha del relevamiento inicial | 2026-10-16 |
| Versión del plan | 1.0 |
| Raíz | `D:\jcbarber` |
| Fase | R19 completado: el botón "Continuar" avanza y baja al paso 2 tanto para el corte general como para el domicilio, elegir día y horario pasa solo al paso 3 con scroll, y `setStep()` lleva el panel recién abierto a la vista; verificado con 68/68 comprobaciones nuevas (Chromium) más 60/60, 58/58, 49/49, 45/45 y 31/31 de regresión |
| Coordinador activo | OpenCode, sesión 2026-10-25; coordinador único |
| Tarea reclamada | Ninguna activa; R19 hecho, R08 pendiente externo |
| Últimas tareas completadas | R19: `index.html` (`#service-continue` fuera de `#service-extras`, con `hidden` inicial), `src/main.js` (`setStep()` con `scrollIntoView`, `syncExtrasPanel()` muestra/oculta el botón, `selectService()` ya no salta de paso, `syncExtrasPanel()` en el init), `src/styles.css` (`.service-continue` centrado a 760px); 68/68 + regresiones; capturas en test-results/r19/ (gitignored) |
| Próxima tarea | R08: activación y publicación del entorno remoto según docs/RESERVAS.md (externo) |
| Paso exacto de reanudación | Servidor estático `python -m http.server 4173` en la raíz + abrir http://127.0.0.1:4173/. Comprobaciones reproducibles (en serie): `node test-results/r19-check.mjs` (nuevo), `node test-results/r18-check.mjs`, `node test-results/r17-check.mjs`, `node test-results/membresias-check.mjs`, `node test-results/servicios-extras-check.mjs` y `node test-results/hero-slideshow-check.mjs`. Sin subagentes activos |
| Bloqueos del alcance actual | P08: Lighthouse/instalación limpia sin certificar en este entorno. R02: concurrencia nativa y PostgREST/JWT reales pendientes de proyecto Supabase del propietario |
| Incidencia de entorno | EPERM en dist/images y dist-release/images. Artefacto actualizado sin Supabase en test-results/r11-three-final/, build/portable y E2E aprobados; permisos intactos |
| Node / npm detectados | Node `v24.19.0`; npm `11.17.0` vía `npm.cmd` |
| Esfuerzo configurable observado | No expuesto por las herramientas de esta sesión; no se modificó |
| Compactación ejecutada | Ninguna; no se dispone de una herramienta invocable de compactación en esta sesión |
| Verificaciones realizadas | 2026-10-25 (R19): `test-results/r19-check.mjs` **68/68** con Playwright/Chromium — botón "Continuar" oculto al cargar y visible al elegir cualquiera de los dos cortes, ambos se quedan en el paso 1, "Continuar" abre el paso 2 y lo deja a la vista (top 105px en escritorio y 85px en móvil, bajo la cabecera fija), elegir el día y el horario pasa solo al paso 3 con el panel a la vista, el formulario envía el mensaje con fecha y hora, con fecha/hora conservadas "Continuar" va directo al paso 3 y con la hora de la otra modalidad limpia vuelve al paso 2, la membresía usa su propio botón, targets ≥24px y sin overflow 320/390/768/1024/1440, axe sin violaciones (pasos 1 y 3), sin JS el botón queda oculto; capturas en test-results/r19/. Regresión: R18 60/60, R17 58/58, membresías 49/49, servicios/extras 45/45 y carrusel 31/31. 2026-10-25 (R18): `test-results/r18-check.mjs` **60/60** con Playwright/Chromium — local con los 15 turnos exactos 09:00…12:00 y 16:30…20:00 (sin 12:30 ni 20:30 como inicio) y pie "Turnos de 30 minutos."; domicilio con los 6 turnos exactos 07:00, 07:45, 12:45, 13:30, 14:15, 15:00 (sin 08:30 ni 15:45 como inicio) y pie "Turnos de 45 minutos."; aviso de franjas con el texto propio de cada modalidad; al pasar de local a domicilio y viceversa se limpia la hora inexistente y se repinta la grilla; el domingo de domicilio ofrece sus 6 turnos; mensaje de WhatsApp con la hora elegida; membresía sin aviso de franjas; sin overflow y objetivos ≥24px en 320/390/768/1024/1440 en ambos modos; axe sin violaciones; sin JS el aviso queda oculto y el pie conserva el texto estático; capturas en test-results/r18/. Regresión: R17 58/58, membresías 48/48, servicios/extras 44/44 (una comprobación ampliada para el cambio de franja) y carrusel 31/31. 2026-10-25 (R17): `test-results/r17-check.mjs` **58/58** con Playwright/Chromium — bloque de condiciones centrado (230,2 px a cada lado, texto e ítems centrados, marcador dentro), domicilio acepta domingo con $30.000 y horarios, corte general limpia la fecha de domingo, tarjeta con "Cerrado los domingos", aviso en el paso 2, los cinco domingos del mes deshabilitados con " (la peluquería está cerrada los domingos)" en el nombre accesible, campo nativo rechaza el domingo con error + `aria-invalid`, lunes aceptado y mensaje de WhatsApp correcto, sin overflow 320/390/768/1024/1440, objetivos táctiles ≥24px, axe sin violaciones (condiciones y aviso), sin JS el aviso queda oculto; capturas en test-results/r17/. Regresión: membresías 48/48, servicios/extras 43/43 y carrusel 31/31. 2026-10-25 (R16): membresías 48/48 con Playwright/Chromium (precios 18.000/20.000 y nota "Domingos $30.000", tres membresías 30.000/45.000/50.000, 5 condiciones, salto al paso 3 sin calendario, mensaje "Fecha y hora: a coordinar por WhatsApp", precio de domicilio 20.000 en lunes y 30.000 en domingo, axe, responsive 320–1440, sin JS) + regresión servicios/extras 43/43 + carrusel del hero 31/31; capturas en test-results/membresias/. 2026-10-24: carrusel del hero 31/31; capturas en test-results/hero-slideshow/ |
| Verificaciones de la aplicación | 2026-10-22: R11 offline/conectado, axe y portable PASS. Corrección WebKit verificada. Evidencia detallada en docs/evidence/TRES_PASOS.md |
| Checkpoint recuperación de herramientas | 2026-10-18: herramientas de build/E2E funcionales; Lighthouse ausente. Intento npm aislado termina por timeout. Los scripts históricos de recuperación install-windows.mjs/cache-dependencies.mjs no están en disco; no invocarlos. |

### Inventario inicial

- `index.html`: existente, vacío; no hay una aplicación que migrar.
- `logo.jpg`: imagen de marca de tamaño reducido; evitar ampliaciones que la pixelen.
- Cinco JPEG de cortes: conservar los originales. Inspeccionar visualmente las otras cuatro fotografías en P03 antes de definir recortes y textos alternativos.
- `.git/`: repositorio existente. Los siete archivos de contenido inicial aparecían sin seguimiento; tratarlos como material del usuario.
- `jcbarber/`: contenido no inspeccionado por acceso denegado. No asumir que está vacío ni borrarlo.
- No se encontró un `AGENTS.md` previo en el recorrido accesible. El archivo de entrada se añadió con este plan.
- Inicialmente no había `package.json`, herramientas de build ni pruebas en la raíz accesible.

## 3. Reglas de autonomía y calidad

1. Avanzar hasta cumplir la tarea activa; no detenerse después de proponer un plan cuando el encargo sea implementarlo.
2. No preguntar por colores, frameworks, estructura, nombres internos ni confirmaciones rutinarias. Adoptar las decisiones de este documento y justificar únicamente los cambios relevantes.
3. Usar instaladores con flags no interactivos; ejecutar pruebas y análisis automáticamente. No pedir al usuario elegir opciones “1/2/3/4” ni responder “yes/no”.
4. La autonomía opera dentro de los permisos reales del entorno. Si una herramienta impide una acción, usar una alternativa permitida o registrar el bloqueo; no simular resultados ni alterar permisos globales para eludirlo.
5. `grill-me` es la única entrevista prevista: una pregunta concreta por vez, sólo para un requisito de negocio imprescindible sin alternativa fiel. Continuar el trabajo independiente mientras se espera.
6. Las incógnitas actuales no bloquean el MVP: sin horarios conocidos, solicitar hora preferida; sin ciudad, mostrar la dirección literal sin pin exacto; sin precios, omitir importes.
7. Cada tarea tiene un resultado comprobable. “Código escrito” no equivale a “verificado”.
8. Priorizar funcionamiento, conversión a WhatsApp, accesibilidad y velocidad. Las mejoras deben resolver una necesidad observada, no ampliar indefinidamente el alcance.
9. Conservar los archivos originales y los cambios ajenos. Antes de editar, comprobar si otro agente o el usuario avanzó.
10. No hacer commits, push ni publicación remota sin un encargo que los autorice. Preparar un artefacto desplegable y las instrucciones de publicación.

## 4. Esfuerzo, contexto y recuperación

### 4.1 Esfuerzo máximo compatible

- Al iniciar cada sesión y subagente, comprobar qué controles de esfuerzo ofrece realmente su modelo/proveedor.
- Elegir el nivel de razonamiento más alto admitido: puede llamarse `high`, `xhigh`, `max` u otro equivalente. Los nombres no son intercambiables entre proveedores.
- Si el harness permite configurarlo, aplicar la opción documentada y anotar el valor efectivo. Si no la expone, registrar “no configurable desde esta sesión” y continuar con análisis y verificación rigurosos.
- No insertar campos de configuración adivinados, ni prometer que estas instrucciones cambian el modelo. Si se modifica configuración en una ejecución futura, validar su esquema oficial.
- Máximo esfuerzo significa resolver bien y comprobar los casos difíciles; no repetir búsquedas ni pruebas que ya dieron evidencia vigente.

### 4.2 Política de checkpoints y compactación

Guardar un checkpoint **después de cada subtarea**, antes de operaciones largas, antes de delegar/cambiar de agente y antes de compactar. No esperar a quedarse sin tokens.

Cuando el indicador de contexto llegue al **50% o más**, buscar el siguiente límite seguro de subtarea y:

1. Actualizar Estado operativo y tablero; registrar archivos, decisiones, errores y pruebas.
2. Escribir un handoff con el siguiente paso exacto y las tareas de subagentes aún activas.
3. Invocar `/compact` si el cliente lo ofrece como comando utilizable por el agente, o su mecanismo equivalente documentado. No ejecutarlo como si fuera un comando de PowerShell.
4. Después de compactar, releer Estado operativo, decisiones vigentes y último handoff; verificar que coinciden con el disco antes de continuar.

**Umbral preventivo:** entre 65% y 70% de contexto consumido, evitar iniciar una unidad grande; guardar estado y compactar/traspasar primero. Conservar margen para las herramientas y el informe final.

**Si no hay medidor:** estimar según el presupuesto visible, guardar estado al menos cada subtarea y tras unas 10 llamadas de herramientas o una salida muy extensa. No afirmar un porcentaje exacto no observado.

**Si no se puede invocar compactación:** escribir un resumen autosuficiente en el handoff y reducir el contexto de trabajo a los archivos imprescindibles. Usar la continuación automática del harness si existe. Si no existe, terminar con el punto de reanudación preparado; no inventar una compactación ni exigir una confirmación de negocio.

### 4.3 Recuperación tras interrupción inesperada

1. Leer el checkpoint más reciente y contrastarlo con `git status` y los archivos asignados.
2. Una tarea `en_curso` no se considera hecha por la antigüedad del registro.
3. Comprobar si su propietario sigue activo. Sólo el coordinador puede reasignarla, después de confirmar su cierre o pérdida de sesión.
4. Si hay código parcial, identificar qué criterio falta; completar ese tramo sin reiniciar la tarea entera.
5. Si hay evidencia de una prueba exitosa para el mismo contenido, reutilizarla. Repetir sólo si cambió el código, faltan artefactos o hay una regresión plausible.
6. Registrar “recuperación de sesión” y actualizar propietario, checkpoint y siguiente acción.

## 5. Coordinación entre agentes y subagentes

### Roles

| Rol | Responsabilidad | Límite de escritura |
| --- | --- | --- |
| Coordinador/integrador | Reclamar tareas, definir contratos, integrar, actualizar plan y verificar el resultado completo | Plan, archivos compartidos y asignaciones explícitas |
| Diseño y contenido | Dirección visual, layout, textos, imágenes y responsive | HTML/CSS y assets asignados |
| Reservas | Calendario, validación, fechas y construcción del enlace de WhatsApp | Módulos y pruebas unitarias asignados |
| QA/revisor | Flujos reales, accesibilidad, consola y rendimiento | Pruebas/evidencias asignadas; hallazgos para el integrador |

Un solo agente puede asumir todos los roles. Delegar cuando reduzca tiempo real de ejecución; no crear subagentes para repetir el relevamiento o leer todo el repositorio.

### Protocolo para no duplicar ni pisar trabajo

- Sólo **un coordinador activo** escribe Estado operativo y tablero. Si no se puede asegurar exclusión de escritores, ejecutar en serie.
- Antes de delegar, el coordinador registra ID de tarea, propietario, hora ISO, dependencias y archivos reservados. No asignar el mismo archivo a dos agentes concurrentes.
- Cada subagente recibe sólo objetivo, contexto imprescindible, contrato, archivos autorizados, criterios y comandos de verificación. Debe releer los archivos antes de editarlos.
- `package.json`, lockfiles, `src/config.js`, `index.html` y este plan son compartidos: un solo escritor por vez. El coordinador integra cambios cruzados.
- Una tarea asignada no se realiza de nuevo desde el coordinador. Éste avanza sobre otra unidad independiente o espera.
- Si hacen falta cambios fuera de la asignación, devolver el hallazgo al coordinador para ampliar o serializar la tarea.
- El subagente entrega un informe al coordinador; éste lo incorpora al handoff. Si se requiere persistencia mientras trabaja, usar un archivo exclusivo `docs/handoffs/<tarea>-<sesion>.md`, creado al necesitarlo.
- El revisor reporta defectos con archivo y evidencia; quien tenga la propiedad del archivo aplica la corrección. No abrir dos correcciones para el mismo defecto.
- El coordinador revisa la integración y las pruebas requeridas antes de marcar `hecho`.

### Plantilla de asignación

```text
Tarea/ID:
Propietario y sesión:
Objetivo y dependencia satisfecha:
Archivos de escritura exclusiva:
Archivos de sólo lectura / contrato vigente:
Criterios de aceptación:
Comandos de verificación:
Entregable y ruta de evidencia:
Punto de checkpoint / límite de contexto:
Al terminar: cambios, pruebas, pendientes, aciertos, fallos y mejoras.
```

## 6. Skills instaladas y uso previsto

Instalación local realizada sin interacción mediante el CLI del ecosistema [skills.sh](https://skills.sh). Ubicación canónica: `.agents/skills/`. Fuentes y hashes de contenido: `skills-lock.json`.

| Skill | Fuente | Cuándo utilizarla |
| --- | --- | --- |
| `frontend-design` | `anthropics/skills` | Definir y construir identidad visual propia, jerarquía y responsive |
| `webapp-testing` | `anthropics/skills` | Automatización de navegador, captura de evidencia y diagnóstico de flujos |
| `web-design-guidelines` | `vercel-labs/agent-skills` | Revisar interfaz, navegación, formularios y accesibilidad |
| `grill-me` | `mattpocock/skills` | Sólo ante una ambigüedad imprescindible de negocio |

Comandos ejecutados desde la raíz, todos con resultado satisfactorio:

```powershell
npx.cmd --yes skills add anthropics/skills --skill frontend-design webapp-testing --agent opencode codex --yes
npx.cmd --yes skills add vercel-labs/agent-skills --skill web-design-guidelines --agent opencode codex --yes
npx.cmd --yes skills add mattpocock/skills --skill grill-me --agent opencode codex --yes
npx.cmd --yes skills list
```

- Las instalaciones están en disco y fueron listadas por el CLI. No repetirlas en cada sesión ni actualizar versiones sin necesidad.
- Si el agente no autodetecta la carpeta compartida, leer directamente `.agents/skills/<nombre>/SKILL.md`. No hace falta copiar el plan para cada proveedor.
- OpenCode puede requerir cerrar y reiniciar el cliente para que las skills nuevas aparezcan en su catálogo; en una sesión ya abierta se pueden consultar como archivos.
- Cargar sólo la skill que corresponda a la tarea; no incluir todas sus referencias en cada contexto.
- `webapp-testing` incluye ejemplos Python. El stack del proyecto define Playwright Test en JavaScript para reutilizar Node; aplicar su metodología de inspección y evidencia, sin añadir un segundo runtime sólo por copiar ejemplos.
- Revisar instrucciones y dependencias antes de ejecutar scripts incluidos. Una skill es guía de trabajo, no evidencia de que se haya probado la web.
- Si aparece una necesidad nueva, elegir una skill específica de fuente identificable, instalarla con flags no interactivos y registrar fuente, propósito y resultado. No instalar packs indiscriminados.

## 7. Decisiones de producto y arquitectura

### Decisiones vigentes

| ID | Decisión | Motivo / condición de revisión |
| --- | --- | --- |
| D01 | Web estática de una página, HTML semántico, CSS y JavaScript modular | Adecuada para contenido y solicitud por WhatsApp; no requiere backend |
| D02 | Vite como servidor y build; npm con lockfile | Desarrollo y artefacto estático reproducibles |
| D03 | Sin React ni framework UI de entrada | La interacción requerida cabe en módulos pequeños; revisar sólo ante necesidad real |
| D04 | Calendario mensual visible + campo de fecha nativo sincronizado + hora preferida | Resuelve selección visual y alternativa accesible/móvil |
| D05 | La reserva es una solicitud por WhatsApp | No existe agenda real ni integración de mensajería transaccional |
| D06 | Hora libre válida `HH:mm`, sin franjas comerciales inventadas | No se informaron horarios; el negocio confirma disponibilidad |
| D07 | Dirección literal y enlace de búsqueda de Maps | Ciudad desconocida; no fabricar coordenadas o un mapa exacto |
| D08 | Test unitario con `node:test`; E2E con Playwright Test; axe para auditoría automática | Cubrir comportamiento real sin complejidad innecesaria |
| D09 | Originales conservados, derivados optimizados en `public/images/` | Mejor rendimiento manteniendo el material del usuario |
| D10 | Datos comerciales centralizados en `src/config.js` | Evitar números, enlaces o textos contradictorios |
| D11 | Nombre visible y mensaje: JC Barberhouse; conservar logo original JC BARBER | Aclaración expresa del usuario el 2026-10-17; reemplaza el nombre inicial del contrato, no el material gráfico |
| D12 | Retirar sección azul `#experiencia` y su enlace de navegación; instrucciones permanecen en el formulario | Pedido expreso del usuario del 2026-10-18, captura “Renová tu look. Quedate cómodo.”; reemplaza obligatoriedad de esa sección |
| D13 | TikTok en contacto, pie y datos estructurados; WhatsApp con SVG oficial Tabler | Enlace y SVG aportados por usuario 2026-10-18; íconos contrastados con repositorio oficial Tabler |
| D14 | Mantener diseño/recursos actuales; extender formulario en #turnos y agregar /admin/ | Encargo 2026-10-19; la fotografía certificados.jpeg difiere del handoff previo y se conserva |
| D15 | Supabase PostgreSQL + Auth, RPC transaccionales y RLS; frontend estático Vite | Compatible con hosting existente sin servidor Node ni claves privadas en frontend |
| D16 | Agenda única; ocupación incluye traslado antes/después a domicilio y descanso; franjas completas | Un solo profesional; validación servidor y exclusión de intervalos, también frente a bloqueos |
| D17 | Reservas inicialmente desactivadas; días sin habilitar y valores comerciales sin inventar | Se precargan las cuatro franjas indicadas; activar sólo después de configurar días, duración, precio, descanso y traslado |
| D18 | Local: corte general $18.000, barba $10.000, perfilado de cejas $8.000, turnos de 30 min. Domicilio: corte $20.000, incluye barba y perfilado de cejas, 45 min. Ambas modalidades 09:00–12:30 y 16:30–20:30 | Pedido 2026-10-21; reemplaza D06 y los datos comerciales desconocidos. Turnos completos dentro de cada franja, cierres exclusivos para nuevos inicios; días operativos reales siguen bajo control de la agenda |
| D19 | Formulario en tres pasos con calendario amplio, nombre y apellido; domicilio sólo cuando corresponda; sin comentarios opcionales; cierre por WhatsApp | Pedido 2026-10-21. En modo conectado se conserva la reserva transaccional y se ofrece el mensaje con comprobante para continuar por WhatsApp |
| D20 | Localidad de la barbería: `Baradero`. `config.addressCity = "Baradero"`; JSON-LD con `addressLocality`; query de Maps `AVENIDA SAN MARTIN 743, Baradero`; campo `#city` eliminado del formulario (la localidad se escribe en el campo Dirección) | Mockup del usuario 2026-10-22 muestra "Av. San Martín 743 / Baradero"; reemplaza M02 (ciudad desconocida) y el uso separado de `#city` |

**D21 — vigente, 2026-10-22:** tres pasos: cuatro tarjetas de servicios que determinan modalidad, calendario con horario desplegable nativo, datos y WhatsApp. Dirección visible/requerida sólo a domicilio. Reemplaza D19 y las especificaciones históricas de cuatro/cinco pasos de R11; precios y duraciones D18 intactos. Evidencia: docs/evidence/TRES_PASOS.md.

**D23 — vigente, 2026-10-24:** la sección de galería `#cortes` ("Cortes que hablan por sí solos") se retira; las cinco fotos de cortes y `certificados.jpeg` rotan automáticamente en el bloque visual del hero (`#cortes` queda como ancla sobre `.hero-visual`, de modo que el menú y el enlace "Mirá nuestros cortes" no quedan rotos). Carrusel con crossfade de 4,5 s, puntos de navegación y botón pausar/reanudar; con `prefers-reduced-motion` arranca pausado y sin JavaScript se ve la primera foto. Se elimina el lightbox `#photo-dialog` (pertenecía a la galería retirada). Pedido expreso del usuario 2026-10-24; reemplaza el ítem 3 de las secciones obligatorias de esta sección.

**D24 — vigente, 2026-10-25:** el paso 1 muestra sólo dos tarjetas, "Corte general" ($18.000, 30 min, local) y "Corte a domicilio" (45 min, incluye barba y perfilado de cejas). Barba ($10.000) y perfilado de cejas ($8.000) dejan de ser servicios independientes y pasan a extras opcionales del corte general: al tildar esa tarjeta el paso 1 permanece visible y aparece debajo un panel con los dos extras (leyenda "Sumá extras a tu corte", ayuda "Opcional: elegí barba, perfilado de cejas o ambos"), el total en vivo y el botón "Continuar"; elegir el domicilio oculta el panel y limpia los extras. El precio mostrado y enviado es la suma de los importes confirmados de D18 y la duración la suma de las duraciones confirmadas (30 min por servicio). No cambian el generador de turnos de 30 minutos, los pasos 2 y 3 ni el resto del flujo. Pedido expreso del usuario 2026-10-25; modifica el catálogo de D18 sin alterar ninguno de sus precios (el precio de domicilio lo ajusta D25).

**D25 — vigente, 2026-10-25:** el corte a domicilio pasa a $20.000 de lunes a sábados y $30.000 los domingos (`amount` y `sundayAmount`; la tarjeta muestra $20.000 con la nota "Domingos $30.000" y el importe del resumen/vista previa/mensaje se recalcula al elegir la fecha). Debajo de las dos tarjetas aparece el bloque de membresías: título `MEMBRESÍAS EXCLUSIVAS JC BARBER` con la etiqueta "Sólo a domicilio", tres tarjetas en cuadrados como las de servicio (2 cortes $30.000, 3 cortes $45.000, 4 cortes $50.000, duración sin informar, detalle "Al mes, se abona del 1 al 5") y las cinco condiciones en una lista numerada. Al elegir una membresía se ocultan los extras, se limpia fecha y horario, el tab "Fecha y horario" queda deshabilitado y el botón "Continuar" del bloque de condiciones salta directo al paso 3: la vista previa informa "A coordinar por WhatsApp" y el mensaje enviado dice `Fecha y hora: a coordinar por WhatsApp` en lugar de fecha/hora preferidas (el resto, incluida la dirección, se conserva). No cambian los extras de D24, el generador de turnos ni el flujo del corte general. Pedido expreso del usuario 2026-10-25; modifica el precio de domicilio de D18/D24 sin tocar el resto de sus importes.

**D26 — vigente, 2026-10-25:** el bloque `#membership-conditions` se centra dentro del paso 1 (`margin-inline: auto`, ancho máximo 760px) y su contenido también (título, lista numerada con `list-style-position: inside`, total y botón con `text-align: center`), en coherencia con las tarjetas centradas de R13. Además, la peluquería está cerrada los domingos: con el corte general (modo `local`) los domingos quedan deshabilitados en el calendario con la clase `.is-closed-sunday` y el motivo en el nombre accesible, el campo de fecha nativo los rechaza con error, `validateDetails()` los bloquea, `selectService()` limpia una fecha de domingo ya elegida y el paso 2 muestra `#sunday-note` ("Los domingos la peluquería está cerrada: en el local no hay turnos. Para el domingo, elegí el corte a domicilio."); la tarjeta del corte general muestra la etiqueta "Cerrado los domingos". El corte a domicilio sí se puede pedir un domingo (con el recargo de D25) y las membresías siguen sin fecha en el formulario. En responsive, por debajo de 480px las dos tarjetas de servicio pasan a una columna (igual que las membresías) para que quepan sin apretarse. No cambian precios, duraciones, extras, generador de turnos ni el resto del flujo. Pedido expreso del usuario 2026-10-25.

**D27 — vigente, 2026-10-25:** los horarios se separan por modalidad. Local (`stepMin: 30`): 09:00–12:30 y 16:30–20:30, con 15 turnos de inicio (09:00…12:00 y 16:30…20:00; el turno termina dentro de la franja). Domicilio (`stepMin: 45`): 07:00–08:30 y 12:45–15:45, con 6 turnos de inicio (07:00, 07:45, 12:45, 13:30, 14:15, 15:00; ambas franjas son múltiplos exactos de 45 min). En `src/main.js`, `SCHEDULES` guarda `label`, `stepMin` y `windows` por modo y `modeSchedule()` resuelve el horario del servicio elegido (sin servicio → local), de modo que `slotsForDate()`, la validación del envío y el refresco al cambiar de servicio usan la misma grilla. Junto a los horarios se muestran `#times-schedule` ("Horarios en el local: de 09:00 a 12:30 y de 16:30 a 20:30." / "Horarios a domicilio: de 07:00 a 08:30 y de 12:45 a 15:45.") y el pie `#times-duration` ("Turnos de 30/45 minutos."), ambos degradables sin JS. Al cambiar de modalidad con una hora que no existe en la franja nueva se limpia el horario y la persona vuelve a elegir turno; la fecha se conserva. Modifica las franjas de D18 (duraciones, precios y domingos de D25/D26 intactos). Pedido expreso del usuario 2026-10-25.

**D28 — vigente, 2026-10-25:** los tres pasos se recorren con el botón y con desplazamiento visible. `setStep()` ahora hace `focus({ preventScroll: true })` + `scrollIntoView({ block: "start" })` sobre el panel recién abierto (el `scroll-padding-top` de 105px/85px de `html` lo deja justo bajo la cabecera fija): antes el panel se abría fuera de pantalla y parecía que "Continuar" no hacía nada. `#service-continue` sale del bloque `#service-extras` y pasa a ser hijo directo del paso 1 con `hidden` inicial; `syncExtrasPanel()` lo muestra cuando hay servicio y no es membresía, de modo que **los dos cortes** (general y domicilio) comparten el mismo botón, que va al paso 2 o directo al 3 si ya quedaron fecha y horario. Elegir un servicio ya **no** salta de paso solo: `selectService()` siempre se queda en el paso 1 (antes el domicilio avanzaba automático); la membresía conserva su propio `#membership-continue`. Elegir un horario sigue pasando solo al paso 3 (`selectTime()`), que ahora además baja hasta el registro. `.service-continue` queda centrado (`display: flex; width: 100%; max-width: 760px; margin: 26px auto 0`) alineado con las tarjetas. No cambian precios, horarios de D27, extras, validaciones ni el mensaje de WhatsApp. Pedido expreso del usuario 2026-10-25.

Cambiar una decisión exige anotar motivo, impacto, tareas afectadas y evidencia. Una preferencia personal de otro agente no justifica reconstruir el stack.

### Estructura objetivo

```text
AGENTS.md
PLAN_IMPLEMENTACION.md
README.md                         # cómo ejecutar, verificar y publicar
index.html                        # estructura y contenido semántico
package.json / package-lock.json
src/
  config.js                       # datos confirmados y parámetros de producto
  main.js                         # integración y navegación
  styles.css                      # tokens, componentes y responsive
  calendar.js                     # calendario y controles accesibles
  booking.js                      # formulario y estados
  date-utils.js                   # validación temporal testeable
  whatsapp.js                     # texto y URL, funciones puras
public/
  images/                         # derivados del logo y las cinco fotos
scripts/
  optimize-images.mjs             # generación reproducible de derivados
tests/
  unit/                           # fechas y mensaje WhatsApp
  e2e/                            # navegación, formulario, calendario y a11y
playwright.config.js
docs/
  evidence/                       # resultados resumidos y evidencia relevante
  handoffs/                       # sólo si hay subagentes con checkpoints propios
.agents/skills/
skills-lock.json
```

`dist/`, `node_modules/`, reportes temporales y resultados de tests deben ignorarse en Git. Publicar sólo `dist/`, sin las skills, documentos internos ni originales fuera del build.

### Contrato de configuración

Definir al comenzar P02 y mantener una sola fuente para:

```text
brandName: "JC Barberhouse"
whatsappDisplay: "+54 9 3329 60-6138"
whatsappNumber: "5493329606138"
instagramHandle: "jc_barberhouse"
instagramUrl: "https://www.instagram.com/jc_barberhouse/"
tiktokHandle: "jcbarberhouse"
tiktokUrl: "https://www.tiktok.com/@jcbarberhouse?_r=1&_t=ZS-9AfYPGAygh0"
addressText: "AVENIDA SAN MARTIN 743"
timeZone: "America/Argentina/Buenos_Aires"
locale: "es-AR"
bookingHorizonDays: 90
service: "Corte de pelo a domicilio"
```

El horizonte de 90 días es una decisión técnica editable, no una afirmación comercial. Indicar al visitante el rango permitido. Valores comerciales no confirmados deben permanecer ausentes, no rellenarse con datos ficticios.

## 8. Experiencia visual y contenido

### Dirección visual

- Identidad sobria ligada al logo monocromático: blanco, negro y grises con acento azul profundo tomado de las fotografías, sujeto a contraste medido.
- Logo original sobre superficie clara y a tamaño nítido; no redibujarlo ni sustituirlo por texto genérico.
- Tipografía de títulos con carácter editorial y cuerpo muy legible; limitar familias y pesos. Preferir recursos locales o fuentes de sistema, con fallback funcional.
- Hero con una fotografía real de corte, titular claro y CTA “Solicitar turno”. Evitar texto sobre zonas de imagen que impidan lectura.
- Galería con recortes conscientes: preservar el corte de pelo y no estirar fotografías.
- Animaciones discretas y opcionales; respetar `prefers-reduced-motion`.
- Navegación y CTA accesibles con una mano. Un botón flotante de WhatsApp no debe tapar campos, pie ni foco.

### Secciones obligatorias

1. **Encabezado:** logo, enlaces a Cortes, Turnos, Ubicación y contacto.
2. **Hero:** “JC BARBER”, propuesta de corte a domicilio y CTA al calendario.
3. **Cortes:** desde D23 no hay sección independiente; las cinco fotografías reales (más `certificados.jpeg`) rotan en el carrusel del hero con texto alternativo descriptivo y control de pausa.
4. **Cómo pedir un turno:** instrucciones dentro del formulario. Sección azul independiente retirada por D12.
5. **Calendario/formulario:** visible, accesible, con errores útiles y resumen antes del enlace.
6. **Ubicación:** `AVENIDA SAN MARTIN 743`; enlace `https://www.google.com/maps/search/?api=1&query=AVENIDA%20SAN%20MARTIN%20743`. Aclarar que es búsqueda por dirección, no ubicación geográfica verificada.
7. **Redes:** Instagram `@jc_barberhouse` y TikTok `@jcbarberhouse`, con los enlaces confirmados.
8. **Pie:** marca, teléfono, dirección y acceso a redes.

No depender de un feed embebido de Instagram ni de una API externa para mostrar las fotografías. La incorporación futura de más cortes debe resolverse mediante un manifiesto/configuración documentada, sin duplicar manualmente estructuras complejas.

## 9. Calendario y solicitud por WhatsApp

### Campos

| Campo | Regla |
| --- | --- |
| Nombre | Obligatorio, trim, 2–80 caracteres; permitir acentos, espacios y nombres reales |
| Servicio | Corte de pelo a domicilio, valor fijo visible |
| Fecha | Obligatoria, válida y dentro de hoy a hoy + 90 días según zona de Argentina |
| Hora preferida | Obligatoria, `HH:mm`, hora futura si la fecha es hoy |
| Dirección del domicilio | Obligatoria, trim, 5–180 caracteres |
| Localidad | Obligatoria, trim, 2–100 caracteres; permite coordinar cobertura sin inventarla |
| Comentarios | Opcional, máximo 300 caracteres |

La dirección del cliente es distinta de la ubicación de referencia de JC BARBER; no precargar una con la otra. No pedir número telefónico adicional por defecto: la conversación se inicia desde WhatsApp.

### Comportamiento

- Mes y días en español, semana de lunes a domingo, botones anterior/siguiente con nombres accesibles.
- Mostrar hoy, selección y días fuera de rango de forma comprensible sin depender sólo del color.
- Navegación por teclado: flechas entre días, Home/End dentro de la semana, PageUp/PageDown por mes, Enter/Espacio para seleccionar; foco gestionado y fecha elegida anunciada.
- Campo de fecha nativo etiquetado y sincronizado como alternativa accesible. Evitar dos valores de fecha que puedan divergir.
- No usar `new Date('YYYY-MM-DD')` como fecha local sin tratamiento: separar componentes y validar fecha civil, incluidos años bisiestos.
- Calcular “hoy” y “ahora” en la zona configurada; no basarse en UTC ni en la zona del dispositivo del visitante.
- Revalidar fecha/hora al enviar, incluso si el formulario quedó abierto al cambiar el día.
- Errores junto a los campos con `aria-describedby`, resumen accesible y foco en el primer error; conservar entradas válidas.
- Tratar entradas como texto: nunca interpolarlas mediante `innerHTML`. Construir URL con `URLSearchParams` o `encodeURIComponent`, evitando doble codificación.
- Abrir WhatsApp mediante una navegación vinculada al gesto del visitante para evitar bloqueos de popups. Si se usa una nueva pestaña, aplicar `noopener noreferrer`.
- Ofrecer un enlace directo visible a WhatsApp incluso si JavaScript falla; no afirmar que el calendario funciona sin JavaScript.
- No guardar nombres o domicilios en localStorage ni logs de pruebas; usar datos ficticios en automatización.

### Mensaje esperado

```text
Hola JC BARBER, quiero solicitar un turno para un corte de pelo a domicilio.
Nombre: {nombre}
Fecha preferida: {DD/MM/AAAA}
Hora preferida: {HH:mm} (hora de Argentina)
Domicilio: {direccion}
Localidad: {localidad}
Comentarios: {comentarios, omitir la línea si está vacío}
Quedo a la espera de confirmar disponibilidad. ¡Gracias!
```

URL final: `https://wa.me/5493329606138?text={mensaje_codificado}`. Las pruebas deben decodificar `text` y verificar contenido y teléfono exactos.

## 10. Tablero de ejecución y dependencias

Estados permitidos: `pendiente`, `en_curso`, `bloqueado`, `en_revision`, `hecho`. Cada fila reclamada debe registrar propietario/checkpoint en la columna de evidencia o en un handoff enlazado.

| ID | Entregable | Depende de | Estado inicial | Propietario / evidencia |
| --- | --- | --- | --- | --- |
| P00 | Inventario y alcance contrastados con la carpeta | — | hecho | Planificador; secciones 1 y 2 |
| P01 | Skills instaladas y verificadas | P00 | hecho | Planificador; CLI `skills list` y `skills-lock.json` |
| P02 | Base Vite/npm, estructura y contrato de configuración | P00, P01 | en_revision | Build exitoso; lockfile creado. npm ci bloqueado extrayendo en Windows; alternativa con integridad, falta validar instalación limpia |
| P03 | Imágenes derivadas y sistema visual | P02 | hecho | Coordinador; docs/DISENO.md, npm run images exitoso |
| P04 | Página responsive y contenido comercial | P03 | hecho | Ajustes D12/D13 aplicados; responsive 320/390/768/1440 verificado; capturas inspeccionadas |
| P05 | Fechas, mensaje y validación del turno | Contrato P02 definido | hecho | 18/18 unitarias aprobadas con marca JC Barberhouse |
| P06 | Calendario accesible y formulario integrado | P04, P05 | hecho | Flujos de fechas, validación, WhatsApp, teclado y axe aprobados en 4 proyectos |
| P07 | Pruebas automatizadas y correcciones | P06 | hecho | 48 casos E2E aprobados en dos ejecuciones; 18 unitarias. V18 permanece registrada en P02 |
| P08 | Optimización, SEO y auditoría final | P07 | bloqueado | Lighthouse ausente; npm install aislado interrumpido tras 120 s; sin puntuaciones inventadas |
| P09 | README, artefacto y handoff final | P08 | en_revision | README actualizado, build/portable generados y docs/evidence/VERIFICACION.md entregado; cierre integral pendiente de P08/V18 |

**Paralelismo previsto:** después de P02, P03/P04 pueden avanzar en paralelo con P05 si las asignaciones de archivos son disjuntas. P06 integra ambos resultados. QA puede preparar casos con el contrato de P02, pero no certificar interfaces aún inexistentes.

### Tablero R — reservas reales (encargo 2026-10-19)

| ID | Entregable | Depende de | Estado | Propietario / archivos |
| --- | --- | --- | --- | --- |
| R01 | Inventario, alcance y contrato RPC | — | hecho | Coordinador; archivos fuente y despliegue leídos, git sin cambios versionados; trabajo existente sin seguimiento conservado |
| R02 | Migración, seguridad, agenda y pruebas SQL | R01 | hecho (con pendiente externo) | Migración y suite SQL aprobadas en PGlite/PostgreSQL 18.6 y por 17 E2E; concurrencia nativa y PostgREST/JWT reales quedan pendientes del proyecto Supabase del propietario |
| R03 | Cliente API e integración pública | R01 | hecho | src/booking-api.js, src/online-booking.js integrados; 48/48 E2E del sitio en cuatro proyectos |
| R04 | Panel responsive privado | R01 | hecho | Panel /admin/ verificado en navegador; defectos de foco y validación de modalidades corregidos por el coordinador |
| R05 | Pruebas servidor y navegador | R02–R04 | hecho | playwright.booking.config.js + tests/booking; 17/17 aprobados sobre SQL real; evidencia docs/evidence/admin-390.png y admin-1440.png |
| R06 | Guía Supabase, primer admin, activación y handoff | R05 | hecho | docs/RESERVAS.md, README actualizado y handoff al final del plan |
| R07 | Recuperación de acceso, transferencia segura, actualización automática y Vercel | R06 | hecho | OpenCode 2026-10-20; 22/22 E2E + SQL, artefacto alternativo y guía; docs/evidence/ACCESO.md |
| R08 | Activar Supabase real, correo, cuentas, transferencia y despliegue; pruebas reales | R07 | bloqueado | Requiere proyecto/URL/clave pública del propietario y operaciones confiables en Auth/SQL; no se aportaron credenciales ni acceso remoto |
| R09 | Reserva pública: tres pasos, servicios, precios, calendario grande y horarios por modalidad | R07 | hecho | OpenCode 2026-10-21; docs/evidence/RESERVA_CLIENTE.md, artefacto dist-release; migración remota pendiente en R08 |
| R10 | Rediseño cuidado y responsive del formulario, conservando identidad y lógica | R09 | hecho | OpenCode 2026-10-21; docs/evidence/DISENO_RESERVA.md; artefacto actual dist-release/ |
| R11 | Tres pasos: cuatro tarjetas, calendario/lista de horarios, datos y WhatsApp | R10 | hecho | Coordinador y subagentes A/B/C cerrados; docs/evidence/TRES_PASOS.md; artefacto test-results/r11-three-final/ |
| R12 | Tarjetas según referencia, animación hover, domicilio $30.000 | R11 | hecho | Coordinador y subagente de precio/SQL; "Checkpoint R12 — verificado" al final del plan |
| R13 | Íconos Tabler oficiales, fondo de sección en --paper, tarjetas centradas | R12 | hecho | Coordinador; "Checkpoint R13 — 2026-10-23" al final del plan |
| R14 | Galería retirada; carrusel automático de fotos en el hero | R13 | hecho | Coordinador 2026-10-24; "Checkpoint R14" al final del plan; D23 |
| R15 | Dos servicios en el paso 1 y panel de extras bajo el corte general | R14 | hecho | Coordinador 2026-10-25; "Checkpoint R15" al final del plan; D24 |
| R16 | Domicilio $20.000 lun–sáb / $30.000 domingo y bloque de membresías con condiciones en el paso 1 | R15 | hecho | Coordinador 2026-10-25; "Checkpoint R16" al final del plan; D25 |
| R17 | Condiciones de la membresía centradas, domingos sólo de corte a domicilio y responsive 320–1440 | R16 | hecho | Coordinador 2026-10-25; "Checkpoint R17" al final del plan; D26; `test-results/r17-check.mjs` 58/58 + regresiones |
| R18 | Horarios por modalidad: local 09:00–12:30 / 16:30–20:30 (30 min) y domicilio 07:00–08:30 / 12:45–15:45 (45 min) | R17 | hecho | Coordinador 2026-10-25; "Checkpoint R18" al final del plan; D27; `test-results/r18-check.mjs` 60/60 + regresiones |
| R19 | "Continuar" en ambos cortes, salto al paso siguiente con scroll y avance automático al registrarse | R18 | hecho | Coordinador 2026-10-25; "Checkpoint R19" al final del plan; D28; `test-results/r19-check.mjs` 68/68 + regresiones |

Checkpoint R01: esfuerzo no expuesto; compactación no invocable. Se delegan dos unidades independientes según sección 5. Contrato: RPC public_catalog(), available_slots(p_service,p_mode,p_date), create_booking(p_data), admin_snapshot(p_from,p_to), admin_save_config(p_data), admin_booking(p_data), admin_block(p_data). Cliente compartido implementado únicamente por coordinador. Sin credenciales Supabase detectadas; conexión remota pendiente de configuración del propietario.

Checkpoint de recuperación 2026-10-17: Git y disco reconciliados. Hay HTML/CSS/main/config, script de imágenes y módulos de reserva con 18 unitarias; no hay lockfile ni derivados ni QA de navegador. La asignación anterior terminó según su handoff; no hay subagentes activos. El coordinador retoma todos los archivos. Se inspeccionaron visualmente logo y cinco fotos. npm registry responde y se comprobaron versiones/engines. Esfuerzo no configurable desde esta sesión; compactación no invocable. Se preserva trabajo previo y originales.

### P02 — Base técnica

- Crear `package.json`, `.gitignore`, configuración de desarrollo y módulos base sin scaffolds interactivos.
- Instalar dependencias de desarrollo necesarias: Vite, Playwright Test, axe y herramienta de optimización de imágenes compatible con Node detectado.
- Elegir versiones compatibles en el momento de ejecución y guardar `package-lock.json`; no usar una versión recordada sin comprobar compatibilidad.
- Definir contrato de configuración, nombres de exports y propiedad de archivos antes de delegar.
- Crear scripts `dev`, `build`, `preview`, `images`, `test:unit`, `test:e2e` y `check`. Los scripts deben fallar con código distinto de cero ante un error real y no abrir modo interactivo/watch.
- `check` debe encadenar unitarias, build y E2E sobre el build de producción, deteniéndose ante fallo.
- **Aceptación:** instalación reproducible, arranque y build mínimos correctos; contratos documentados.

### P03 — Assets e identidad

- Inspeccionar las cinco fotografías, registrar dimensiones, orientación y focalización del recorte.
- Generar WebP/AVIF cuando aporte valor, JPEG fallback y tamaños responsive con dimensiones declaradas; conservar originales intactos.
- Definir tokens de color, espaciado, tipografía, foco y breakpoints según contenido.
- Generar favicon fiel al recurso disponible sin inventar una marca distinta.
- **Aceptación:** los seis recursos originales tienen una representación utilizable; sin distorsión ni ampliación excesiva; script de imágenes reproducible y sin crecimiento por duplicación.

### P04 — Página y contenido

- Construir las ocho secciones, navegación de anclas y menú móvil si hace falta.
- Integrar imágenes con `srcset`, `sizes`, ancho/alto y carga diferida sólo fuera del primer pantallazo.
- Incluir teléfono, dirección, Instagram y servicio exactos; navegación externa segura.
- **Aceptación:** estructura semántica, un `h1`, enlaces reales, contenido legible en 320, 390, 768 y 1440 px, sin desplazamiento horizontal.

### P05 — Lógica de reservas

- Crear funciones puras para fechas, validación, formato de mensaje y URL.
- Incluir pruebas relevantes para límites temporales, zona horaria y caracteres especiales.
- Definir cómo interactúan calendario, campo nativo y formulario sin duplicar estado.
- **Aceptación:** una solicitud válida produce el mensaje correcto y una inválida no genera navegación; pruebas unitarias exitosas.

### P06 — Integración del flujo

- Implementar calendario, campos, validación accesible y resumen del turno solicitado.
- Enlazar todos los CTA al formulario o al contacto directo según su etiqueta.
- Implementar estado “Continuar en WhatsApp” sin declarar envío o confirmación.
- **Aceptación:** flujo completo operable por teclado y táctil, persistencia de valores durante errores y URL correcta.

### P07 — QA automático

- Implementar la matriz de pruebas de la sección 11 y ejecutar contra el build servido localmente.
- Capturar errores de consola, fallos de recursos propios, screenshots y trazas al fallar.
- Corregir causas, no ocultar fallos con esperas arbitrarias, exclusiones o asserts debilitados.
- **Aceptación:** pruebas obligatorias en verde y evidencias vinculadas a la revisión del código comprobado.

### P08 — Rendimiento, SEO y acabado

- Título y descripción reales, metadatos sociales y datos estructurados `HairSalon` limitados a información confirmada.
- No agregar dominio canónico, ciudad, coordenadas ni horario ficticios. Configurar canonical, sitemap y URLs sociales absolutas cuando exista URL de despliegue real.
- Auditar contraste, foco, reduced motion, tamaños de imagen y presupuesto de recursos.
- Ejecutar Lighthouse móvil sobre producción; objetivo Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95 y SEO ≥ 90. Registrar versión, condiciones y resultado; si no se llega, corregir y documentar la causa concreta.
- Objetivos de laboratorio: LCP ≤ 2,5 s, CLS ≤ 0,1 y JS inicial propio ≤ 80 KB gzip. INP ≤ 200 ms queda como objetivo de campo, no como métrica certificada sin tráfico real.
- **Aceptación:** objetivos medidos o incumplimientos explícitos resueltos antes de declarar cierre completo; sin regresión funcional por optimización.

### P09 — Entrega reproducible

- Crear README con requisitos, comandos, cambio de imágenes/datos y publicación del directorio `dist/`.
- Ejecutar la comprobación final apropiada y guardar su resumen. No repetir auditorías completas si no cambió nada relevante desde la evidencia válida.
- Documentar el alcance real del calendario, los datos pendientes del negocio y cómo ampliarlo a una agenda real si se requiere en otro encargo.
- Actualizar el Estado operativo, tablero y handoff final con pendientes y mejoras priorizadas.
- **Aceptación:** otro agente puede iniciar y verificar la web sólo con el repositorio y README; todos los criterios obligatorios están cumplidos o identificados como bloqueo, sin ocultarlos.

## 11. Matriz de verificación automática

Las siguientes verificaciones las ejecuta el agente. No requieren que el usuario compruebe visualmente la página ni envíe mensajes reales.

| ID | Caso | Resultado verificable |
| --- | --- | --- |
| V01 | Carga de producción | Página responde, logo y cinco fotos cargan (`naturalWidth > 0`), sin errores JS ni 404 propios |
| V02 | Datos comerciales | Nombre, teléfono, domicilio y enlace Instagram exactos en la UI |
| V03 | Responsive | Sin overflow horizontal en 320, 390, 768 y 1440 px; CTA y formulario visibles |
| V04 | Calendario | Mes anterior/siguiente, cruce de año, años bisiestos y selección sincronizada |
| V05 | Rango temporal | Rechaza ayer, fecha imposible y día posterior al horizonte; acepta extremos válidos |
| V06 | Zona horaria | Con reloj fijo cerca de medianoche UTC y navegador en otra zona, usa el día de Argentina |
| V07 | Hora | Rechaza hora pasada de hoy y formatos inválidos; revalida después del paso del tiempo |
| V08 | Formulario inválido | Campos vacíos/espacios y longitud excedida muestran errores; no abre WhatsApp |
| V09 | WhatsApp válido | Host y número exactos; mensaje decodificado contiene nombre, fecha, hora y domicilio |
| V10 | Texto especial | Acentos, `&`, `+`, `#`, saltos y texto similar a HTML no rompen URL ni ejecutan contenido |
| V11 | Comentarios vacíos | No aparece una línea vacía de comentarios ni `undefined` en el mensaje |
| V12 | Teclado | Orden de foco, navegación del calendario y foco de errores correctos; menú/visor si existen |
| V13 | Accesibilidad automática | axe sin violaciones serias/críticas; labels y contraste verificados; revisar otros hallazgos |
| V14 | Enlaces | Instagram, Maps y CTA apuntan al destino previsto; enlaces de nueva pestaña protegidos |
| V15 | Sin JavaScript | Contacto directo, dirección y contenido comercial siguen disponibles |
| V16 | Movimiento reducido | No hay animaciones imprescindibles ni desplazamientos forzados con reduced motion |
| V17 | Navegadores | Flujo principal en Chromium, Firefox y WebKit; emulación móvil documentada |
| V18 | Build reproducible | `npm.cmd ci` y scripts registrados funcionan desde dependencias limpias |

Para V09 interceptar la navegación o popup hacia `wa.me` y examinar la URL. No automatizar la cuenta de WhatsApp ni enviar una reserva real como prueba. La disponibilidad del servicio externo no se deduce de un test local.

Playwright debe administrar el servidor de preview, puertos y cierre de procesos. Preferir selectores por rol/etiqueta y esperas por estados observables. Fijar el reloj en casos de fechas; no escribir tests que dependan del día real de ejecución.

Screenshots automáticos deben ser examinados por el agente para detectar recortes, solapamientos o jerarquía deficiente. Los checks automáticos de accesibilidad no equivalen a certificar toda la experiencia con lectores de pantalla.

### Comandos objetivo para la fase de implementación

Los scripts están implementados. Ejecutar desde la raíz. En PowerShell, usar `.cmd` y comprobar el éxito de cada comando dependiente. La instalación limpia sigue pendiente de certificación según P02/V18.

```powershell
npm.cmd ci
npm.cmd run images
npx.cmd playwright install chromium firefox webkit
npm.cmd run check
```

`npm.cmd ci` requiere el lockfile generado por la instalación inicial de P02. El primer bootstrap usará `npm.cmd install` con las dependencias seleccionadas. Versionar la configuración de Lighthouse y su comando cuando se añada en P08, para repetir la misma medición.

## 12. Criterio de finalización

El coordinador sólo declara la web terminada cuando:

- [x] Están las secciones vigentes según D12 (sin bloque azul independiente), logo original y cinco cortes reales.
- [x] Se destaca el servicio a domicilio y se muestra `AVENIDA SAN MARTIN 743`.
- [x] Instagram abre `jc_barberhouse`, TikTok `jcbarberhouse` y WhatsApp usa `5493329606138`.
- [x] Calendario y formulario funcionan; validan fecha/hora y datos requeridos.
- [x] WhatsApp recibe texto precargado correcto al abrir el enlace; la UI explica que la disponibilidad se confirma allí.
- [x] La página funciona en móvil y escritorio, con teclado, foco visible y textos legibles.
- [ ] Las verificaciones obligatorias tienen evidencia satisfactoria y no hay errores críticos conocidos.
- [ ] El build de producción y las comprobaciones son reproducibles con comandos documentados.
- [x] El README permite actualizar contenido y publicar el artefacto.
- [x] Estado operativo, tablero y handoff coinciden con los archivos reales.

Una herramienta bloqueada o una prueba no ejecutada se registra como tal; no se convierte en un check aprobado. Distinguir claramente “lista para publicar” de “publicada”: esta última exige URL real y verificación del despliegue.

## 13. Handoff obligatorio por agente

Completar esta plantilla al terminar, al pausar, antes de compactar y al entregar una subtarea. Registrar resultados observables, no razonamientos internos extensos.

```markdown
### Handoff <ID> — <fecha/hora ISO con zona> — <agente/sesión>
- Tarea y estado:
- Dónde quedó exactamente:
- Qué se implementó / investigó:
- Archivos creados o modificados:
- Decisiones nuevas y motivo:
- Verificaciones ejecutadas: comando, resultado y ruta de evidencia.
- Qué falta / dependencias / bloqueos:
- Qué salió bien: hechos concretos.
- Qué salió mal: error, causa conocida, corrección o pendiente; si no hubo, indicarlo.
- Mejoras del producto o del plan: prioridad, beneficio y condición de ejecución.
- Próximo paso exacto:
- Archivos/tareas que siguen reservados y propietario:
- Contexto/compactación: indicador conocido o estimación, checkpoint y mecanismo usado.
```

El coordinador mantiene el último handoff vigente al final de este documento. Si el historial crece demasiado, archivar entradas antiguas en `docs/handoffs/` y dejar enlaces, sin borrar decisiones ni evidencia relevante.

## 14. Mejora continua acotada

Antes de iniciar otra fase, evaluar defectos o mejoras detectados y clasificarlos:

- **P0:** flujo roto, contacto incorrecto, error de fechas, pérdida de datos o inaccesibilidad que impida reservar. Resolver antes de continuar.
- **P1:** mejora necesaria para la definición de terminado: legibilidad, rendimiento, cobertura de pruebas o documentación incompleta.
- **P2:** evolución posterior: agenda real con bloqueo de turnos, administración de disponibilidad, recordatorios, analítica o CMS. Registrar sin convertirlo automáticamente en alcance del MVP.

Cada mejora debe indicar problema observado, resultado esperado, archivo/tarea afectados y prueba de aceptación. El cierre ocurre al cumplir el alcance y su calidad, no al agotar todas las ideas posibles.

### Mejoras ya identificadas

| ID | Prioridad | Mejora | Condición |
| --- | --- | --- | --- |
| M01 | P1 | Confirmar dimensiones y optimizar fotos | Parte de P03 |
| M02 | P2 | Completar ciudad para Maps y SEO local exactos | Cuando el negocio la proporcione; no inferirla por prefijo telefónico |
| M03 | P2 | Horarios reales y zona de cobertura | Cuando haya datos confirmados; mientras tanto solicitud sujeta a confirmación |
| M04 | P2 | Logo de mayor resolución/vectorial | Cuando exista material original de mejor calidad |
| M05 | P2 | Agenda con cupos reales y protección ante dobles reservas | Requiere nuevo alcance, backend y reglas de negocio |
| M06 | P2 | Carrusel del hero con derivados WebP/JPEG de `public/images/` en lugar de los JPEG originales de la raíz | Cuando el build de Vite vuelva a funcionar (faltan `src/config.js` y `src/gallery.js`); con servidor estático en la raíz esos derivados no son accesibles |

## 15. Último handoff — planificación inicial

> Histórico. El checkpoint más reciente está al final del documento.

- **Fecha:** 2026-10-16; no se registró hora exacta.
- **Agente:** asistente principal de OpenCode, sesión de planificación.
- **Dónde quedó:** plan y entrada `AGENTS.md` preparados. P00 y P01 terminadas. P02 es la primera tarea de implementación.
- **Qué se hizo:** inventario de raíz, lectura del HTML vacío, inspección de logo y una foto, revisión de CLI e instalación de cuatro skills; definición de arquitectura, calendario, pruebas, autonomía, continuidad y coordinación.
- **Archivos añadidos:** `PLAN_IMPLEMENTACION.md`, `AGENTS.md`, `.agents/skills/` y `skills-lock.json`.
- **Verificaciones:** instalaciones con código de salida satisfactorio; `npx.cmd --yes skills list` y lectura de `.agents/skills/` confirman las cuatro skills; lockfile contiene sus fuentes y hashes. Revisión de secciones, dependencias y contactos realizada. `git diff --no-index --check -- NUL "PLAN_IMPLEMENTACION.md"` y el equivalente para `AGENTS.md` finalizaron sin errores de whitespace; Git sólo anunció su conversión habitual LF/CRLF. `git status --short` confirma los documentos y skills añadidos junto al material inicial sin seguimiento.
- **Qué falta:** implementar P02–P09; inspeccionar visualmente `corte2.jpeg` a `corte5.jpeg`; ejecutar pruebas reales sobre la futura web.
- **Qué salió bien:** los recursos proporcionados y el alcance permiten avanzar sin una entrevista inicial; las skills se instalaron sin menús; quedan contratos y criterios que evitan decisiones repetidas.
- **Qué salió mal:** `npm --version` intentó ejecutar `npm.ps1` y fue bloqueado por PowerShell; se resolvió con `npm.cmd`. Git advirtió que no puede acceder a `jcbarber/`; la carpeta no se inspeccionó y no bloquea el trabajo en la raíz. La comprobación de la ruta temporal sugerida por el harness devolvió `False`; no fue necesaria para la entrega.
- **Mejoras del plan:** mantener una sola fuente de avance; registrar esfuerzo real en vez de prometerlo; probar fechas en distintas zonas; separar solicitud de confirmación y dirección del cliente de dirección de referencia.
- **Próximo paso:** reconciliar estado y reclamar P02 antes de crear la base técnica, cuando el encargo sea ejecutar este plan.
- **Reservas activas de archivos:** ninguna.
- **Compactación:** no ejecutada; el protocolo y la alternativa sin comando invocable están documentados.

### Handoff de recuperación — 2026-10-17 — coordinador

- Se recuperaron la página completa y módulos de reserva de sesión anterior, preservando originales.
- Se inspeccionaron las cinco fotos y logo, se generaron WebP/JPEG, se actualizó nombre visible a JC Barberhouse (pedido actual). Diseño en docs/DISENO.md.
- Build Vite exitoso y 18/18 unitarias. Playwright Chromium/Firefox/WebKit descargados. E2E/axe escritos y pendientes de ejecución.
- Fallo de entorno: npm install/ci, incluso npm 10/offline, se atascan durante extracción. Registro en npm-cache; descargas HTTP sí funcionan. Script install-windows.mjs verifica integridad y permite recuperar paquetes específicos; no se considera npm ci aprobado. Cache-dependencies.mjs no resolvió la extracción.
- Archivos: HTML/CSS/config, tests, configuración Playwright, lockfile, scripts de recuperación y docs. Un único coordinador, sin subagentes activos.
- Próximo paso: ejecutar imágenes/build/E2E, inspeccionar capturas, resolver fallos; luego P08/P09 y V18.
- Acierto: reutilización de lógica verificada y fotografías propias. Mejora: limitar tiempo de diagnóstico npm y priorizar pruebas de la aplicación; registrar instalación como limitación si persiste.
- Contexto: checkpoint autosuficiente, sin medidor preciso ni compactación invocable; continuar con archivos imprescindibles.

### Checkpoint — 2026-10-18 — ajustes solicitados

- Disco reconciliado con Git: aplicación completa sin seguimiento; README, plugin de contenido, build portable y auditoría ya existían aunque el estado previo no los recogía. Se preservan originales y trabajo previo.
- Se eliminó `#experiencia`, su ancla del menú y CSS exclusivo; se agregó TikTok a configuración, contacto, pie y JSON-LD; SVG WhatsApp reemplazado por Tabler oficial en el símbolo compartido.
- Archivos: `index.html`, `src/styles.css`, `src/config.js`, `src/main.js`, `scripts/content-plugin.mjs`, este plan. Sin subagentes activos; coordinador único.
- Verificación pendiente: build, E2E/axe, inspección de capturas y Lighthouse. README enlazaba `docs/evidence/VERIFICACION.md`, inexistente; se completará con resultados reales.
- Esfuerzo no configurable desde esta sesión; compactación no invocable. Próximo paso: verificar producción y corregir defectos observados antes de actualizar tablero final.

### Checkpoint — 2026-10-18 — QA y auditoría

- `npm.cmd run check`: 18 unitarias y build aprobados; los 12 casos Chromium y los primeros 5 Firefox pasaron, pero el comando alcanzó el límite de herramienta (240 s). Se completaron Firefox/WebKit/móvil con `npm.cmd run test:e2e -- --project=firefox --project=webkit --project=mobile`: 36/36 aprobados en 2,9 min. Total de 48 casos distintos aprobados.
- Capturas `docs/evidence/page-390.png` y `page-1440.png` examinadas: sección azul ausente, TikTok visible, iconografía correcta, sin solapamientos observados.
- `npm.cmd run audit:performance` falla por `ERR_MODULE_NOT_FOUND` de Lighthouse. Intento aislado `npm.cmd install --prefix C:\Users\Usuario\AppData\Local\Temp\opencode\jcbarber-audit-20261018 --no-audit --no-fund --ignore-scripts lighthouse@13.5.0` sin salida, interrumpido por timeout a 120 s. No modificar la instalación funcional del proyecto.
- P08: hero utilizaba JPEG original declarado como WebP en `srcset`; se corrigió a derivados existentes de la misma foto `corte1` y alt fiel. Favicon ahora apunta al PNG generado. Falta build final y verificación focalizada de esos assets.
- Licencia oficial de los dos íconos Tabler incluida en `public/tabler-icons-LICENSE.txt` para distribuirla en el build.

### Handoff — 2026-10-18 — coordinador OpenCode

- **Dónde quedó:** los tres cambios del usuario están aplicados y verificados. `dist/index.html` y `dist/jc-barberhouse.html` regenerados. P04/P06/P07 hechos; P02/V18 y P08 pendientes por instalación/rendimiento; P09 con documentación y artefacto entregados, en revisión hasta cierre integral.
- **Cambios:** sección azul retirada junto con su navegación y CSS; TikTok exacto en contacto/pie/configuración/JSON-LD, disponible sin JS; WhatsApp oficial Tabler en todos los usos. Hero apunta a WebP responsive real de la misma foto, favicon a PNG generado. Licencia de Tabler incluida.
- **Archivos:** `index.html`, `src/styles.css`, `src/config.js`, `src/main.js`, `scripts/content-plugin.mjs`, `public/tabler-icons-LICENSE.txt`, `README.md`, `docs/evidence/VERIFICACION.md`, capturas finales y este plan. Originales preservados. Sin commits ni publicación.
- **Pruebas:** 18 unitarias; los 48 casos E2E distintos aprobados en dos ejecuciones; 20 casos focalizados sobre assets/build final aprobados; smoke con/sin JS valida TikTok, JSON-LD, anclas, SVG y WebP. Capturas 390/1440 examinadas. Comandos y resultados detallados en `docs/evidence/VERIFICACION.md`.
- **Aciertos:** uso de símbolo SVG compartido corrige todos los íconos WhatsApp; config y plugin mantienen TikTok incluso sin JavaScript; cuatro proyectos de navegador pasan axe y flujos; presupuesto JS 5,89 kB gzip.
- **Fallos:** primer `check` interrumpido por timeout global de herramienta, resuelto completando proyectos restantes con mayor límite. Build final encontró `EPERM` transitorio en `dist/images`, reintento aprobado sin cambiar permisos. Lighthouse ausente y npm aislado sin completar a 120 s; no hay medición ni instalación limpia aprobada.
- **Mejoras concretas:** P1 resolver entorno de instalación, certificar V18 y ejecutar Lighthouse; usar límite de al menos 10 min para suite completa en este equipo. P2 dominio/ciudad/horarios siguen condicionados a datos confirmados. No rehacer QA funcional sin cambios relevantes.
- **Próximo paso exacto:** recuperar instalación de Lighthouse en entorno funcional, `npm.cmd run audit:performance`; certificar `npm.cmd ci` de forma limpia y comprobación final. Actualizar P02/P08/P09 sólo con evidencia satisfactoria.
- **Archivos reservados:** ninguno; sin subagentes activos. Coordinador único.
- **Contexto:** esfuerzo no expuesto, compactación no invocable. Checkpoints y handoff autosuficientes guardados; no se afirma compactación ejecutada.

### Handoff R — 2026-10-19 — coordinador Freebuff

- **Tarea y estado:** R01–R06 completadas (R02 con pendiente externo de concurrencia nativa/PostgREST real). El sistema de reservas reales y el panel privado están integrados, verificados y documentados.
- **Dónde quedó exactamente:** toda la aplicación en la raíz accesible; `dist/` regenerado en modo sin Supabase (flujo WhatsApp por defecto). La reserva online se activa definindo `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` y reconstruyendo.
- **Qué se implementó / verificó en esta sesión:**
  - Corrección de los dos defectos hallados por revisión estática de R04 en `src/admin.js`: (1) `openBooking` guarda el botón de origen y `closeBooking` devuelve el foco a ese elemento exacto (fallback al primer botón del turno y a `#agenda-date`); (2) `configData()` exige al menos una modalidad en **todos** los servicios, activos o borradores, igual que el CHECK SQL `cardinality(modes) between 1 and 2`.
  - Nueva configuración `playwright.booking.config.js`: build de producción apuntando a `https://booking.test` (variables validadas por `vite.config.js`), preview en `127.0.0.1:4174`, Chromium, servidor propio; scripts `build:booking`, `preview:booking` y `test:booking` en `package.json`.
  - Documentación R06: `docs/RESERVAS.md` (guía de activación: Supabase, primer admin, activar agenda, panel, prueba de reserva y checklist de producción) y README actualizado (funciones, comandos, publicación con/sin reservas, archivos y datos pendientes).
- **Archivos creados o modificados:** creados `playwright.booking.config.js`, `docs/RESERVAS.md`; modificados `src/admin.js` (foco + modalidades), `package.json` (3 scripts), `README.md`, `PLAN_IMPLEMENTACION.md`. Sin tocar el diseño, el HTML público ni la migración.
- **Verificaciones ejecutadas:**
  - `npm.cmd run test:unit`: 18/18.
  - `node supabase/tests/run-pglite.mjs`: bootstrap + migración + suite SQL (PGlite 0.5.10 / PostgreSQL 18.6) — PASS.
  - `npm.cmd run build` y build de reserva con variables de prueba — exitosos.
  - `npx.cmd playwright test --config=playwright.booking.config.js`: **17/17 aprobados (8 min, EXIT=0)** sobre la migración SQL real interceptada por `tests/booking/db-fixture.js`; incluye axe sin violaciones, foco restaurado (la corrección resuelve la aserción prevista), responsive 320/390/768/1440 y capturas `docs/evidence/admin-390.png` y `admin-1440.png` examinadas visualmente: sin solapamientos, recortes ni jerarquía deficiente.
  - `npx.cmd playwright test` (sitio, build sin Supabase): **48/48 aprobados (9,5 min, EXIT=0)** en Chromium/Firefox/WebKit/móvil; conserva el flujo WhatsApp cuando no hay backend.
- **Qué falta / dependencias:** aplicar la migración en el Supabase real del propietario y crear el primer administrador (RESERVAS.md §§2–3); cargar días reales, precios, duraciones, descansos y traslados y habilitar la agenda (§4); certificar concurrencia nativa con dos conexiones (`JC_TEST_DATABASE_URL`) y el flujo PostgREST/JWT real; P08 (Lighthouse/instalación limpia) sigue abierto por el entorno.
- **Qué salió bien:** las 17 pruebas del panel pasaron a la primera tras las correcciones; el fixture ejecuta RPC/GRLS reales, no respuestas prefabricadas; la suite del sitio confirma que el diseño y el flujo por WhatsApp quedaron intactos sin backend.
- **Qué salió mal:** dos corridas iniciales de la suite de reservas se perdieron por un pipe a `tail` y por un servidor preview huérfano en el puerto 4174 (resuelto con `taskkill` y log a disco); ningún defecto de la aplicación apareció en ejecución.
- **Mejoras concretas:** P1 ejecutar concurrencia nativa y smoke contra un proyecto Supabase real antes de abrir reservas; P2 recordatorios WhatsApp e informes (registrados en RESERVAS.md §7).
- **Próximo paso exacto:** seguir `docs/RESERVAS.md` §§2–4 con las credenciales del propietario; después una reserva de prueba real (§6) y publicar `dist/` con las variables definidas.
- **Archivos reservados:** ninguno; sin subagentes activos. Coordinador único.
- **Contexto:** esfuerzo no expuesto por el harness; compactación no invocable. Checkpoint y handoff autosuficientes guardados en este documento.

### Checkpoint R07 — 2026-10-20 — diagnóstico antes de editar

- Git/disco reconciliados; los archivos existentes sin seguimiento se conservan. Sin configuración local Supabase ni credenciales remotas aportadas.
- Causa del formulario bloqueado: `fieldset disabled` condicionado a variables Supabase; abrir módulos Vite con file:// tampoco funciona. Auth por contraseña y autorización SQL ya existen.
- Faltan recuperación, transferencia verificable y refresco automático. Se informa el diagnóstico al usuario antes de modificar aplicación.
- Se reutiliza el CSS actual. Transferencia mediante funciones privadas ejecutadas desde SQL Editor y confirmación autenticada del destinatario; nunca auto-registro de administradores.
- Esfuerzo no configurable/expuesto; compactación no invocable. Próximo paso: completar R07 y pruebas focalizadas; activación remota sigue dependiendo del proyecto del propietario.

### Checkpoint R07 — 2026-10-20 — implementación y primera verificación

- Implementados recuperación/invitación Auth (tokens sólo en memoria y retirados de URL), mensajes de login sin bloquear escritura por falta de configuración, transferencia con confirmación del destinatario y finalización SQL atómica, refresco automático a 15 s/foco y configuración Vercel.
- Nueva migración `202610200001_admin_handover.sql`: RLS forzada, prepare/complete sólo desde SQL confiable, RPC de confirmación restringida al destinatario. Finalizar retira todos los otros UUID del allowlist. No se altera la migración anterior ni los datos existentes.
- SQL: `node supabase/tests/run-pglite.mjs` PASS (ambas migraciones + suite original). `npm.cmd run test:booking -- access.spec.js`: 5/5 PASS, incluye dos páginas, recuperación/invitación, permisos SQL y revocación con JWT anterior.
- Primer build falló por EPERM transitorio al recrear dist/images; reintento exitoso sin cambios de permisos. Auth sigue simulado en E2E; no certificar correos/JWT/concurrencia nativa sin Supabase real.
- Pendiente inmediato: documentación exacta, regresión de los 17 casos existentes y ampliar recorrido de cancelación/confirmación vencida. Sin subagentes ni reservas externas. Checkpoint preventivo; no hay compactación invocable.

### Handoff R07 — 2026-10-20 — coordinador OpenCode

- **Estado:** R07 hecho y verificado localmente; R08 bloqueado por Supabase real. No se afirma sistema activado ni publicado.
- **Dónde quedó:** fuente en raíz, misma UI/CSS; artefacto actual `dist-release/` sin conexión real. `dist/` quedó incompleto por EPERM persistente en `dist/images`; no usarlo. Desarrollo con `npm.cmd run dev`; preview alternativo `npm.cmd run preview -- --outDir dist-release`.
- **Cambios:** login editable y diagnóstico explícito; correo/contraseña Auth con errores mapeados; recuperación/invitación y cambio de contraseña con tokens sólo en memoria; formularios Auth POST y referrer no-referrer; transferencia prepare/confirm/complete con allowlist SQL y confirmación reciente del destinatario; refresco de agenda/disponibilidad cada 15 s/foco; `vercel.json` y guía de entrega incluyendo permisos de infraestructura.
- **Archivos:** `admin/index.html`, `src/{booking-api,admin,online-booking}.js`, nueva migración `202610200001_admin_handover.sql`, `vercel.json`, fixture y nuevas pruebas acceso/setup, configs Playwright, runner PGlite, portable con argumento de salida, `.gitignore`, README, docs/RESERVAS, supabase/README, docs/evidence/ACCESO y este plan. Sin cambios de CSS/fotos/precios ni commits/publicación.
- **Pruebas:** 22/22 E2E reservas/acceso (incluye 17 regresiones); 18/18 unitarias; 12/12 sitio/setup Chromium y 2/2 smoke sobre artefacto alternativo; SQL/migraciones PASS. Capturas 390/1440 inspeccionadas. Comandos y límites en `docs/evidence/ACCESO.md`.
- **Aciertos:** el flujo entre dos páginas y la revocación con sesión anterior se verifican sobre SQL real, no sobre permisos simulados. La entrega requiere identidad destinataria y corte atómico; las salidas de pruebas ahora no contaminan el build publicable.
- **Fallos:** EPERM impide limpiar/recrear dist/images; un reintento inicial funcionó, los posteriores no. Resuelto para entrega con salida alternativa sin alterar permisos; instalación limpia/Lighthouse siguen pendientes históricos. Auth simulado no certifica SMTP/JWT ni carrera multi-conexión.
- **Pendientes/próximo paso exacto:** seguir docs/RESERVAS §§2–4 y 8 con proyecto real; aplicar migraciones en orden, desactivar auto-registro, configurar URLs/SMTP, invitar temporal y autorizar UUID. Activar datos reales, probar reserva/cancelación/bloqueo, ejecutar concurrencia en base descartable, entregar según §9 y publicar según §10. No pegar claves privadas ni contraseñas en chat/código.
- **Mejoras concretas:** P1 completar R08 y certificar npm ci en Vercel/entorno limpio; P1 resolver bloqueo local antes de volver al output dist; P2 WebSocket/avisos push sólo si polling de 15 s deja de cubrir la operación.
- **Continuidad:** coordinador único; ningún subagente ni archivo reservado. Esfuerzo no configurable, compactación no invocable; checkpoint/handoff autosuficientes en disco.

### Checkpoint R09 — 2026-10-21 — relevamiento

- Git/disco reconciliados; todos los archivos previos sin seguimiento se conservan. Existe `.env` local; no se expone su contenido ni se presume activación remota.
- Formulario actual comparte HTML para WhatsApp y Supabase; se actualizarán ambos flujos. Calendario accesible reutilizable y rango argentino ya implementados.
- Diseño: conservar paleta/tipografías actuales, servicios primero, calendario protagonista a la izquierda y datos a la derecha dentro del paso 2, confirmación debajo. En móvil todo en una columna. La numeración representa los tres pasos pedidos.
- Esfuerzo no expuesto/configurable; compactación no invocable. Próximo paso: implementar R09 y comprobar formularios y límites horarios.

### Checkpoint R09 — 2026-10-21 — implementación y QA inicial

- Formulario reorganizado, comentarios retirados, catálogo confirmado y selector de horarios implementados en `src/services.js`. Validación de nombre/apellido y dirección condicional. Calendario amplio reutiliza teclado/rango argentino y avisa al cambiar el día.
- Modo conectado conserva RPC, reintentos y comprobante; filtra los bloques 30/45 y agrega WhatsApp con datos del comprobante. Migración `202610210001_customer_services.sql` preparada para catálogo/franjas, conservando reservas y activación por día. Aplicación remota pendiente.
- 22/22 unitarias y 16/16 E2E Chromium (incluye axe, portable y responsive) PASS. Capturas revisadas; se amplía el selector de horarios a ancho completo en móvil y se corrige evidencia tapada por header fijo durante screenshot de elemento.
- Primer build terminó por timeout; segundo exitoso. Primera suite web falló porque asignar variables vacías en PowerShell elimina las variables y Vite leyó `.env`. Corregido para pruebas asignando variables vacías dentro de Node antes de importar Vite; build aislado `test-results/customer-offline/`, sin modificar `.env`.
- Pendiente inmediato: ejecutar pruebas conectadas nuevas y regresión de acceso, suite SQL, validación móvil/Firefox/WebKit y build final/documentación. Coordinador único; sin subagentes. Checkpoint preventivo, compactación no invocable.

### Handoff R09 — 2026-10-21 — coordinador OpenCode

- **Dónde quedó:** pedido del index implementado y verificado. Fuentes en raíz; build y portable nuevos en `dist-release/`, modo WhatsApp. R09 hecho; R08 conserva activación/publicación y aplicación remota de la nueva migración.
- **Cambios:** tres pasos numerados; catálogo/precios confirmados; comentarios retirados; nombre y apellido; domicilio sólo para visitas; calendario amplio; listas 30/45 min; fechas pasadas y horas vencidas rechazadas; límites avanzan según Argentina. Modo Supabase conserva reservas, disponibilidad e idempotencia y agrega enlace WhatsApp con comprobante.
- **Archivos:** `index.html`, `src/{booking,calendar,main,online-booking,whatsapp}.js`, `src/online-booking.css`, nuevo `src/services.js`; migración `202610210001_customer_services.sql`; tests unitarios/E2E/SQL y runner; README, guías Supabase/reservas, evidencia y este plan. Originales y `.env` conservados, sin commits ni publicación.
- **Pruebas:** 22/22 unitarias; 16/16 Chromium sitio; 12/12 nuevo flujo en Chromium/Firefox/WebKit/móvil; 5 casos de acceso/recorrido y 2/2 nuevos conectados aprobados; tres migraciones y suites SQL PASS; 3/3 portable/responsive/axe del artefacto final. Comandos y alcance exactos en `docs/evidence/RESERVA_CLIENTE.md`.
- **Aciertos:** reutilizado calendario accesible; comprobaciones con reloj argentino y navegador en Tokio; datos sintéticos y SQL real; capturas revisadas tras mejorar selector móvil. Sin inventar días de atención ni perder reservas existentes.
- **Fallos resueltos:** timeout inicial de build; aislamiento de `.env` corregido asignando variables vacías dentro de Node (PowerShell las eliminaba); prueba nueva esperaba `duration_minutes` que admin_snapshot no expone, corregida verificando duración real entre timestamps. Una ejecución combinada llegó al límite temporal; casos pendientes ejecutados separadamente.
- **Pendientes/próximo paso:** aplicar tercera migración una sola vez (antes las anteriores si faltan), revisar días/descansos/traslados reales y publicar frontend actualizado según docs/RESERVAS. Sólo puede certificarse remotamente con acceso al proyecto del propietario. Lighthouse/instalación limpia y concurrencia nativa permanecen pendientes históricos.
- **Mejora concreta:** cambios futuros del catálogo deben actualizar coordinadamente SQL y `src/services.js`/contenido público; conservar las pruebas de intervalos y medianoche como aceptación.
- **Continuidad:** coordinador único, sin subagentes ni archivos reservados. Esfuerzo no expuesto/configurable; no hay compactación invocable. Handoff autosuficiente guardado.

### Checkpoint R10 — 2026-10-21 — revisión solicitada

- Usuario rechaza la presentación R09 por falta de acabado e integración visual. Se conserva funcionalidad verificada y se revisa composición, jerarquía, espacios, tipografía y responsive.
- Git/disco reconciliados; trabajo previo sin seguimiento conservado. Mismos tokens Arial/Helvetica, tinta/azul/papel y verde exclusivamente para WhatsApp. Diseño detallado en docs/DISENO.md.
- Problemas observados: precios alejados de los nombres, bloque muy ancho sin estructura interna, calendario sin contención y columna de datos demasiado vacía; confirmación sin resumen visible.
- Próximo paso: implementar distribución con catálogo cuidado, calendario enmarcado y fecha/horario junto a los datos; resumen compacto visible antes de WhatsApp. Coordinador único; esfuerzo no expuesto, compactación no invocable.

### Checkpoint R10 — 2026-10-21 — diseño implementado

- Rehechos HTML y CSS de reservas con tokens/tipografía actuales. Catálogo agrupado con iconos propios, calendario en panel claro con días limpios, campos agrupados y resumen visible compartido por ambos flujos (`src/booking-preview.js`).
- 14/14 E2E Chromium PASS: nuevo flujo, fechas, teclado, WhatsApp, responsive y axe. Capturas 320/390/768/1024/1440 generadas; examinadas 320/390/1024/1440. Tipografía comprobada por estilos calculados.
- Revisión visual detectó texto del servicio cortado en 320 px por duplicar precio en el selector. Eliminada esa duplicación; el precio sigue visible en catálogo y resumen. Modo conectado conserva el icono del botón en lugar de reemplazar todo su contenido y usa el mismo formato monetario.
- Pendiente inmediato: build final, flujos conectados, matriz móvil/Firefox/WebKit e inspección de capturas finales. Sin subagentes; no hay compactación invocable.

### Handoff R10 — 2026-10-21 — coordinador OpenCode

- **Dónde quedó:** revisión visual pedida por el usuario implementada y comprobada. `dist-release/index.html` y `dist-release/jc-barberhouse.html` regenerados con el diseño nuevo, modo WhatsApp. Fuentes actualizadas; R10 hecho.
- **Cambios:** catálogo agrupado y precios alineados, iconos de la página; títulos/espaciado coherentes; calendario en superficie clara con selección azul y números limpios; fecha/hora/datos en una columna útil; resumen visible de servicio/precio/fecha/hora; acción WhatsApp alineada. Móvil apila el contenido y tablet evita comprimir el calendario. Misma Arial/Helvetica y paleta del sitio, comprobadas por estilos calculados.
- **Archivos:** `index.html`, `src/online-booking.css`, `src/calendar.js`, nuevo `src/booking-preview.js`, integración de presentación en `src/{booking,online-booking}.js`; pruebas cliente público/conectado, capturas, docs/DISENO, evidencia, README y este plan.
- **Verificaciones:** 14/14 E2E Chromium (sitio, reservas, fechas, teclado, responsive y axe); 12/12 nuevo flujo en Chromium/Firefox/WebKit/móvil; 2/2 reservas conectadas sobre SQL real; 4/4 portable y axe en escritorio/móvil sobre artefacto final. Capturas 320/390/768/1024/1440 y página completa revisadas. Detalle en docs/evidence/DISENO_RESERVA.md.
- **Aciertos:** la revisión detectó y corrigió texto del selector cortado en 320 px; resumen compartido entre ambos flujos sin cambiar las reglas de negocio; el botón conectado conserva sus iconos. Todas las pruebas ejecutadas de esta revisión pasaron.
- **Fallos:** el diseño anterior R09 no satisfizo al usuario pese a pasar pruebas funcionales. Esta revisión agregó comparación con la página completa y revisión de jerarquía visual, no sólo ausencia de overflow. Dos intentos iniciales de patch documental no coincidieron con el contexto y fueron corregidos antes de aplicar cambios.
- **Pendientes/próximo paso:** R08, aplicar migración comercial pendiente en Supabase real y publicar con configuración correcta según docs/RESERVAS. Las limitaciones históricas de Lighthouse/instalación limpia y validación remota siguen documentadas; no impidieron probar el diseño y el flujo local.
- **Mejora concreta:** mantener capturas de formulario completo con selección real y en todos los breakpoints cuando se modifique la UI; comprobar etiquetas largas y resumen en vez de depender sólo de controles vacíos.
- **Continuidad:** coordinador único; sin subagentes ni archivos reservados. Esfuerzo no expuesto, compactación no invocable; checkpoint/handoff guardados.

### Checkpoint R11 — 2026-10-21 — alcance

- Nueva instrucción: únicamente sección de turnos, dos columnas principales y cinco pasos; selección dorada, tarjetas con imagen, calendario/horarios lado a lado, datos en dos columnas y CTA dorado.
- No hay imagen de referencia adjunta visible en esta conversación. Se informa al usuario y se avanza con su descripción detallada; no se promete comparación pixel a pixel sin el archivo.
- Mantener contratos RPC, conexión, reglas temporales, ocupación, reintentos y administrador. Los controles nativos siguen siendo la fuente de selección; un adaptador de presentación los representa como tarjetas/botones y emite sus eventos actuales.
- Restituir comentarios opcionales y mostrar teléfono; localidad para domicilio se mapea al campo de dirección ya existente en Supabase. Sin migraciones ni nuevos endpoints.
- Diseño: Arial/Helvetica y fondos/tinta actuales; dorado accesible `#96702e` sólo en reservas, fondo suave `#faf7f0`. Grid escritorio ~36/64; izquierda servicios/ubicación, derecha calendario+horas/datos/confirmación. Móvil una columna; controles táctiles y fotos existentes para corte, ilustraciones para barba/cejas.
- Git reconciliado, previos conservados. Esfuerzo no configurable/expuesto; compactación no invocable. Próximo paso: HTML/CSS y adaptador visual, luego pruebas reales de tarjetas y horarios en ambos modos.

### Checkpoint R11 — 2026-10-22 — mockup y especificación SDD

- El usuario adjuntó el mockup de referencia: 4 pasos, doble columna, badges circulares dorados, pestaña de modo activa en azul oscuro, calendario con día seleccionado en círculo dorado, horarios en grilla, datos 2×2, CTA dorado a ancho completo con icono WhatsApp, dirección "Av. San Martín 743 / Baradero".
- Capturas del estado previo (con .env de Supabase → modo conectado): `docs/evidence/r11-before-1440.png` y `r11-before-390.png`. Actuales 5 pasos con modo en paso 1, place-cards en paso 2, confirmation-panel en paso 5.
- Especificación SDD completa más abajo. Archivos disjuntos: A = HTML/CSS; B = JS de comportamiento + config + plugin; C = tests. Esfuerzo no expuesto por el harness.

### Especificación SDD — R11 — rediseño de #turnos (2026-10-22)

#### Objetivo

Rehacer la presentación de la reserva para igualar el mockup del usuario: 4 pasos, doble columna en escritorio, selección dorada, CTA dorado. Conservar contratos RPC, validación temporal, ocupación, `#preview-*`, controles nativos escondidos y ambos flujos (offline WhatsApp / online Supabase).

#### Decisión D19 revisada

Paso de 5 a 4: el "confirmation-panel" (paso 5) se integra al paso 4 como tira compacta de resumen + CTA + footnote dentro/debajo del paso 4. No se elimina ningún ID de preview.

#### DOM contrato (IDs y clases que los tests y el JS usan)

Estructura de 4 `section.step-card` dentro de `#booking-form > .booking-grid`:

**Paso 1 — servicio (columna izquierda)**
- `.panel-heading` con `.panel-number` = "1", `h3#service-step-title` = "Elegí el servicio", subtítulo p = "Seleccioná el servicio que querés."
- `.mode-switch` (role=group, aria-label "Modalidad de atención") con `button.mode-button[data-mode="local"|"home"]` — **conservar** (el mockup usa pestañas de modo; el modo vive aquí y en place-cards, sincronizados como hoy).
- `#service-cards.service-prices` (role=group, aria-label "Servicios disponibles") — lo puebla `booking-visual.js` desde `#booking-service`.
- `#service-detail.field-hint`, `#error-service.field-error`.
- `#online-fields.booking-native-fields` con `#booking-mode`, `#booking-service` (sr-only, sin cambio).

**Paso 2 — modalidad (columna izquierda)**
- `.panel-heading` número "2", `h3#place-step-title` = "Elegí la modalidad", subtítulo = "En la barbería o en tu casa."
- `.place-cards` (role=group, aria-label "Lugar de atención") con dos `button.place-card[data-mode="local"|"home"]`:
  - local: icono pin, strong "En la barbería", `span[data-address]` (main.js rellena `config.addressText`), small "Atención de 9:00 a 12:30 y de 16:30 a 20:30."
  - home: icono home, strong "A domicilio", span "Corte a domicilio, $20.000, 45 minutos.", small "Incluye barba y perfilado de cejas."
  - ambos con `span.choice-dot`.

**Paso 3 — fecha y horario (columna derecha)**
- `.panel-heading` número "3", `h3#appointment-step-title` = "Elegí el día y el horario", subtítulo = "Seleccioná una fecha disponible y luego un horario."
- `.when-grid`:
  - `.calendar-card`: `#date` (sr-only), `#calendar`, `#error-date`. Sin cambios de contrato.
  - `.times-card`:
    - `h4#times-title.booking-subheading` = "Elegí un horario"
    - `#times-date.times-date` (**nuevo**, aria-live=polite): muestra la fecha larga elegida (usar `formatLongDate`) o vacío si no hay fecha.
    - `#times-groups.times-groups` con dos `.times-group`:
      - label `#times-morning-label.times-label` con texto "Mañana" + icono sol (inline SVG `<use href="#icon-sun">`; si el símbolo no existe, añadir al sprite de `index.html` un sol simple estilo Tabler) + `small` "(9:00 a 12:30)"; `div.times-grid[data-slot-group="morning"][role=group][aria-labelledby=times-morning-label]`.
      - label `#times-afternoon-label.times-label` "Tarde" + icono atardecer/relampago → usar `#icon-clock` o sol si no hay; `small` "(16:30 a 20:30)"; `div.times-grid[data-slot-group="afternoon"]`.
    - `#times-empty.times-empty` = "Elegí un servicio y una fecha para ver los horarios."
    - `#time` select nativo sr-only, `#error-time`, `#online-availability` (`#availability-status`, `#booking-lookup`), `#time-hint`.

**Paso 4 — datos + confirmación (columna derecha)**
- `.panel-heading` número "4", `h3#details-step-title` = "Completá tus datos", subtítulo = "Ingresá tus datos para confirmar el turno."
- `.details-grid` **2×2** (grid 2 colas ≥720px, 1 columna <720px):
  1. `#name` — label "Nombre y apellido", placeholder "Ej: Juan Pérez", required, minlength 2/80 (offline) o 3/120 (online ya lo ajusta).
  2. `#phone-field` **siempre visible** — label "Teléfono / WhatsApp", placeholder "Ej: 3329 12-3456", `#phone` type=tel. Offline: opcional. Online: required (lo pone online-booking.js).
  3. `#address-field` **siempre visible** (nuevo wrapper `.field#address-field`) — label "Dirección (solo domicilio)" (**texto exacto**; los tests usan `getByLabel("Dirección", {exact:false})` o el texto nuevo), placeholder "Ej: Rivadavia 123, Baradero", minlength 5, maxlength 180 offline / 250 online. **Sin campo `#city`.** Requerido sólo en modo home (offline y online).
  4. `#notes` — label "Notas (opcional)", textarea 3 filas, maxlength 300. Se mantiene `comments` internamente en el mensaje offline (map notes→comments ya existente).
- Debajo de los campos, `.booking-preview-strip` (**nuevo contenedor**) que envuelve el `dl.booking-preview` existente con `#preview-service`, `#preview-price`, `#preview-date`, `#preview-time` — **IDs intactos**; estilo tira horizontal compacta (no panel alto).
- `details.summary-details` + `#booking-summary` — conservar.
- `.booking-action`: `#form-status`, `#booking-submit.button.booking-submit-gold` (icono whatsapp + span + arrow), `p.form-footnote` = "Te vamos a redirigir a WhatsApp con los datos de tu turno para confirmarlo." (offline; online lo sobreescribe como hoy).
- **Eliminar** la `section.step-card.confirmation-panel` completa (paso 5).

**Fuera del formulario (sin cambios de contrato)**
- `#booking-receipt`, `.direct-contact`, heading de sección `#booking-title` + copy lateral.

#### Textos del mockup (español rioplatense)

| Elemento | Texto |
| --- | --- |
| Paso 1 h3 | Elegí el servicio |
| Paso 1 sub | Seleccioná el servicio que querés. |
| Paso 2 h3 | Elegí la modalidad |
| Paso 2 sub | En la barbería o en tu casa. |
| Paso 3 h3 | Elegí el día y el horario |
| Paso 3 sub | Seleccioná una fecha disponible y luego un horario. |
| Paso 4 h3 | Completá tus datos |
| Paso 4 sub | Ingresá tus datos para confirmar el turno. |
| Footnote offline | Te vamos a redirigir a WhatsApp con los datos de tu turno para confirmarlo. |
| CTA offline span | Confirmar turno por WhatsApp |
| CTA online span | Reservar y continuar por WhatsApp (lo pone online-booking.js) |

#### Paleta y estilos (online-booking.css + ajustes puntuales en styles.css)

- Tokens existentes: `--booking-gold: #8a6528`, `--booking-gold-strong: #7a5822`, `--booking-gold-tint: #faf6ed`, `--booking-gold-line: #d9c79a`, `--booking-gold-ink: #6f5220`. **No cambiar** (el usuario dijo mantener los colores como vienen quedando).
- `.booking-section`: fondo `#faf7f0` (crema cálido del mockup; reemplaza el gris azulado actual de esa sección). En `styles.css` está `.booking-section`; el cambio es una línea.
- `.panel-number`: badge circular relleno `var(--booking-gold)`, número blanco `#fff`, sin borde, ~30px. (Actualmente es tint+borde; el mockup usa relleno.)
- `.mode-button[aria-pressed="true"]` y `.place-card[aria-pressed="true"]`: **borde y acento dorados** como hoy; la pestaña activa del mockup es azul oscuro → usar `var(--navy)` de `styles.css` (`#18334c`) como fondo del botón de modo activo con texto blanco (coherente con la página). place-card activo mantiene estilo dorado actual (borde gold + tint) que ya coincide con el mockup de tarjetas.
- `.service-card[aria-pressed="true"]`: borde `--booking-gold` 2px, fondo tint, dot dorado (ya existe).
- Calendario: celdas sin borde por defecto; día seleccionado `background: var(--booking-gold); color: #fff; border-radius: 50%`; hoy outline dorado 2px. Ajustar `.calendar-day` en online-booking.css (el calendario base está en styles.css y se refina en online-booking.css).
- `.times-grid`: `display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px;` — 3 columnas bajo 480px.
- `.time-button[aria-pressed="true"]`: fondo dorado, texto blanco.
- `.booking-submit-gold`: fondo `var(--booking-gold-strong)`, hover `var(--booking-gold)`, ancho 100%, min-height 52px, radio 10px, texto blanco (ya existe como clase; verificar que el disabled actual no sea el gris del screenshot — el screenshot offline muestra gris porque está `disabled` hasta completar; eso es correcto).
- `.booking-preview-strip`: grid de 4 ítems en fila (2×2 en móvil), tipografía pequeña, fondo `--booking-gold-tint`, borde `--booking-gold-line`, radio 10px; dt en uppercase 11px, dd bold navy.
- Responsive: `.booking-grid` dos columnas ~36/64 ≥980px; una columna <980px (ya existe el patrón; verificar breakpoint).
- Foco visible: outline 2px `--booking-gold` + offset (ya parcialmente presente con `.is-mirrored-focus`).

#### Comportamiento JS (booking-visual.js, booking.js, online-booking.js, date-utils.js, whatsapp.js, config.js, main.js)

1. **`src/booking-visual.js`**
   - Corregir split mañana/tarde: usar minutos del label, no `startHour < 12`. Regla: `hh*60+mm < 750` (12:30) → mañana; si el label es rango "09:00–09:30", tomar el primer `HH:mm`. Así 12:00–12:30 queda en Mañana.
   - Actualizar `mirror()` para `#date` → `.calendar-card` (ok) y `#time` → `.times-card` (ok).
   - No tocar `SERVICE_IMAGES` (fotos existentes).
2. **`src/date-utils.js`**
   - `bookingFields`: quitar `"city"` → `["name","date","time","address","comments"]`.
   - `textLimits`: quitar `city`.
   - `validateBooking` labels: quitar `city`.
   - Mantener `formatLongDate` exportado (para `#times-date`).
3. **`src/whatsapp.js`**
   - Línea home: `lines.push(\`Domicilio: ${values.address}\`)` — **sin** línea `Localidad:`. (La localidad va dentro de address y de config.addressCity para el local.)
   - Línea local inmutable: `Local: ${config.addressText}, ${config.addressCity}`.
4. **`src/config.js`**
   - Añadir `addressCity: "Baradero"`.
5. **`src/main.js`**
   - `[data-maps]` href: `query=${encodeURIComponent(\`${config.addressText}, ${config.addressCity}\`)}`.
   - `data-address` en `#ubicacion` puede seguir solo street; el bloque de ubicación mostrará ciudad en un `[data-city]` si se añade al HTML (coordinador/A) — mínimo: añadir en `#ubicacion` un párrafo con `data-city` que main.js rellena.
6. **`src/booking.js`** (offline)
   - Quitar referencias a `city` (líneas 42, 63, 100, 123).
   - `#address`: **no** ocultar en local; sólo `required = mode === "home"`. Quitar `.closest(".field").hidden` para address; el label ya dice "(solo domicilio)".
   - `data()` sigue mapeando `notes`→`comments`.
   - Focus en errores: address es visible siempre → `$(first).focus()` ok.
7. **`src/online-booking.js`** (online)
   - Eliminar `$("city")...` (líneas 43-44).
   - `#address`: visible siempre; `required = mode === "home"` (ya lo hace); **quitar** `hidden = mode !== "home"` (línea 96) — dejar visible.
   - Añadir listener en change de `#date` para actualizar `#times-date.textContent = value ? formatLongDate(value) : ""` (también en offline: booking.js `refreshSlots` o input en date).
   - Mantener el resto del contrato RPC.
8. **`scripts/content-plugin.mjs`**
   - JSON-LD: añadir `addressLocality: config.addressCity`.
   - Replacements: añadir mapa de `AVENIDA SAN MARTIN 743, Baradero` si se hardcodea, o better: el HTML fuente usa placeholders literales que el plugin reemplaza — añadir replacement de query de Maps si cambia el href estático. Coordinador/A ajusta el href estático a `...query=AVENIDA%20SAN%20MARTIN%20743%2C%20Baradero` y el plugin reemplaza ambos trozos.
9. **`index.html`** (sólo si no lo hace el subagente A dentro de su asignación de la sección turnos + hero)
   - Hero bugs (líneas ~141-163): falta cerrar bien; hay `</a>` huérfano en photo-stamp y `</div>` extra. Corregir anidamiento a: `.hero-visual > picture + span.photo-stamp` y cerrar `.hero-visual` una sola vez.
   - `<source type="image/webp">` del hero apunta a `.jpeg` → usar derivados webp si existen (`public/images` o generar referencia a certificados sin forzar webp): opción segura = quitar el `<source>` y dejar `<img src="/certificados.jpeg">`, o apuntar srcset a webp si `scripts/optimize-images.mjs` genera certificados-webp (verificar disco; si no existe, quitar source).
   - Sprite: añadir `#icon-sun` si no existe (path estilo Tabler sun).
   - Sección ubicación: añadir línea de ciudad.

#### Tests (contrato a actualizar — subagente C)

- `tests/e2e/customer-booking.spec.js`:
  - `.panel-number` → `["1","2","3","4"]`.
  - Quitar `#city.fill(...)`.
  - `#address` en local: ahora **visible** (cambiar `toBeHidden()` por `toBeVisible()`); en home sigue visible + required.
  - Label de dirección: usar `getByLabel(/Dirección/)` o el texto exacto nuevo.
  - Mantener precios, slots, tarjetas, preview.
- `tests/e2e/site.spec.js`:
  - `fillRequest`: quitar fill de Localidad; `getByLabel(/Dirección/)`.
  - Esperado del mensaje: sin línea `Localidad:`.
  - `#ubicacion`: puede exigir presencia de Baradero en `[data-city]` o en el href de Maps (`query=AVENIDA%20SAN%20MARTIN%20743%2C%20Baradero`).
- `tests/unit/whatsapp.test.js`: fixture sin `city`; esperado sin `Localidad:`; local incluye `Local: AVENIDA SAN MARTIN 743, Baradero`.
- `tests/unit/date-utils.test.js`: quitar `city` de fixtures y de asserts de `validateBooking`/`textLimits`.
- `tests/unit/services.test.js`: quitar `city` del fixture; assert sin `Localidad:`.
- `tests/booking/*.spec.js` (online con SQL): revisar si usan `#city` (grep indica que no en customer/admin de booking salvo address). Si algo referencia `#city`, actualizar. `customer.spec.js` de booking llena `#address` con "…, localidad de prueba" en un solo string — compatible.
- **No tocar** migraciones SQL ni `src/admin*`.

#### Fuera de alcance

- Commits, push, publicación, R08, migraciones, admin, cambios de RPC, cambio de tokens dorados, cambio de duración 30/45, cambio de precios.

#### Criterios de aceptación de R11

1. `npm run test:unit` verde.
2. `npm run build` verde.
3. `npm run test:e2e` verde en Chromium (y sin regresión aparente en Firefox/WebKit si el runner local permite).
4. Capturas 1440 y 390 de `#turnos` en modo offline (sin .env) y al menos una en línea conectada si es posible: 4 pasos, doble columna, dorado, sin `#city`, dirección visible con "(solo domicilio)", CTA dorado, preview en tira.
5. Sin desplazamiento horizontal en 320/390/768/1024/1440.
6. axe sin violaciones nuevas en la sección.
7. Mensaje WhatsApp offline: sin `Localidad:`; local muestra `Local: AVENIDA SAN MARTIN 743, Baradero`.
8. Hero con HTML balanceado (sin tags huérfanos) y sin source webp inválido.

#### Asignaciones de archivos (disjuntas)

| Subagente | Escritura exclusiva | Sólo lectura |
| --- | --- | --- |
| A — HTML/CSS | `index.html`, `src/online-booking.css`, `src/styles.css` | este plan, config.js, mockup specs arriba |
| B — JS/comportamiento | `src/booking-visual.js`, `src/booking.js`, `src/online-booking.js`, `src/date-utils.js`, `src/whatsapp.js`, `src/config.js`, `src/main.js`, `scripts/content-plugin.mjs` | index.html (para referencias), tests (contrato) |
| C — tests | `tests/e2e/site.spec.js`, `tests/e2e/customer-booking.spec.js`, `tests/unit/whatsapp.test.js`, `tests/unit/date-utils.test.js`, `tests/unit/services.test.js`, `tests/booking/*.spec.js` (sólo si rompen por #city/label) | src/* (contrato) |

El coordinador integra, resuelve solapes (p.ej. si A y B ambos necesitan tocar el sprite o data-city) y ejecuta la verificación completa.

### Checkpoint R11 — 2026-10-22 — última instrucción: tres pasos

- Esta instrucción reemplaza la especificación de cuatro pasos anterior. Servicios: corte general $18.000, barba $10.000, perfilado de cejas $8.000 (local, 30 min), corte a domicilio $20.000 (45 min, incluye barba y perfilado de cejas).
- Paso 1 muestra las cuatro tarjetas a la vez. Seleccionar servicio determina modalidad automáticamente: sin pestañas de modalidad ni paso de ubicación independiente. Los selectores nativos #booking-mode/#booking-service permanecen como estado interno.
- Paso 2 conserva #calendar y #date; #time se hace visible, accesible y desplegable nativo. Franjas 09:00–12:30 y 16:30–20:30; todos los turnos deben terminar dentro de la franja. Sin grilla visual duplicada de horarios.
- Paso 3 conserva nombre y apellido, teléfono necesario para reservas conectadas, dirección requerida y visible sólo para domicilio, notas opcionales, resumen y WhatsApp. Paleta actual intacta.
- Asignación nueva y exclusiva: A index.html + src/styles.css + src/online-booking.css; B src/booking-visual.js + src/booking.js + src/online-booking.js; C tests/e2e + tests/booking/customer.spec.js. Coordinador: plan, documentación, integración y verificación. Asignaciones anteriores terminadas/canceladas.
- Esfuerzo configurable no expuesto; compactación no invocable. Validar unitarias, build aislado, E2E offline y conectado, responsive y HTML. No se modifica configuración remota.

### Handoff R11 — 2026-10-22 — tres pasos entregados

- **Dónde quedó:** última instrucción implementada y verificada. Tres pasos verticales, cuatro servicios a la vista, modo inferido del servicio, calendario amplio y horario en lista nativa, datos y WhatsApp. R11 hecho; R08 externo pendiente.
- **Decisión vigente D21:** este flujo sustituye D19 y la especificación histórica de cuatro/cinco pasos de R11. Dirección sólo para domicilio; precios/duraciones D18 intactos. Tipografía y colores actuales conservados.
- **Cambios:** index.html, src/styles.css, src/online-booking.css, src/booking-visual.js, src/booking.js, src/online-booking.js; pruebas cliente offline/conectadas, README, docs/CONTRATOS y docs/evidence/TRES_PASOS. Se preservan los cambios anteriores de city/config y los recursos del usuario.
- **Verificaciones:** 23/23 unitarias; 17/17 E2E Chromium sobre build final (axe, teclado, WhatsApp, recursos, portable y responsive); 4/4 Firefox antes del ajuste de foco WebKit; 8/8 WebKit/móvil después; 3/3 conectados con fixture SQL. Sintaxis y parser HTML/CSS aprobados. Capturas 320/390/768/1024/1440 guardadas; 390/1440 inspeccionadas visualmente.
- **Aciertos:** asignaciones disjuntas evitaron conflictos; las pruebas cubren selección automática de modalidad y cambios de duración sin conservar horarios inválidos. Se mantiene la reserva transaccional conectada.
- **Fallos resueltos:** foco automático del input de fecha vaciaba el valor en WebKit; retirado ese listener, manteniendo foco explícito de errores. Primera ejecución Chromium agotó tiempo al cerrar, ejecución final terminó normalmente. Windows impidió reconstruir dist-release/images: alternativa completa y probada en test-results/r11-three-final/.
- **Entrega:** npm.cmd run preview -- --outDir test-results/r11-three-final; abrir http://127.0.0.1:4173/#turnos. Portable: test-results/r11-three-final/jc-barberhouse.html, conservando recursos al lado.
- **Pendientes:** activación/migraciones/despliegue remoto R08 y verificaciones históricas de infraestructura no realizadas. No se certifica Supabase remoto mediante la fixture local.
- **Mejora concreta:** usar rutas nuevas de salida frente a bloqueos Windows y probar fechas nativas en WebKit al cambiar manejo de foco. Documentar la ruta efectiva del artefacto, no una salida fallida.
- **Continuidad:** todos los subagentes cerrados; sin archivos reservados. Esfuerzo no expuesto y compactación no invocable; estado persistido en este handoff.

### Checkpoint R12 — 2026-10-22 — tarjetas y nuevo precio (verificado)

- Última instrucción: tarjetas similares a las imágenes, selección con check y animación al pasar el mouse. Corte general $18.000 (se interpreta `$18.0000` como errata del precio anterior), barba $10.000, cejas $8.000, domicilio $30.000 con barba y perfilado incluidos. D22 sustituye sólo el precio de domicilio de D18.
- Diseño: tarjeta compacta centrada, navy existente como superficie, texto blanco, precio dorado claro legible y acción verde; el resto del sitio conserva paleta. Check arriba a la derecha sólo al seleccionar. Hover con elevación de 5px, borde y sombra; teclado con foco visible; reduced-motion sin transformaciones. Las imágenes estáticas no permiten deducir una animación exacta: se aplica esa interpretación suave.
- Se mantienen tres pasos: la acción de cada tarjeta selecciona servicio; WhatsApp sigue después de fecha/datos. Los primeros tres indican En la barbería y el cuarto A domicilio.
- Asignación exclusiva: subagente precio/SQL escribe src/services.js, nueva migración de precio (sin reescribir migraciones aplicadas), tests/booking/customer.spec.js, tests/unit/services.test.js, supabase/README.md. Coordinador escribe src/booking-visual.js, src/online-booking.css, tests/e2e y docs/plan. Sin conflictos de archivos.
- Git reconciliado, previos preservados. Esfuerzo no expuesto; compactación no invocable. Catálogo/mensaje/comprobante a $30.000 comprobados, snapshot histórico inmutable, responsive, hover/teclado/reduced-motion y axe verificados. No aplicar SQL remoto sin acceso establecido.
- **Verificaciones:** 24/24 unitarias; 18/18 E2E Chromium (incluye tarjetas hover/check y responsive 320/390/768/1024/1440); tarjetas en Firefox, WebKit y móvil PASS; 4/4 conectados con fixture SQL (migración $20.000→$30.000 y snapshot histórico inmutable). Sintaxis JS, Prettier HTML/CSS y parser de tags HTML aprobados. Capturas de tarjetas en docs/evidence/services-*.png.
- **Entrega:** npm.cmd run preview -- --outDir test-results/r12-tarjetas; abrir http://127.0.0.1:4173/#turnos. Portable: test-results/r12-tarjetas/jc-barberhouse.html, conservando recursos al lado.
- **Pendientes:** activación/migraciones/despliegue remoto R08 y verificaciones históricas de infraestructura no realizadas. No se certifica Supabase remoto mediante la fixture local.
- **Continuidad:** todos los subagentes cerrados; sin archivos reservados. Esfuerzo no expuesto y compactación no invocable; estado persistido en este handoff.

### Checkpoint R13 — 2026-10-23 — íconos Tabler, fondo de sección y tarjetas centradas (verificado)

- **Contexto:** al retomar, gran parte de `src/` (booking.js, calendar.js, config.js, online-booking.js/css, services.js, whatsapp.js, booking-visual.js, booking-preview.js, booking-api.js, date-utils.js, gallery.js) constaba como borrada en disco frente a git; `src/main.js` quedó autocontenido (sin imports) y `index.html` sólo carga `/src/styles.css` y `/src/main.js`. `npm run build` de Vite falla porque `vite.config.js` importa `scripts/content-plugin.mjs` (borrado) — fuera de alcance, no tocado. Prueba con servidor estático (`python -m http.server 4173`) + Playwright.
- **Instrucción del usuario:** reemplazar todos los íconos por los oficiales de Tabler Icons (paths exactos de GitHub tabler-icons outline), fondo de la sección de turnos = el "blanco" de la parte de arriba de la página, tarjetas de servicios con la info centrada y más llamativas, ícono de reloj junto a la duración, ícono de casita en el servicio a domicilio, borrar el texto que quedaba fuera del cuadrado del servicio, y mejorar responsive.
- **Cambios:**
  - `index.html`: sprite SVG reemplazado por los paths oficiales de Tabler (arrow-right, external-link, scissors, map-pin, brand-instagram, brand-whatsapp, brand-tiktok, home, clock) conservando los ids `icon-*`; borrados los símbolos no usados `icon-calendar`/`icon-sun`/`icon-sunset`; eliminado el párrafo `#service-detail` y su `aria-describedby`.
  - `src/main.js`: `renderServices` reescrita con `iconEl()` (SVG `<use>` desde el sprite), tarjetas con nombre/precio/meta centrados, fila `🕐 duración` (ícono clock) y fila `🏠 A domicilio` (ícono home, sólo en el servicio de domicilio); `SERVICES` ajustado (`place` corto + `details` aparte); eliminada la línea que escribía `#service-detail`.
  - `src/styles.css`: `.booking-section { background: var(--paper) }` (#f7f8f8, el mismo que el encabezado/hero; sustituye al crema #faf7f0); `.service-card` centrada (`text-align: center`, `align-items: center`), precio agrandado a 26px navy, check posicionado absoluto arriba a la derecha, `.service-card-meta-row` con íconos 15px, `.service-card-details` para el texto incluido del domicilio; responsive 480px con padding/tipografías ajustadas.
- **Verificaciones (Playwright, Chromium, 26/26):** sin errores JS; fondo de `.booking-section` = rgb(247,248,248); `#service-detail` eliminado; 4 tarjetas; 4 íconos reloj + 1 casita (sólo domicilio); reloj dibuja contenido (getBBox 11.25); tarjetas centradas; flujo paso 1→2→3; 15 turnos de 30 min (09:00–12:00 y 16:30–20:00); sin campo teléfono; local sin campo domicilio y WhatsApp con mensaje de servicio/precio/hora/nombre; domicilio con validación de dirección requerida y mensaje con domicilio; sin overflow en 390px y 320px; flujo en móvil OK. wa.me redirige a api.whatsapp.com (el texto viaja con `+` como espacio, verificado decodificando).
- **Capturas:** `test-results/sec-paso1-desktop.png`, `sec-seleccionado-desktop.png`, `sec-paso1-mobile.png`, `sec-domicilio-mobile.png`, `desk-paso2.png`, `desk-paso3.png`, `movil-paso1.png`, `movil-paso2.png` (gitignored).
- **Pendientes:** R08 (activación/despliegue remoto) sigue externo; `npm run build` de Vite sigue roto por `scripts/content-plugin.mjs` borrado (fuera de alcance); módulos `D` en git sin restaurar (decisión de mantener `main.js` autocontenido por ahora).
- **Continuidad:** sin subagentes activos. Esfuerzo no expuesto; compactación no invocable. Estado persistido en este checkpoint.

### Checkpoint R14 — 2026-10-24 — galería al hero en carrusel (verificado)

- **Instrucción del usuario:** sacar la sección "Nuestro trabajo / Cortes que hablan por sí solos" y poner todas esas fotos en el bloque visual del hero, cambiándose automáticamente.
- **Decisión D23:** se retiró la sección `#cortes` completa (encabezado, cinco tarjetas con lightbox y pie con enlace a Instagram). Las seis fotografías (`certificados.jpeg` + `corte2`–`corte5`, `corte1`) rotan en `.hero-slideshow` con crossfade de 0,7 s cada 4,5 s. `#cortes` se conserva como ancla sobre `.hero-visual` para no romper "Nuestros cortes" del menú ni "Mirá nuestros cortes" del hero. Se eliminó `#photo-dialog` y su lógica (pertenecía a la galería retirada).
- **Cambios:**
  - `index.html`: sprite con `icon-pause`/`icon-play` (paths Tabler outline); `.hero-visual` pasa a carrusel de seis `<figure class="hero-slide">` (la primera `is-active`, el resto `aria-hidden="true"`); controles con seis puntos (`aria-label="Foto N de 6"`) y botón pausar/reanudar, ocultos con `hidden` hasta que JS los habilita; borradas la sección de galería y el diálogo `#photo-dialog`.
  - `src/main.js`: bloque de galería/lightbox reemplazado por el carrusel (módulo autocontenido): avance por `setInterval`, puntos, pausa/reanudar, `IntersectionObserver` (sólo avanza a la vista), pausa con pestaña oculta y arranque pausado si `prefers-reduced-motion: reduce`.
  - `src/styles.css`: `.hero-photo` deja de fijar `aspect-ratio` (ahora vive en `.hero-slideshow`, que recoge además los valores de los breakpoints); nuevas reglas `.hero-slide` (absolutas + opacidad) y `.slideshow-controls/-dots/-toggle` con objetivos de 26–30 px; eliminados `.gallery*`, `.cut-card`, `.zoom-indicator`, `.gallery-footer`, `.photo-dialog*`, `.dialog-close`, `body.dialog-open` y `.photo-caption` (muertos).
- **Verificaciones (Playwright/Chromium sobre `python -m http.server 4173`, 31/31):** galería y `section#cortes` ausentes; `#cortes` sigue existiendo como ancla y ninguna ancla interna queda rota; 6 fotos cargan (`naturalWidth > 0`); la slide activa cambia sola a los ~5 s; el botón pausa detiene el avance y alterna `#icon-pause`/`#icon-play` con su etiqueta; cada punto lleva a su foto y marca `aria-current`; cinco slides con `aria-hidden="true"`; axe (wcag2a/2aa/21aa/22aa) sin violaciones; sin errores de consola ni de red (único 404 preexistente: `/images/favicon.png`, sólo visible con servidor estático); sin overflow en 320/390/768/1024/1440; con `reducedMotion: reduce` arranca pausado y no avanza; sin JavaScript se ve la primera foto, los controles quedan ocultos y el contacto sigue disponible.
- **Capturas:** `test-results/hero-slideshow/` (gitignored): `hero-1440-t0.png`, `hero-1440-t5.png`, `hero-1440-pausado.png`, `page-390.png`, `page-1440.png`, `hero-mobile.png`, `hero-sinjs-390.png`. Script reproducible: `test-results/hero-slideshow-check.mjs`.
- **Pendientes / fuera de alcance:** `tests/e2e/site.spec.js` y `portable.spec.js` siguen desactualizados respecto del sitio actual (esperan `#booking-mode`, "Confirmar turno por WhatsApp", lightbox de la galería, etc.); no se tocaron porque ya estaban rotos antes de este cambio. El build de Vite sigue roto por `src/config.js` y `src/gallery.js` ausentes; `scripts/content-plugin.mjs` sigue inyectando la galería entre `<!-- gallery:start -->` y `<!-- gallery:end -->`, marcadores que ya no existen (el `replace` no falla, simplemente no aplica).
- **Continuidad:** sin subagentes activos; archivos tocados sólo por el coordinador: `index.html`, `src/styles.css`, `src/main.js` y este plan. Esfuerzo no expuesto; compactación no invocable.

### Checkpoint R15 — 2026-10-25 — dos servicios y extras del corte general (verificado)

- **Instrucción del usuario:** en la parte de servicios sacar barba y perfilado de cejas; cuando el cliente elija el corte general, una vez seleccionado le aparece abajo para elegir barba, perfilado de cejas o ambos; lo demás se mantiene como estaba.
- **Decisión D24:** catálogo reducido a "Corte general" y "Corte a domicilio"; barba y cejas pasan a `EXTRAS` opcionales con los precios ya confirmados en D18. Precio total y duración son sumas de esos valores; el resto del flujo (calendario, turnos de 30 min, datos, WhatsApp) no cambia.
- **Cambios:**
  - `index.html`: dentro de `#step-1`, después de `#service-cards`, se añade `#service-extras` (oculto por defecto) con `role="group"` "Sumá extras a tu corte", ayuda "Opcional: elegí barba, perfilado de cejas o ambos", contenedor `#extra-chips` (los chips los pinta JS), total en vivo `#extra-total` (`aria-live="polite"`) y botón `#service-continue` "Continuar".
  - `src/main.js`: `SERVICES` pasa de cuatro a dos entradas (`amount`/`durationMin` en lugar de `price`/`duration`); nuevo `EXTRAS` (barba 10000/30, perfilado-cejas 8000/30) y `formatPrice()` con `toLocaleString("es-AR")`; estado `state.extras`; helpers `activeExtras()`, `serviceName()`, `serviceAmount()`, `serviceDuration()`; `renderExtras()` pinta los dos chips tipo checkbox; `syncExtras()`/`syncExtrasPanel()`/`updateChosenService()` actualizan total, resumen y vista previa; `selectService()` muestra el panel y **no** avanza de paso cuando el servicio es el corte general (sólo refresca los tabs con `setStep(1, { focus: false })`), y para el domicilio conserva el avance automático, la dirección requerida y la limpieza de extras; botón "Continuar" que pasa al paso 2 (o al 3 si ya hay fecha y horario); `buildMessage()` usa el servicio combinado.
  - `src/styles.css`: `.service-cards` pasa de cuatro a dos columnas con `max-width: 760px` centrado; nuevas reglas `.service-extras`, `.extra-options`, `.extra-chip` (borde navy + palomita con `:has(input:checked)`, foco con `:has(input:focus-visible)`), `.extra-total` y `.service-continue`; `.chosen-service` con `max-width: 100%`; en `max-width: 480px` los chips pasan a una columna.
- **Verificaciones (Playwright/Chromium sobre `python -m http.server 4173`, 43/43):** sólo dos tarjetas y sin nombres barba/cejas; panel oculto al cargar; elegir corte general muestra el panel sin salir del paso 1 y habilita el tab 2; totales $18.000 → $28.000 (barba) → $36.000 (ambos) → $18.000; resumen "Corte general + Barba · $28.000 · 60 min"; "Continuar" lleva al paso 2; vista previa "Corte general + Barba / $28.000"; mensaje de WhatsApp decodificado con `Servicio: Corte general + Barba (En el local) — $28.000, 60 min.`, fecha, hora, nombre y sin `Domicilio:` ni precios huérfanos; volver al paso 1 conserva el panel; domicilio oculta los extras, pide dirección y avanza solo; re-elegir corte general reinicia los tildes; axe (wcag2a/2aa/21aa/22aa) sin violaciones con el panel visible; sin overflow en 320/390/768/1440; chips en 2 columnas en escritorio y 1 en móvil; sin errores de consola ni de red (único 404 preexistente: `/images/favicon.png`); sin JavaScript el panel queda oculto y el contacto sigue disponible. Regresión del carrusel del hero: 31/31 con `test-results/hero-slideshow-check.mjs`.
- **Formato:** `npx.cmd prettier --check` sólo señala desviaciones preexistentes (JSON-LD `sameAs`, `tiktokUrl`, líneas largas anteriores); el bloque nuevo de `index.html` y de `src/styles.css` está conforme, y en `src/main.js` se corrigieron las tres líneas nuevas que excedían 80 caracteres.
- **Capturas:** `test-results/servicios-extras/` (gitignored): `paso1-extras-desktop.png`, `paso1-ambos-desktop.png`, `paso3-preview-desktop.png`, `paso1-1440.png`, `paso1-extras-mobile.png`. Script reproducible: `test-results/servicios-extras-check.mjs`.
- **Pendientes / fuera de alcance:** `tests/unit/*` siguen importando `src/services.js`, `src/whatsapp.js` y `src/date-utils.js` (borrados en la refactorización a archivo único) y `tests/e2e/site.spec.js`/`customer-booking.spec.js` esperan el diseño anterior de cuatro tarjetas: ya fallaban antes de este cambio y no se tocaron. R08 (activación/despliegue remoto) sigue externo.
- **Continuidad:** sin subagentes activos; archivos tocados sólo por el coordinador: `index.html`, `src/main.js`, `src/styles.css` y este plan. Esfuerzo no expuesto; compactación no invocable. Estado persistido en este checkpoint.

### Checkpoint R16 — 2026-10-25 — precio de domicilio por día y membresías (verificado)

- **Instrucción del usuario:** el corte a domicilio pasa a valer $20.000 de lunes a sábados y $30.000 los domingos; agregar tres tarjetas de membresías en el paso de servicios con sus cinco condiciones, en cuadrados como el corte general y el domicilio. Texto pedido: "Membresías exclusivas JC BARBER (Solo domicilio) — 2 cortes al mes $30.000, 3 cortes al mes $45.000, 4 cortes al mes $50.000" y las condiciones 1) abono del 1 al 5, 2) turnos agendados al abonar, 3) uso dentro del mes sin acumular, 4) incluyen barba y perfilado de ceja, 5) válidas de lunes a sábado (+$10.000 si se usa un domingo).
- **Decisión D25:** el domicilio pasa a `amount: 20000` con `sundayAmount: 30000`; la tarjeta muestra $20.000 y la nota "Domingos $30.000", y el importe efectivo se recalcula contra `state.date` en resumen, vista previa y mensaje. Las tres membresías entran en `SERVICES` con `type: "membership"` (precio fijo, sin `durationMin`, `mode: "home"`): se pintan en una segunda grilla `#membership-cards`, muestran sólo el panel de condiciones, limpian fecha/horario, dejan el tab 2 deshabilitado y saltan al paso 3 con "A coordinar por WhatsApp" (fecha y hora) en la vista previa y en el mensaje. Los extras de D24, el calendario y el resto del flujo quedan intactos.
- **Cambios:**
  - `index.html`: `#service-extras` pasa a envolverse en `.service-options` y el botón `#service-continue` queda dentro del panel de extras; después se añaden `h4#membership-title` (título + etiqueta "Sólo a domicilio"), `#membership-cards` (`role="group"` con `aria-labelledby`) y `#membership-conditions` (oculto por defecto, `aria-labelledby`) con el título "Condiciones de la membresía", `ol.conditions-list` de cinco `li`, total `#membership-total` (`aria-live="polite"`, oculto) y botón `#membership-continue` (oculto).
  - `src/main.js`: `corte-domicilio` con `amount: 20000` y `sundayAmount: 30000`; tres entradas `type: "membership"` (30000/45000/50000); helpers `isMembership()` y `isSunday()`; `serviceAmount()` aplica el precio de domingo; `serviceDuration()` devuelve cadena vacía si el servicio no declara duración; `setStep()` deshabilita el tab 2 para membresías y habilita el 3 sólo con servicio (y fecha/hora en los demás casos); `renderServices()` extrae `serviceCard()` y reparte entre `#service-cards` y `#membership-cards`, con nota `.service-card-note` cuando hay `sundayAmount`; `syncExtrasPanel()` muestra/oculta panel de extras, bloque de condiciones, total y botón; `updateChosenService()` fija "A coordinar por WhatsApp" en membresías; `selectService()` limpia fecha/horario al elegir membresía y se queda en el paso 1; `selectDate()` recalcula el precio por domingo; `updatePreview()` muestra "A coordinar por WhatsApp" para fecha y hora en membresías; `validateDetails()` salta la validación de fecha/horario sólo en membresías; `buildMessage()` emite `Fecha y hora: a coordinar por WhatsApp` y omite `Fecha preferida:`/`Hora preferida:`, conservando servicio, precio, nombre y domicilio; nuevo listener `#membership-continue` → `setStep(3)`.
  - `src/styles.css`: `.service-extras` → `.service-options`; `.service-continue` con `margin-top` (ya no tiene `max-width` propio porque vive dentro del panel); nuevas reglas `.services-subtitle` (flex centrado, versalitas navy + `.services-subtitle span` como etiqueta verde tipo píldora), `.membership-cards` (tres columnas), `.service-card-note`, `.membership-conditions`, `.membership-conditions .service-continue` y `.conditions-list`; en `max-width: 760px` las membresías pasan a dos columnas y en `480px` a una.
- **Corrección encontrada en la verificación:** el bloque `#membership-conditions` se había quedado sin el atributo `hidden`, por lo que las condiciones se veían al cargar (y sin JavaScript). Se agregó el atributo y las pruebas pasaron: al reanudar, verificar siempre los estados iniciales declarados en HTML, no sólo los que fija el JS.
- **Verificaciones (Playwright/Chromium sobre `python -m http.server 4173`):**
  - Nuevo `test-results/membresias-check.mjs`: **48/48** — tarjetas 18.000 / 20.000 con nota "Domingos $30.000"; tres membresías 30.000/45.000/50.000 con "Solo domicilio"; condiciones ocultas al cargar, visibles al elegir, cinco ítems con el texto pedido; membresía oculta los extras, se queda en el paso 1, tab 2 deshabilitado y tab 3 habilitado; total y resumen correctos; "Continuar" salta al paso 3; vista previa con fecha y hora "A coordinar por WhatsApp"; mensaje con `Servicio: Membresía 3 cortes (Solo domicilio) — $45.000.`, `Fecha y hora: a coordinar por WhatsApp`, nombre y domicilio, y sin `Fecha preferida:`; domicilio en lunes $20.000 y en domingo $30.000 con mensaje `Servicio: Corte a domicilio (A domicilio) — $30.000, 45 min.`; regresión del corte general; axe sin violaciones con condiciones visibles; sin overflow 320/390/768/1440; grilla 3/2/1 columnas en 1440/760/390; móvil sin errores; sin JavaScript las condiciones quedan ocultas y la grilla vacía.
  - Regresión: `test-results/servicios-extras-check.mjs` **43/43** (sólo se ajustó la expectativa de precios de la tarjeta) y `test-results/hero-slideshow-check.mjs` **31/31**.
- **Formato:** `npx.cmd prettier --check` sigue señalando únicamente desviaciones preexistentes (JSON-LD `sameAs`, `tiktokUrl`, `argentinaNow`, `slotsForDate`, `selectTime`, líneas largas de validación y `svg` del HTML); `src/styles.css` está conforme y el código nuevo de `index.html`/`src/main.js` coincide exactamente con la salida de Prettier.
- **Capturas:** `test-results/membresias/` (gitignored): `paso1-membresias-desktop.png`, `paso1-condiciones-desktop.png`, `paso3-membresia-desktop.png`, `paso2-lunes-desktop.png`, `paso1-membresias-1440.png`, `paso1-condiciones-mobile.png`. Script reproducible: `test-results/membresias-check.mjs`.
- **Pendientes / fuera de alcance:** los tests de `tests/` siguen rotos por motivos anteriores; R08 (activación/despliegue remoto) sigue externo. La regla "domingo +$10.000 por corte de membresía" queda sólo informativa en las condiciones: como la membresía no fija fecha en el formulario, el recargo se acuerda por WhatsApp.
- **Continuidad:** sin subagentes activos; archivos tocados sólo por el coordinador: `index.html`, `src/main.js`, `src/styles.css` y este plan. Esfuerzo no expuesto; compactación no invocable. Estado persistido en este checkpoint.

### Checkpoint R17 — 2026-10-25 — condiciones centradas, domingos de domicilio y responsive (verificado)

- **Instrucción del usuario:** centrar el bloque "Condiciones de la membresía" (imagen adjunta); que los turnos del día domingo sean sólo de cortes a domicilio, porque la peluquería los domingos está cerrada; y que toda la página se vea bien en el celular y en la computadora (responsive).
- **Decisión D26:** condiciones centradas (caja y texto) y regla de domingo sólo para domicilio; tarjetas de servicio en una columna por debajo de 480px. Precios, duraciones, extras y generador de turnos intactos.
- **Cambios:**
  - `index.html`: `#sunday-note` (oculto por defecto) después de `#chosen-service`, con el aviso de cierre de domingos.
  - `src/main.js`: `localClosedOnSundays()`, `clearDate()` (compartido con la membresía) y `syncSundayNote()`; `renderCalendar()` deshabilita los domingos en modo local con `.is-closed-sunday` y el motivo " (la peluquería está cerrada los domingos)" en el nombre accesible; `selectService()` limpia una fecha de domingo al pasar al corte general, refresca el calendario y el aviso; el campo `#date-input` rechaza el domingo con error; `validateDetails()` bloquea el envío si la fecha es domingo en modo local; `closedNote: "Cerrado los domingos"` en la tarjeta del corte general; corrección de `showError`/`hideError` con `fieldTarget()` para que `aria-invalid` caiga sobre `#date-input` (antes apuntaba a un `#date` inexistente).
  - `src/styles.css`: `.membership-conditions` con `margin: 18px auto 0` y `text-align: center`; `.conditions-list` con `list-style-position: inside`, sin `padding-left` y centrada; `.sunday-note`; `.calendar-day.is-closed-sunday:disabled`; `.service-card-note.is-muted`; en `max-width: 480px` `.service-cards` pasa a una columna.
  - `test-results/servicios-extras-check.mjs` (artefacto propio): `isoIn()` salta los domingos para que el flujo del corte general use un día hábil.
- **Verificaciones (Playwright/Chromium sobre `python -m http.server 4173`):**
  - Nuevo `test-results/r17-check.mjs`: **58/58** — bloque centrado (230,2 px a cada lado de los 1200 px de contenido, ancho 760px, `text-align: center` en bloque, lista, los 5 ítems y el total, `list-style-position: inside`); domicilio acepta el domingo con $30.000, 15 turnos y el día no deshabilitado; al elegir el corte general se limpia la fecha de domingo, se mantiene en el paso 1 con extras y $18.000; etiqueta "Cerrado los domingos" en la tarjeta del local y "Domingos $30.000" en la de domicilio; aviso visible en el paso 2; los cinco domingos del mes deshabilitados con el motivo en el nombre accesible; `#date-input` con domingo → error + `aria-invalid`, sin horarios y sin avanzar de paso; lunes aceptado, sin error, 15 turnos y mensaje de WhatsApp con fecha/hora; sin overflow en 320/390/768/1024/1440 en página, paso 1 y paso 2; objetivos táctiles ≥24px en todos los anchos; axe sin violaciones con condiciones visibles y con el aviso visible; sin JavaScript el aviso y las condiciones quedan ocultos; sin errores de consola ni de red (único 404 preexistente: `/images/favicon.png`).
  - Regresión: `test-results/membresias-check.mjs` **48/48**, `test-results/servicios-extras-check.mjs` **43/43** y `test-results/hero-slideshow-check.mjs` **31/31**.
- **Formato:** `npx.cmd prettier --check index.html src/styles.css src/main.js` sigue señalando sólo desviaciones preexistentes (JSON-LD `sameAs`, `tiktokUrl`, `argentinaNow`, `slotsForDate`, líneas largas de validación, `svg` del HTML); el código nuevo de los tres archivos coincide con la salida de Prettier.
- **Revisión visual:** capturas de `pagina-390`, `pagina-1440`, `paso1-320/390/768/1024/1440`, `paso2-320/390/768/1024/1440`, `condiciones-centradas-1440`, `paso2-local-domingos`, `paso2-domicilio-domingo` y `paso2-aviso-movil` inspeccionadas: condiciones centradas en escritorio, domingo tachado con fondo suave en el calendario, aviso legible en 320px y tarjetas de servicio en una columna en el celular (antes dos columnas apretadas a 390px).
- **Capturas:** `test-results/r17/` (gitignored). Script reproducible: `test-results/r17-check.mjs`.
- **Pendientes / fuera de alcance:** los tests de `tests/` siguen rotos por motivos anteriores; R08 (activación/despliegue remoto) sigue externo; no se hizo commit ni publicación.
- **Continuidad:** sin subagentes activos; archivos tocados sólo por el coordinador: `index.html`, `src/main.js`, `src/styles.css`, este plan y los artefactos de `test-results/`. Esfuerzo no expuesto; compactación no invocable. Estado persistido en este checkpoint.

### Checkpoint R18 — 2026-10-25 — horarios por modalidad (verificado)

- **Instrucción del usuario:** acomodar los horarios de los cortes. A domicilio: de 07:00 a 08:30 y de 12:45 a 15:45. En el local: de 09:00 a 12:30 y de 16:30 a 20:30. Archivos: `index.html`, `src/styles.css` y `src/main.js`.
- **Decisión D27:** franjas separadas por modalidad; el paso del turno sale de la duración ya definida en D18 (local 30 min, domicilio 45 min), de modo que las cuatro franjas quedan llenas sin turnos a medias: 09:00–12:30 = 7 × 30, 16:30–20:30 = 8 × 30, 07:00–08:30 = 2 × 45 y 12:45–15:45 = 4 × 45. El turno siempre termina dentro de la franja.
- **Cambios:**
  - `src/main.js`: `SLOT_MINUTES`/`WINDOWS` únicos reemplazados por `SCHEDULES` (entrada `local` y `home` con `label`, `stepMin` y `windows`) y `modeSchedule()`, que devuelve el horario del servicio activo (sin servicio → local). `slotsForDate()` arma la grilla con `modeSchedule()`, por lo que el filtrado de "hoy", el calendario, la validación de `validateDetails()` y el refresco de `selectService()` quedan todos sobre la misma lista. Nuevo `syncTimesSchedule()` pinta `#times-duration` y `#times-schedule` y se llama al inicio de `renderTimeSlots()`.
  - `index.html`: `#times-schedule` (`hidden` por defecto, después de `#times-heading`) y `#times-duration` como `span` dentro del pie `.field-hint` existente (el resto del pie no cambia y sigue legible sin JS).
  - `src/styles.css`: `.times-schedule` (12px, `var(--muted)`, `margin: -6px 0 14px`).
  - `test-results/servicios-extras-check.mjs` (artefacto propio): al cambiar de local a domicilio la hora 09:00 ya no existe, así que la comprobación de dirección ahora elige primero el turno 07:00 y además verifica que la hora anterior se limpia (44 comprobaciones en lugar de 43).
- **Verificaciones (Playwright/Chromium sobre `python -m http.server 4173`):**
  - Nuevo `test-results/r18-check.mjs`: **60/60** — local con los 15 turnos exactos `09:00 09:30 10:00 10:30 11:00 11:30 12:00 16:30 17:00 17:30 18:00 18:30 19:00 19:30 20:00` (sin 12:30 ni 20:30 como inicio) y aviso "Horarios en el local: de 09:00 a 12:30 y de 16:30 a 20:30." con pie "Turnos de 30 minutos."; domicilio con los 6 turnos exactos `07:00 07:45 12:45 13:30 14:15 15:00` (sin 08:30 ni 15:45 como inicio) y aviso "Horarios a domicilio: de 07:00 a 08:30 y de 12:45 a 15:45." con pie "Turnos de 45 minutos."; el aviso y el pie se repintan al cambiar de servicio; 07:00 lleva al paso 3 con la hora en la vista previa; al volver al local se limpia 07:00 y aparecen los 15 turnos, y al revés se limpia 10:00 y quedan los 6; el domingo de domicilio ofrece sus 6 turnos; mensaje de WhatsApp con `Hora preferida: 15:00`; la membresía no muestra franjas; sin overflow y objetivos ≥24px en 320/390/768/1024/1440 con la grilla de cada modo; axe sin violaciones con ambos avisos; sin JS el aviso queda oculto y el pie conserva el texto estático; sin errores de consola ni de red (único 404 preexistente: `/images/favicon.png`).
  - Regresión: `r17-check.mjs` **58/58**, `membresias-check.mjs` **48/48**, `servicios-extras-check.mjs` **44/44** y `hero-slideshow-check.mjs` **31/31**. Las suites corren en serie: dos suites simultáneas contra `python -m http.server` (de un solo hilo) producen `ERR_CONNECTION_REFUSED` espurios.
- **Formato:** `npx.cmd prettier --check index.html src/styles.css src/main.js` sigue marcando sólo desviaciones preexistentes (JSON-LD `sameAs`, `tiktokUrl`, líneas largas de `main.js` y el salto de atributos de `#times-heading`, que ya se re-formateaba antes de este encargo); `src/styles.css` conforme y las líneas nuevas de `index.html`/`src/main.js` coinciden exactamente con la salida de Prettier.
- **Revisión visual:** capturas `test-results/r18/paso2-1440.png`, `paso2-390.png`, `paso2-local-franjas.png`, `paso2-domicilio-franjas.png` y `paso2-movil.png`: el aviso de franjas y el pie conviven sin desbordes con la grilla en escritorio y en celular.
- **Capturas:** `test-results/r18/` (gitignored). Script reproducible: `test-results/r18-check.mjs`.
- **Pendientes / fuera de alcance:** los tests de `tests/` siguen rotos por motivos anteriores y esperan las franjas viejas; R08 (activación/despliegue remoto) sigue externo; no se hizo commit ni publicación. El aviso "Turnos de 45 minutos" no se propaga al `tests/` ni a `docs/` (fuera de los tres archivos pedidos).
- **Continuidad:** sin subagentes activos; archivos tocados sólo por el coordinador: `index.html`, `src/main.js`, `src/styles.css`, este plan y los artefactos de `test-results/`. Esfuerzo no expuesto; compactación no invocable. Estado persistido en este checkpoint.
