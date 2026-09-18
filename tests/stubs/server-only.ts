// Stub de `server-only` para Vitest: el paquete real lanza al importarse fuera de un
// entorno React Server (no aplica la condicion "react-server" en Node). Los tests
// de lib/sat/* importan el catalogo real y necesitan que el import sea inerte.
export {}
