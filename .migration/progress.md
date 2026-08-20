# progress

2026-08-20, transformation engine, Base UI progress migration complete.

## Changed

- `components/ui/progress.tsx`: Migrated from `radix-ui` `Progress` to `@base-ui/react/progress` (`Progress.Root` > `Progress.Track` > `Progress.Indicator`).
- Leftover scan: clean (zero references to `radix-ui` in `progress.tsx`).

## Left alone

- None.

## Behavior changes

- Fill percentage is calculated natively by Base UI rather than manual inline `translateX`.

## Verify by hand

- Verify progress bars in IA recommendation bars and loading indicators.
