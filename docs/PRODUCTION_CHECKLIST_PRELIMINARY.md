# Checklist preliminar de producción

**Veredicto producción: NO GO / PRODUCCIÓN BLOQUEADA** (B4.8).

Bloqueadores activos:

- Supabase: límite free 2/2 — falta proyecto exclusivo `nom035-production`.
- Empresa real no configurada en Production.
- Correo admin productivo no autorizado/proporcionado.
- Deploy productivo e import de 83 aplazados.

Ver `docs/B4_8_PRODUCTION_CUTOVER.md`.

| Área | Estado |
|---|---|
| Seguridad Auth/RBAC/MFA | certificado en staging; pendiente wire Production |
| Disponibilidad / carga | pendiente |
| Backups / PITR | pendiente (Production) |
| SMTP real | pendiente |
| Dominio / DNS / TLS final | pendiente |
| Vercel Production exclusivo | proyecto `nom035-production` creado; sin deploy |
| Supabase Production | **bloqueador** (no creado — cupo free) |
| Usuarios reales / import 83 | **bloqueador** (sin DB Production + empresa + admin) |
| Guía III | pendiente |
| Owner operativo / soporte | pendiente |
| Monitoreo / incidentes | pendiente |
| Retención / privacidad | parcial |

No marcar GO para producción hasta cerrar bloqueadores de B4.8.
