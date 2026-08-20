# separator

2026-08-20, transformation engine, Base UI separator migration complete.

## Changed

- `components/ui/separator.tsx`: Migrated from `radix-ui` `Separator.Root` to callable `@base-ui/react/separator`.
- Leftover scan: clean (zero references to `radix-ui` in `separator.tsx`).

## Left alone

- None.

## Behavior changes

- `decorative` prop was dropped as Base UI separators provide clean semantic separators.

## Verify by hand

- Verify horizontal and vertical dividers in layouts, sidebars, and menus.
