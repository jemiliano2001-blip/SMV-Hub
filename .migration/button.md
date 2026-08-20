# button

2026-08-20, transformation engine, Base UI primitive migration complete.

## Changed

- `components/ui/button.tsx`: Migrated from Radix `Slot` to `@base-ui/react/button`.
- Supported both native `render` and backward-compatible `asChild`.
- Leftover scan: clean (zero references to `radix-ui` in `button.tsx`).

## Left alone

- None.

## Behavior changes

- None. Button variants and sizes match 1:1 with previous design tokens.

## Verify by hand

- Click buttons in UI (primary, outline, ghost, icon buttons).
- Verify keyboard focus visible ring (`focus-visible:ring-[3px] focus-visible:ring-ring/50`).
