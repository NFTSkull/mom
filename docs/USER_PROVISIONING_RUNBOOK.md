# Runbook — aprovisionamiento de usuarios

1. No hay registro público ni `signUp` en UI.
2. Solo admin con `users.manage` + AAL2 crea/invita desde `/admin/usuarios`.
3. Preferir invitación Auth; en local de pruebas se permite `createUser` temporal (contraseña no se devuelve al navegador).
4. Asignar rol en `admin_profiles` (autoridad DB).
5. `can_view_sensitive_cases=false` por defecto; activar solo con confirmación.
6. `mfa_required=true` por defecto.
7. Desactivar preferible a borrar; el último admin no se puede desactivar/cambiar de rol.
8. Usuarios reales de la empresa: **no** se crean en B4.6 (solo `@nom035.local` sintéticos).
