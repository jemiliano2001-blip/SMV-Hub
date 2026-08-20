# badge

2026-08-20, transformation engine, Base UI standard component migration complete.

## Changed

- `components/ui/badge.tsx`: Migrated from Radix `Slot` to native element with React cloneElement support for `asChild`.
- Leftover scan: clean (zero references to `radix-ui` in `badge.tsx`).

## Left alone

- None.

## Behavior changes

- None. Badge variants match 1:1.

## Verify by hand

- Verify badges rendered across tables (`default`, `secondary`, `destructive`, `outline`).
