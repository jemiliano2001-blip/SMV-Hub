---
title: Firebase Performance Monitoring
date: 2026-07-22
type: source-synthesis
---

# Firebase Performance Monitoring

## Fuente oficial

- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mon)

## Capacidad

Firebase Performance Monitoring recopila métricas de carga de página y solicitudes de red, permite trazas personalizadas, alertas y segmentación por aplicación o dispositivo. La documentación indica que no almacena información de identificación personal de manera permanente; aun así, los nombres y atributos personalizados deben diseñarse para no incluir PII.

## Trazas propuestas

- `route_ordenes_ready`
- `route_requisiciones_ready`
- `firestore_list_first_page`
- `invoice_extract_total`
- `report_export_xlsx`
- `odoo_sync_visible_refresh`
- `petty_cash_mutation_confirmed`

Los atributos deben ser categorías de baja cardinalidad: módulo, resultado, conexión y rango de tamaño. No incluir correos, facturas, proveedores, descripciones ni IDs de documentos.

## Web Vitals

Combinar Performance Monitoring con el mecanismo de Web Vitals de Next.js permite separar dos preguntas:

- ¿La página carga y responde bien para el navegador real?
- ¿Qué dependencia o consulta consume el tiempo dentro del flujo?

## Métricas de producto sugeridas

- tiempo hasta primera lista utilizable;
- tiempo desde click hasta confirmación persistida;
- porcentaje de reintentos;
- fallos por permiso/red/validación;
- uso de móvil y conexiones lentas;
- duración y tasa de error de exportación/extracción.

La observabilidad debe implantarse antes del refactor para poder demostrar beneficio y detectar regresiones.

