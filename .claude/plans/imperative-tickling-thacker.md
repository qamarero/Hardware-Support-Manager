# Plan: Actualizar proyecto local y confirmar estado

## Contexto
El repositorio local (`main`) está 6 commits detrás de `origin/main`. Los commits pendientes incluyen fixes críticos del sistema de filtros y documentación actualizada. El usuario quiere trabajar en `main` directamente (no en worktrees).

## Paso 1: Actualizar main con origin/main
```bash
cd /c/Users/Qamarero/Desktop/PROYECTOS/Hardware-Support-Manager-main
git pull origin main
```
Esto traerá los 6 commits pendientes:
- `8651b44` fix: resolve infinite reload loop when applying table filters
- `07130bb` docs: expand CLAUDE.md tooling section
- `4b48a7d` docs: add comprehensive project audit report
- `4b20217` fix: correct SQL array syntax in filter queries
- `b02116f` fix: rewrite filter system (Drizzle inArray, SSR, shallow mode)
- `9ebc3bd` fix: correct inArray type cast for PG enum columns

## Paso 2: Confirmar entendimiento del proyecto

### Estado actual del proyecto (HSM - Hardware Support Manager):
- **Fases 1-6 completadas**: Foundation, CRUD entidades, UI azul profundo + dashboard, CRUD incidencias/RMAs, pulido (dark mode, SLA, responsive)
- **Plan de Mejora completado**: Enriquecimiento clientes/incidencias, plantillas mensajes, alertas in-app, rediseño state machines, vista almacen, kanban RMA
- **Intercom integration**: Webhook funcional, bandeja email-style, auto-fill desde tickets
- **Analytics page**: Metricas de fallos y rendimiento proveedores
- **Articles catalog**: Catalogo de articulos con dropdowns cascading
- **Ultimos fixes**: Sistema de filtros reescrito con Drizzle inArray()

### Confirmacion herramientas disponibles:
- **16 agentes** especializados (database-architect, frontend-developer, fullstack-developer, debugger, etc.)
- **13+ skills** (.claude/skills/) + skills built-in (pdf, xlsx, pptx, docx)
- **8 comandos** (/commit, /code-review, /refactor-code, /ultra-think, /todo, etc.)
- **6 MCP servers** (supabase, postgresql, web-fetch, github, markitdown, figma)
- **Guia de seleccion** en CLAUDE.md para elegir herramienta segun tipo de tarea

## Verificacion
- `git log --oneline -5` tras pull para confirmar actualizacion
- `npm run build` opcional para verificar integridad
