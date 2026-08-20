# slider

2026-08-20, transformation engine, Base UI slider migration complete.

## Changed

- `components/ui/slider.tsx`: Migrated from `radix-ui` `Slider` to `@base-ui/react/slider` (`Root` > `Control` > `Track` > `Indicator` + `Thumb`).
- Range part renamed to `Indicator`.
- Leftover scan: clean (zero references to `radix-ui` in `slider.tsx`).

## Left alone

- None.

## Behavior changes

- Added `Control` interactive container as required by Base UI slider anatomy.

## Verify by hand

- Drag slider thumb in Requisiciones AI recommendations / filters.
