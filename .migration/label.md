# label

2026-08-20, transformation engine, Native accessible label migration complete.

## Changed

- `components/ui/label.tsx`: Migrated from `radix-ui` `Label.Root` to semantic native `<label>` with `select-none` and `peer-disabled` attributes.
- Leftover scan: clean (zero references to `radix-ui` in `label.tsx`).

## Left alone

- None.

## Behavior changes

- None. Compatible with all form consumers and htmlFor associations.

## Verify by hand

- Click on labels connected to inputs and checkboxes in forms to ensure focus switches to target.
