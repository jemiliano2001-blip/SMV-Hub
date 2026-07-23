# Pruebas E2E de experiencia y accesibilidad

La suite usa Playwright, Google Chrome instalado y axe. No activa el bypass de autenticación.

## Recorridos públicos

```powershell
npm.cmd run test:e2e
```

Esto valida login, accesibilidad automática en escritorio/móvil y que una visita sin sesión a `/importar` no exponga contenido. Con una sesión real, la suite también confirma que la ruta retirada responde con la página no encontrada.

## Proveedores con sesión real

1. Arranca la aplicación con `npm.cmd run dev`.
2. En otra terminal abre un Chrome controlado, inicia sesión con Google y ciérralo al terminar:

```powershell
npm.cmd exec playwright codegen -- --save-storage=playwright/.auth/user.json http://localhost:3000/login
```

3. Ejecuta:

```powershell
$env:PLAYWRIGHT_STORAGE_STATE = "playwright/.auth/user.json"
npm.cmd run test:e2e
```

También se puede probar un despliegue de desarrollo:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://URL-DE-DESARROLLO"
$env:PLAYWRIGHT_STORAGE_STATE = "playwright/.auth/user.json"
npm.cmd run test:e2e
```

Nunca se debe versionar el storage state: contiene credenciales temporales de sesión. Las pruebas E2E no deben apuntar al proyecto de producción cuando creen o modifiquen datos.
