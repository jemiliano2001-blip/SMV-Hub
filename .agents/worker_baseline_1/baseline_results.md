# Baseline Results

## npm run lint Output

```
> compras-americanas@0.1.0 lint
> eslint


D:\proyectos_code\SMV\compras-americanas\tests\extraer-route.test.ts
   48:49  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   56:48  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   64:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   73:21  warning  '_' is assigned a value but never used    @typescript-eslint/no-unused-vars
   73:31  warning  '__' is assigned a value but never used   @typescript-eslint/no-unused-vars
   75:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   84:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   92:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   98:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  105:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  114:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  120:71  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  126:60  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

D:\proyectos_code\SMV\compras-americanas\tests\schemas.test.ts
   59:21  warning  '_' is assigned a value but never used           @typescript-eslint/no-unused-vars
   66:20  warning  '_' is assigned a value but never used           @typescript-eslint/no-unused-vars
   83:24  warning  '_' is assigned a value but never used           @typescript-eslint/no-unused-vars
  160:22  warning  '_' is assigned a value but never used           @typescript-eslint/no-unused-vars
  165:24  warning  '_' is assigned a value but never used           @typescript-eslint/no-unused-vars
  210:21  warning  '_' is assigned a value but never used           @typescript-eslint/no-unused-vars
  227:13  warning  'imagenUrl' is assigned a value but never used   @typescript-eslint/no-unused-vars
  227:24  warning  'imagenPath' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 21 problems (11 errors, 10 warnings)
```

## npm test Output

```
> compras-americanas@0.1.0 test
> vitest run


 RUN  v4.1.9 D:/proyectos_code/SMV/compras-americanas

 ✓ tests/importar.test.ts (31 tests) 11ms
 ✓ tests/schemas.test.ts (32 tests) 16ms
stderr | tests/extraer-route.test.ts > POST /api/extraer > retorna 502 si Gemini lanza error
[extraer] Gemini error: Error: Network error
    at D:/proyectos_code/SMV/compras-americanas/tests/extraer-route.test.ts:91:47
    at file:///D:/proyectos_code/SMV/compras-americanas/node_modules/@vitest/runner/dist/chunk-artifact.js:302:11
    at file:///D:/proyectos_code/SMV/compras-americanas/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:26
    at file:///D:/proyectos_code/SMV/compras-americanas/node_modules/@vitest/runner/dist/chunk-artifact.js:2326:20
    at new Promise (<anonymous>)
    at runWithCancel (file:///D:/proyectos_code/SMV/compras-americanas/node_modules/@vitest/runner/dist/chunk-artifact.js:2323:10)
    at file:///D:/proyectos_code/SMV/compras-americanas/node_modules/@vitest/runner/dist/chunk-artifact.js:2305:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///D:/proyectos_code/SMV/compras-americanas/node_modules/@vitest/runner/dist/chunk-artifact.js:2272:10)
    at file:///D:/proyectos_code/SMV/compras-americanas/node_modules/@vitest/runner/dist/chunk-artifact.js:2955:64

 ✓ tests/extraer-route.test.ts (11 tests) 44ms

 Test Files  3 passed (3)
      Tests  74 passed (74)
   Start at  16:11:58
   Duration  333ms (transform 153ms, setup 0ms, import 310ms, tests 71ms, environment 0ms)
```
