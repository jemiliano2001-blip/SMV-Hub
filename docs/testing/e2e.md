# Pruebas E2E con Playwright

La suite usa Google Chrome y `@axe-core/playwright`. Por defecto Playwright
arranca la aplicación local; `PLAYWRIGHT_BASE_URL` permite apuntar a un
despliegue de desarrollo.

## Proyectos de la suite

| Proyecto | Cobertura | Requisitos |
|---|---|---|
| `desktop-chrome` | Login y proveedores a 1440×900 | Proveedores requiere storage state |
| `mobile-chrome` | Los mismos checks a 390×844 | Proveedores requiere storage state |
| `money-path` | Compra → orden → reporte → moneda → cierre contable | `smv-brain-dev` y contraseña E2E |

Los checks públicos validan el login, axe y que `/importar` no exponga contenido.
Con una sesión real también confirman que esa ruta retirada responde con
not-found.

## Ejecución básica

```powershell
npm.cmd run test:e2e
```

Sin variables privadas, los recorridos autenticados se omiten de forma
explícita; los tests públicos sí corren.

## Proveedores con Google Sign-In real

1. Arranca `npm.cmd run dev`.
2. Guarda una sesión local:

```powershell
npm.cmd exec playwright codegen -- --save-storage=playwright/.auth/user.json http://localhost:3000/login
```

3. Ejecuta:

```powershell
$env:PLAYWRIGHT_STORAGE_STATE = "playwright/.auth/user.json"
npm.cmd run test:e2e
```

El archivo contiene credenciales temporales y nunca debe versionarse.

## Camino del dinero

`e2e/camino-dinero.spec.ts`:

- inicia sesión con el usuario automatizado de `smv-brain-dev`;
- intercepta `/api/extraer`, por lo que no consume Gemini;
- crea órdenes USD/MXN reales en la base dev;
- comprueba que envío y moneda cuadren en reportes;
- valida que el cierre contable archive solo la moneda activa;
- limpia las órdenes y, cuando hay credenciales Admin disponibles, el lote
  contable.

Prepara el usuario con `scripts/crear-usuario-e2e.mjs` y define:

```powershell
$env:E2E_TEST_USER_PASSWORD = "<secreto-local>"
npm.cmd run test:e2e
```

Nunca ejecutes este proyecto contra `smv-brain`. El spec fija el usuario y la
limpieza para desarrollo, pero la configuración Firebase incluida en el build
también debe apuntar a `smv-brain-dev`.

## URL externa

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://URL-DE-DESARROLLO"
$env:PLAYWRIGHT_STORAGE_STATE = "playwright/.auth/user.json"
npm.cmd run test:e2e
```

Usa únicamente despliegues conectados a datos de desarrollo cuando el recorrido
pueda escribir.

## CI

`.github/workflows/ci.yml`:

- compila con variables `E2E_FIREBASE_*` de `smv-brain-dev`;
- sirve el build de producción con `next start`;
- instala Chrome y ejecuta toda la suite;
- recibe `E2E_TEST_USER_PASSWORD` desde GitHub Secrets;
- publica `playwright-report` como artifact aunque haya fallos.

El E2E corre en pull requests y cuando cambian Hosting, `e2e/` o
`playwright.config.ts`.
