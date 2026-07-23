---
title: Firestore Query Explain
date: 2026-07-22
type: source-synthesis
---

# Firestore Query Explain

## Fuente oficial

- [Explain query performance](https://firebase.google.com/docs/firestore/query-explain)

## Capacidad

Query Explain permite inspeccionar el plan y, opcionalmente, ejecutar una consulta para obtener duración, documentos leídos, entradas de índice examinadas e índices utilizados. Está disponible en clientes de servidor y requiere permisos IAM adecuados.

El modo de análisis puede generar lecturas y debe usarse deliberadamente. El modo de explicación sin análisis tiene un costo mínimo documentado de una lectura.

## Aplicación a SMV Hub

Priorizar consultas que:

- combinan filtros, orden y rangos;
- alimentan inteligencia cruzada de proveedores;
- procesan cobranza o reportes financieros;
- muestran listas de alto volumen;
- tienen diferencias notables entre desarrollo y producción.

## Proceso recomendado

1. Registrar la consulta y su objetivo funcional.
2. Capturar plan, duración y lecturas en un entorno representativo.
3. Ajustar índice, filtros o modelo de acceso.
4. Repetir la medición y conservar el antes/después.
5. Evitar crear índices “por si acaso”; cada índice tiene costo de escritura y almacenamiento.

## Límite arquitectónico

Las consultas del navegador no deben recibir privilegios adicionales para explicar planes. El diagnóstico debe ejecutarse en tooling administrativo o Functions controladas, separado de la experiencia del usuario.

