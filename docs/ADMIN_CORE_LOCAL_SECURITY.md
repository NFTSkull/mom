# Seguridad local del panel administrativo (B4.4 → supersedido por B4.6)

## Estado

**Supersedido.** Desde B4.6 la autoridad es Supabase Auth + PostgreSQL RBAC + MFA (`docs/AUTH_SECURITY_MODEL.md`).

Este documento se conserva como histórico del control loopback previo a Auth.

## Histórico B4.4

Sin Auth, el panel solo operaba en loopback contra Supabase local con:

```
NOM035_ADMIN_BACKEND_MODE=local_supabase
NOM035_ADMIN_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Guard (`admin-access-guard.ts`) exigía modo local, no producción, hostname loopback y Origin permitido en mutaciones.

## Actual (B4.6)

```
NOM035_ADMIN_BACKEND_MODE=auth_rbac
```

- Login / MFA / permisos DB.
- Origin sigue validándose en mutaciones.
- Sin registro público; usuarios solo por operación administrativa.
