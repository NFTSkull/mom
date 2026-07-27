# Modelo de seguridad Auth — B4.6

- Supabase Auth local; sin registro público (`enable_signup=false`).
- Proxy (`src/proxy.ts`) refresca sesión con `getClaims`; no es la única barrera.
- Route Handlers: `requireAdminApiAuth` → perfil activo + permiso DB + AAL2.
- RPCs admin: `require_admin_permission` interno; EXECUTE a `authenticated`.
- `service_role` solo: invitación Auth, Storage admin, evaluación/queja pública, seed.
- Roles desde `admin_profiles`, nunca `raw_user_meta_data`.
- Revocación inmediata: `active=false` hace fallar la siguiente petición aunque el JWT no haya vencido.
- Último admin activo protegido por trigger.
