import { describe, expect, it } from "vitest"
import {
  includesHostingDeploy,
  parseEnvFile,
  projectFromFirebaseArgs,
  resolveFirebaseDeployEnv,
} from "../scripts/firebase-deploy-env.mjs"

const productionEnv = [
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=smv-brain",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=smv-brain.firebaseapp.com",
  "NEXT_PUBLIC_FIREBASE_API_KEY=production-key",
  "NEXT_PUBLIC_DEV_AUTH_BYPASS=false",
].join("\n")

describe("entorno del deploy manual de Firebase", () => {
  it("reconoce proyecto y target de Hosting en ambas sintaxis", () => {
    expect(
      projectFromFirebaseArgs([
        "deploy",
        "--project=smv-brain",
        "--only=hosting:smv-hub",
      ])
    ).toBe("smv-brain")
    expect(
      includesHostingDeploy([
        "deploy",
        "--project",
        "smv-brain",
        "--only",
        "hosting",
      ])
    ).toBe(true)
  })

  it("da prioridad a .env.production sobre variables locales", () => {
    const resolved = resolveFirebaseDeployEnv({
      args: [
        "deploy",
        "--project",
        "smv-brain",
        "--only",
        "hosting:smv-hub",
      ],
      cwd: "C:\\repo",
      baseEnv: {
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "smv-brain-dev",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "smv-brain-dev.firebaseapp.com",
      },
      readFile: () => productionEnv,
    })

    expect(resolved).toMatchObject({
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "smv-brain",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "smv-brain.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_API_KEY: "production-key",
      NEXT_PUBLIC_DEV_AUTH_BYPASS: "false",
    })
  })

  it("aborta Hosting sin proyecto explícito", () => {
    expect(() =>
      resolveFirebaseDeployEnv({
        args: ["deploy", "--only", "hosting"],
        cwd: "C:\\repo",
        readFile: () => productionEnv,
      })
    ).toThrow("--project explícito")
  })

  it("aborta si .env.production apunta a otro proyecto", () => {
    expect(() =>
      resolveFirebaseDeployEnv({
        args: ["deploy", "--project", "smv-brain", "--only", "hosting"],
        cwd: "C:\\repo",
        readFile: () =>
          productionEnv.replaceAll("smv-brain", "smv-brain-dev"),
      })
    ).toThrow("configuración Firebase esperada")
  })

  it("parsea valores entre comillas sin exponer comentarios", () => {
    expect(
      parseEnvFile('A="uno"\nB=\'dos\'\n# C=tres\nINVALIDA')
    ).toEqual({ A: "uno", B: "dos" })
  })
})
