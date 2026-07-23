import { it } from "vitest"
import { buscarClavesSat } from "@/lib/sat/buscar"

it.skip("diagnostico temporal 2", () => {
  for (const q of [
    "perno de bola",
    "pasador de bola",
    "pasador de resorte",
    "percutor de bola",
    "boton de bola con resorte",
    "tornillo de bola con resorte",
    "plunger",
    "ball plunger",
    "spring plunger",
    "detent pin",
  ]) {
    console.log(`\n=== "${q}" ===`)
    const r = buscarClavesSat(q, 4)
    for (const x of r) {
      console.log(x.score, x.entry.clave, x.entry.descripcion, JSON.stringify(x.entry.palabrasClave))
    }
  }
})
