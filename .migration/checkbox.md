# checkbox

2026-08-20, transformation engine, Base UI checkbox migration complete.

## Changed

- `components/ui/checkbox.tsx`: Migrated from `radix-ui` `Checkbox` to `@base-ui/react/checkbox`.
- Supported presence attribute `data-checked` alongside `data-[state=checked]`.
- Leftover scan: clean (zero references to `radix-ui` in `checkbox.tsx`).

## Left alone

- None.

## Behavior changes

- None. Checkbox interactions and check indicators match 1:1.

## Verify by hand

- Click checkboxes in table selections and forms (e.g. multi-select items, permissions checkboxes).
