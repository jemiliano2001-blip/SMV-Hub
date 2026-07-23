---
title: Firebase, datos y experiencia
date: 2026-07-22
type: source-synthesis
---

# Firebase, datos y experiencia

## Fuentes oficiales

- [Acceso sin conexión en Cloud Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Paginación con cursores](https://firebase.google.com/docs/firestore/query-data/query-cursors)
- [Precios de Cloud Firestore](https://firebase.google.com/docs/firestore/pricing)

## Paginación

Firestore documenta `limit()` y cursores como `startAfter()` para recuperar resultados por lotes. Los offsets deben evitarse en recorridos grandes porque los documentos omitidos también generan lecturas facturables.

Para SMV Hub, la paginación debe ser parte del contrato de repositorio:

```ts
type PageRequest<Cursor> = {
  size: number;
  cursor?: Cursor;
  filters?: Record<string, unknown>;
};

type PageResult<T, Cursor> = {
  items: T[];
  nextCursor?: Cursor;
  hasMore: boolean;
};
```

La interfaz debe conservar filtros, comunicar “cargando más” y evitar saltos de scroll.

## Offline

Firestore puede servir datos, consultas y escrituras desde caché y sincronizarlos al recuperar conexión. En web, la persistencia está desactivada por defecto. Firebase advierte que la caché persiste entre sesiones y recomienda confirmar que el dispositivo sea confiable cuando se maneje información sensible.

Los metadatos de snapshots permiten distinguir datos de caché y cambios pendientes. SMV Hub podría usar esta información para mostrar “Sin conexión”, “Datos guardados localmente” o “Sincronizando”.

## Recomendación de alcance

- Candidato: Almacén, Baños y Horas Extra en dispositivos asignados.
- Requiere consentimiento: dispositivos compartidos de taller.
- Excluido por defecto: Finanzas, Caja Chica, Administración y Usuarios.
- Nunca presentar caché antigua como dato confirmado sin indicador visible.

## Riesgos

- Conflictos de última escritura.
- Datos sensibles persistentes en un navegador compartido.
- Consultas locales que aparentan estar completas cuando solo existe una caché parcial.
- Doble envío visual si no se distingue pending de confirmado.

