# dialog

2026-08-20, transformation engine, Base UI dialog migration complete.

## Changed

- `components/ui/dialog.tsx`: Migrated from `radix-ui` `Dialog` to `@base-ui/react/dialog` (`Root`, `Trigger`, `Portal`, `Backdrop` as DialogOverlay, `Popup` as DialogContent, `Title`, `Description`, `Close`).
- Supported `asChild` and `render` across all trigger/close elements.
- Leftover scan: clean (zero references to `radix-ui` in `dialog.tsx`).

## Left alone

- None.

## Behavior changes

- None. Modals remain centered and accessible with smooth backdrop transitions.

## Verify by hand

- Open detail/edit modals across the app (e.g. ordenes detail modal, requisicion modal, export modal) and close via Esc key, backdrop click, or Close button.
