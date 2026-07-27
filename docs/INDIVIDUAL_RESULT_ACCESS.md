# Acceso a resultados individuales — contrato de UI

**Estado:** contrato documental (B4.1).  
**No se crean usuarios ni Auth en este bloque.**

Mientras no exista Auth/RBAC:

- El panel admin **no** mostrará el detalle de respuestas individuales completas.
- Solo se mantienen agregados / resúmenes existentes.
- La vista individual detallada se habilitará únicamente para roles autorizados.

## Matriz de acceso prevista

| Rol | Acceso |
|---|---|
| Psicólogo autorizado (`can_view_sensitive_cases`) | Respuestas individuales, puntajes, dominios, alertas y seguimiento confidencial |
| RH | Agregados y seguimiento operativo según permiso |
| Dirección | Agregados ejecutivos |
| Admin técnico | Operación del sistema; **sin** asumir acceso clínico |
| Trabajador | Revisión previa al envío y confirmación posterior; **sin** diagnóstico automático ni puntajes en pantalla pública |

## Notas

- Resultados Guía I con alerta de seguimiento deben tratarse como información sensible.
- Resultados legacy sin `scoringVersion` deben etiquetarse como “versión no registrada” y no mezclarse silenciosamente en análisis certificados.
