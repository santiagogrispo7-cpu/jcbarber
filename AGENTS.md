# JC BARBER — entrada para agentes

La fuente de verdad del proyecto es [PLAN_IMPLEMENTACION.md](PLAN_IMPLEMENTACION.md).

Antes de trabajar, leer su **Estado operativo**, el tablero, las decisiones y el último handoff. Respetar el alcance del encargo activo: la sesión inicial entregó planificación y skills; la implementación de la web está pendiente.

Cuando se solicite ejecutar el plan:

1. Reconciliar el estado con los archivos y `git status --short`; conservar trabajo previo.
2. Continuar por la primera tarea pendiente cuyas dependencias estén completas. No rehacer tareas verificadas sin evidencia de regresión.
3. Un único coordinador actualiza el plan y asigna archivos a los subagentes. Delegar sólo unidades independientes con entregables y pruebas explícitas.
4. Resolver automáticamente decisiones técnicas y ejecutar comprobaciones sin menús ni confirmaciones. Usar `grill-me` sólo si falta un dato de negocio imprescindible que no admita una solución honesta por defecto.
5. Seleccionar el mayor esfuerzo disponible y permitido por el modelo/harness; registrar el valor real o su falta de exposición. No afirmar que una instrucción Markdown cambió la configuración.
6. Guardar un checkpoint al terminar cada subtarea y antes de compactar. A partir del 50% de contexto, usar `/compact` o el mecanismo equivalente si es invocable; aplicar el procedimiento alternativo del plan si no lo es.
7. Cerrar cada intervención con un handoff: dónde quedó, cambios, pruebas, pendientes, aciertos, fallos y mejoras concretas.

Skills instaladas en `.agents/skills/`; leer únicamente las pertinentes. Si el agente no las descubre, abrir directamente su `SKILL.md`. Fuentes y hashes en `skills-lock.json`.

En Windows PowerShell usar `npm.cmd` y `npx.cmd`. La política actual bloquea `npm.ps1`; no hace falta modificarla. La subcarpeta `jcbarber/` produjo un aviso de acceso denegado: trabajar en la raíz accesible y no cambiar permisos para explorarla.
