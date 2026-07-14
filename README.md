# Estado actual vs. requerimientos

Los 17 requerimientos del PDF v2 quedaron implementados. Referencias al código y a las migraciones:

| # | Tarea | Cierre |
|---|--------|---------------|
| 1 | Contar por Lead ID | `/api/stats/route.ts` y `/api/dashboard/stats/route.ts` cuentan `Lead` (no `Budget`). |
| 2 | Campo **Seguro Responsable** | Enum `InsuranceResponsibility` + `Lead.insuranceResponsibility`, dropdown en el drawer del CRM, validado en la API antes de pasar a Ganado. Migración `20260713100000`. |
| 3 | Stats por compañía basadas en Seguro Responsable | Buckets recomputados en `/api/stats/route.ts` a partir de `Lead.insuranceResponsibility` + `insuranceCompany.name` (propio) / `vehicle.thirdPartySecure` (tercero). |
| 4 | Imputar ganados al mes de la orden | Campo `Lead.orderReceivedAt` seteado en la transición a Ganado; usado como criterio de imputación en las stats mensuales. |
| 5 | Vehículos en taller solo **Turno Asignado → Calidad** | `IN_SHOP_STAGES` en `/api/dashboard/stats/route.ts` y `/api/stats/route.ts`. KPI dashboard renombrado a "Vehículos en taller". |
| 6 | Módulo Calendario | `/calendario` con grilla mensual (celdas de altura fija, "+N más" tipo Google Calendar), lista de próximos eventos, checkbox de traslado inline. API `/api/calendar`. Migración `20260713130000` (campo `Repair.needsTransport`). |
| 7 | Columna **Turno a Asignar** | Valor `turno_a_asignar` en el enum + primera columna del kanban; auto-transición a `turno_asignado` al setear `scheduledAt`. Migración `20260713110000`. |
| 8 | Mail al asignar turno | Evento `turn_assigned` (`turno_a_asignar → turno_asignado`) con fecha formateada en es-AR. Toggle `AppSettings.notifyTurnAssigned`. |
| 9 | Eliminar **Ingresado** | Ya venía hecho (migración `20260425180000`). |
| 10 | Calidad → Experiencia auto al cargar entrega | Hook `willTriggerDelivery` en `/api/repairs/[id]/route.ts`. |
| 11 | Mail encuesta al pasar a Experiencia | Evento `customer_experience` + creación de `ServiceRating` con token público. |
| 12 | Mail al pasar a Refuerzo | Evento `lead_reinforcement` disparado desde el PATCH del Lead. Nuevo helper `buildLeadContext`. Toggle `AppSettings.notifyLeadReinforcement`. Migración `20260713120000` (nuevos flags). |
| 13 | Ocultar ganadas del Kanban CRM | Fetch pasa a `?tab=activas`; columnas Ganado / Perdido eliminadas del kanban. La transición sigue disponible desde el StatusPicker del drawer. |
| 14 | Módulo Caja (5 cajas + egresos + transferencias) | Modelos `CashBox` + `CashMovement` + link `RepairInvoicePayment.cashBoxId`, seed de las 5 cajas. `/caja` con tabs Cobros/General, KPIs contables (spec 4.4), dialogs de ingreso/egreso/transferencia. Migración `20260713140000`. |
| 15 | Cobro total → Archivado automático | Hook en `/api/repair-invoices/[id]/payments/route.ts`: suma facturado vs cobrado y pasa a `archivado` con tolerancia de $1. |
| 16 | Mover Ingresos del Dashboard al módulo Caja | Gráfico eliminado de `ChartsSection`; recreado en `CajaSection` con la serie devuelta por `/api/caja/boxes`. |
| 17 | Flujo Vehículos trimestral / semestral | `/api/dashboard/charts/route.ts` cambió de "últimos 7 días por día" a "últimos 6 meses por mes". |

**Deploy**: correr `bunx prisma migrate deploy` para aplicar las 5 migraciones nuevas (`20260713100000` → `20260713140000`) + setear `NEXT_PUBLIC_APP_URL` para que el link público de la encuesta funcione en producción.

---

# Plan de implementación

## FASE 1 — Fundaciones de datos

Objetivo: preparar la estructura necesaria para soportar el resto de funcionalidades.

### T2 — Seguro Responsable

Implementar:

- Enum `SeguroResponsable`
  - `PROPIO`
  - `TERCERO`
  - `PARTICULAR`
- Agregar el campo al modelo `Lead`.
- Mostrarlo en la tarjeta del CRM.
- Hacerlo obligatorio antes de marcar un Lead como **Ganado**.
- Al aceptar un presupuesto, guardar un **snapshot** para preservar el histórico aunque luego cambie el Lead.

---

## FASE 2 — Corrección de métricas y estadísticas

Objetivo: corregir toda la lógica del dashboard.

### Incluye

- **T1:** contar estadísticas por **Lead ID** en lugar de Budget.
- **T4:** imputar vehículos ganados según el **mes de la orden recibida**.
- **T3:** recalcular estadísticas por compañía utilizando **Seguro Responsable**.
- **T5:** considerar como "Vehículos en Taller" únicamente los estados:

  - Turno Asignado
  - Recepción
  - Presupuesto
  - Reparación
  - Pintura
  - Armado
  - Calidad

- **T17:** agregar estadísticas:

  - Trimestral
  - Semestral

- **T13:** ocultar los Leads Ganados del Kanban CRM.

---

## FASE 3 — Automatizaciones del Kanban de Producción

Objetivo: automatizar cambios de estado y comunicaciones.

### Incluye

### T7

Agregar nueva columna inicial:

```
Turno a Asignar
```

El flujo quedará:

```
Turno a Asignar
↓
Turno Asignado
↓
Recepción
↓
Presupuesto
↓
...
```

### T10

Cuando se complete:

```
deliveryDate
```

mover automáticamente el vehículo a:

```
Experiencia del Cliente
```

### T15

Cuando el vehículo tenga el **100% del cobro realizado**, mover automáticamente a:

```
Archivado
```

### Correos automáticos

Implementar envío de mails en:

- **T8:** al asignar turno.
- **T11:** al pasar a Experiencia del Cliente.
- **T12:** al pasar a Refuerzo.

---

## FASE 4 — Módulo Calendario

Nuevo módulo completo.

### Funcionalidades

- Vista mensual.
- Vista semanal.
- Mostrar:

  - Turnos
  - Entregas estimadas

- Checkbox:

  - Traslado requerido

- CRUD completo desde:

  - Tarjeta del vehículo
  - Calendario

---

## FASE 5 — Módulo Caja

Nuevo módulo financiero.

### Modelos

- `CashBox`
- `CashMovement`
- `CashTransfer`

### Tipos de movimientos

- Ingreso
- Egreso
- Transferencia

### Configuración inicial

Crear automáticamente las 5 cajas principales.

### Funcionalidades

- Cobro por vehículo.
- Caja general.
- Ingresos.
- Egresos.
- Transferencias entre cajas.
- Historial.
- Auditoría.
- Rol específico:

```
Contable
```

### T16

Mover completamente el gráfico de **Ingresos** desde el Dashboard al nuevo módulo **Caja**.