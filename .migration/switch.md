# switch

2026-08-20, transformation engine, Base UI switch migration complete.

## Changed

- `components/ui/switch.tsx`: Migrated from `radix-ui` `Switch` to `@base-ui/react/switch`.
- Supported presence attributes `data-checked` and `data-unchecked` alongside legacy `data-[state=...]`.
- Leftover scan: clean (zero references to `radix-ui` in `switch.tsx`).

## Left alone

- None.

## Behavior changes

- None. Toggle animations and switch thumbs match 1:1.

## Verify by hand

- Click switch controls in settings and filters (toggle active/inactive states).
