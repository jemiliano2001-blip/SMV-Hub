# toggle

2026-08-20, transformation engine, Base UI toggle migration complete.

## Changed

- `components/ui/toggle.tsx`: Migrated from `radix-ui` `Toggle` to callable `@base-ui/react/toggle`.
- Supported `data-pressed` alongside `data-[state=on]`.
- Leftover scan: clean (zero references to `radix-ui` in `toggle.tsx`).

## Left alone

- None.

## Behavior changes

- None.

## Verify by hand

- Click toggles in filter bars.
