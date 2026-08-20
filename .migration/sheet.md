# sheet

2026-08-20, transformation engine, Base UI sheet migration complete.

## Changed

- `components/ui/sheet.tsx`: Migrated from `radix-ui` `Dialog` to `@base-ui/react/dialog` (`Root`, `Trigger`, `Close`, `Portal`, `Backdrop` as SheetOverlay, `Popup` as SheetContent with edge positions top/bottom/left/right, `Title`, `Description`).
- Supported `asChild` and `render` across all trigger/close elements.
- Leftover scan: clean (zero references to `radix-ui` in `sheet.tsx`).

## Left alone

- None.

## Behavior changes

- None for consumers. Slide in/out transitions match 1:1.

## Verify by hand

- Open the mobile navigation drawer in `NavBar` and verify drawer slides smoothly and closes cleanly.
