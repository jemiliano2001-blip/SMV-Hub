# Diseño — Envío del reporte de compras por correo

Fecha: 2026-06-26  
Proyecto: SMV Hub (repo `compras-americanas`, Next.js 16 + React 19 + Tailwind v4)  
Estado: borrador

## Objetivo

Agregar un botón "Enviar por correo" junto al botón "Guardar PDF" en `/reportes` para que el
usuario pueda mandar el reporte de compras del periodo activo a uno o varios correos sin salir
de la aplicación.

## Por qué ahora

El reporte ya genera un PDF limpio vía `window.print()`. El siguiente paso natural es compartirlo
con partes interesadas (gerencia, contabilidad, socios en EE.UU.) sin que el receptor necesite
acceder a la app.

---

## Decisiones

### Servicio de correo: Resend

- API simple, serverless-first, ideal para Next.js/Vercel.
- Tier gratis: 3,000 correos/mes — suficiente para uso interno de SMV.
- Una sola dependencia: `resend` (~10 kB).
- Alternativa `nodemailer` descartada: requiere SMTP externo, más configuración, no funciona
  bien en Edge/serverless.

### Contenido del correo: tabla HTML

- Se renderiza la misma información que aparece en pantalla: KPIs + tabla agrupada.
- Sin generar PDF server-side (Puppeteer / headless Chrome sería sobredimensionado para este caso).
- El HTML se construye en `lib/email-reporte.ts` — pura función, sin DOM, testeable con Vitest.
- Incluye: logotipo textual "SMV", título, subtítulo (periodo), 4 KPIs, tabla agrupada con
  subtotales por grupo, fila de total general.

### UI: modal inline en CabeceraReporte

- Botón "✉ Enviar" junto al botón "Guardar PDF".
- Al clicar abre un modal con campo `destinatarios` (lista separada por comas o líneas).
- Asunto pre-rellenado: `"Reporte de compras — <subtitulo>"`.
- Botón "Enviar" en el modal dispara la llamada al API route.
- Feedback: estado de carga mientras envía; mensaje de éxito/error sin romper la UI.

### Autenticación

- El API route `/api/enviar-reporte` usa `verificarUsuarioAutorizado` (mismo patrón que
  `/api/extraer`): requiere Firebase ID token + correo en lista de autorizados.
- El cliente envía el token con `getIdToken()` desde `useUsuario`.

### Payload del API route

El cliente envía los datos ya calculados (evita re-fetch de Firestore en el servidor):

```typescript
{
  destinatarios: string[]   // correos destino
  asunto?: string           // opcional; default generado
  reporte: {
    titulo: string
    subtitulo: string       // periodo formateado
    moneda: string
    kpis: KpisReporte
    grupos: GrupoReporte[]
    totalGeneral: number
  }
}
```

---

## Alcance

| Incluir | Excluir (YAGNI) |
|---------|-----------------|
| Botón "Enviar" en CabeceraReporte | Adjuntar PDF generado server-side |
| Modal con campo destinatarios | Plantillas de correo configurables |
| API route que valida auth y envía | Historial de correos enviados |
| HTML email con KPIs + tabla | Programación de envíos automáticos |
| Feedback de éxito/error al usuario | CC / BCC en el modal |
| Variable de entorno `RESEND_API_KEY` | Integración con SendGrid/SES |

---

## Arquitectura de archivos

```
lib/email-reporte.ts                     → función pura renderizarEmailReporte()
app/api/enviar-reporte/route.ts          → POST handler (auth + Resend)
app/reportes/components/ModalEnviarReporte.tsx  → modal UI con react-hook-form + zod
app/reportes/components/CabeceraReporte.tsx     → agregar botón + invocar modal
```

No se modifica `lib/reportes.ts` ni ningún schema de datos de Firestore.

---

## Flujo del usuario

1. Usuario filtra periodo y agrupación en `/reportes`.
2. Clic en "✉ Enviar" → abre modal.
3. Escribe destinatarios (ej. `gerencia@smv.mx, socio@empresa.com`).
4. Asunto pre-rellenado editable.
5. Clic "Enviar" → spinner mientras procesa.
6. Éxito: banner verde "Correo enviado a X destinatarios". Modal se cierra.
7. Error: banner rojo con mensaje; botón "Reintentar". Modal permanece abierto.

---

## Manejo de errores

| Situación | Respuesta al usuario |
|-----------|----------------------|
| Campo de destinatarios vacío | Validación en cliente (zod), no llega al server |
| Correo con formato inválido | Validación en cliente |
| Token expirado | "Tu sesión expiró. Recarga la página." |
| Resend falla (red, API down) | "No se pudo enviar. Intenta de nuevo en unos minutos." |
| `RESEND_API_KEY` no configurada | Error 500, log en servidor |

---

## Variables de entorno nuevas

```bash
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM=noreply@smv.mx            # dominio verificado en Resend
```

`RESEND_FROM` puede apuntar a un dominio verificado en Resend o al dominio de pruebas de Resend
(`onboarding@resend.dev`) mientras no se verifica el dominio propio.

---

## Email HTML — contenido mínimo

```
De: noreply@smv.mx
Para: <destinatarios>
Asunto: Reporte de compras — <subtitulo>

[Cabecera: SMV | Reporte de compras | <subtitulo>]
[4 KPIs en fila: Órdenes | Gasto total | Ticket promedio | Proveedores]
[Tabla agrupada con columnas: Grupo | Descripción | ... | Total]
[Fila total general]
[Pie: Generado automáticamente — SMV Hub]
```

---

## Verificación

- `lib/email-reporte.ts`: prueba Vitest que valida que el HTML generado contiene
  el título, KPIs y al menos una fila de grupo.
- API route: no se prueba con Firebase real; test de integración opcional.
- Manual: enviar a correo propio y verificar visualización en Gmail/Outlook.
- `npm run lint && npm run build` deben pasar.

---

## Referencias

- Resend docs: https://resend.com/docs/send-with-nextjs
- Patrón auth existente: `lib/api-auth.ts`
- Tipos de reporte: `lib/reportes.ts` (`KpisReporte`, `GrupoReporte`)
