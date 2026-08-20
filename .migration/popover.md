# popover

2026-08-20, transformation engine, Base UI popover migration complete.

## Changed

- `components/ui/popover.tsx`: Migrated from `radix-ui` `Popover` to `@base-ui/react/popover` (`Root`, `Trigger`, `Portal` > `Positioner` > `Popup`).
- Supported `asChild` and `render` on `PopoverTrigger`.
- Leftover scan: clean (zero references to `radix-ui` in `popover.tsx`).

## Left alone

- None.

## Behavior changes

- None for consumers. Positioning and focus trapping match 1:1.

## Verify by hand

- Open date pickers and popover menus to confirm anchoring and positioning.
