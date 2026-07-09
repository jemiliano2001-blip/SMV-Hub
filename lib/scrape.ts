import { z } from "zod";

export const priceSchema = z.string().nullable().transform((val, ctx) => {
  if (!val) return null;
  const cleaned = val.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  
  const parts = cleaned.split('.');
  let finalStr = cleaned;
  if (parts.length > 2) {
    const decimals = parts.pop();
    const integer = parts.join('');
    finalStr = `${integer}.${decimals}`;
  }
  
  const num = parseFloat(finalStr);
  if (isNaN(num)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Precio inválido",
    });
    return z.NEVER;
  }
  return num;
});

export function parsePrice(priceStr: string | null | undefined): number | null {
  const parsed = priceSchema.safeParse(priceStr || null);
  return parsed.success ? parsed.data : null;
}
