# toggle-group

2026-08-20, transformation engine, Base UI toggle-group migration complete.

## Changed

- `components/ui/toggle-group.tsx`: Migrated from `radix-ui` `ToggleGroup` to `@base-ui/react/toggle-group` and `@base-ui/react/toggle`.
- Preserved single-mode string value normalization for seamless consumer compatibility (e.g. `ModuleFilterChips`).
- Leftover scan: clean (zero references to `radix-ui` in `toggle-group.tsx`).

## Left alone

- None.

## Behavior changes

- None for consumers. Items compose Base UI `Toggle` primitive.

## Verify by hand

- Click filter chips in `ModuleFilterChips` and verify active state switches and filters data correctly.
