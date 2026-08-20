# accordion

2026-08-20, transformation engine, Base UI accordion migration complete.

## Changed

- `components/ui/accordion.tsx`: Migrated from `radix-ui` `Accordion` to `@base-ui/react/accordion` (`Root`, `Item`, `Header`, `Trigger`, `Panel` as AccordionContent).
- Handled array value normalization for single and multiple modes.
- Leftover scan: clean (zero references to `radix-ui` in `accordion.tsx`).

## Left alone

- None.

## Behavior changes

- None for consumers. Expand/collapse mechanics match 1:1.

## Verify by hand

- Expand and collapse accordion items and verify chevron rotation.
