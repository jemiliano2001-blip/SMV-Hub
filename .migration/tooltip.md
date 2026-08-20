# tooltip

2026-08-20, transformation engine, Base UI tooltip migration complete.

## Changed

- `components/ui/tooltip.tsx`: Migrated from `radix-ui` `Tooltip` to `@base-ui/react/tooltip` (`Provider`, `Root`, `Trigger`, `Portal` > `Positioner` > `Popup` + `Arrow`).
- Supported `asChild` on `TooltipTrigger` via `render` delegation.
- Leftover scan: clean (zero references to `radix-ui` in `tooltip.tsx`).

## Left alone

- None.

## Behavior changes

- None. Delay is mapped from `delayDuration` to Base UI `delay`.

## Verify by hand

- Hover over icons and action buttons with tooltips to confirm popup positioning and arrow attachment.
