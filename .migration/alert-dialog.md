# alert-dialog

2026-08-20, transformation engine, Base UI alert-dialog migration complete.

## Changed

- `components/ui/alert-dialog.tsx`: Migrated from `radix-ui` `AlertDialog` to `@base-ui/react/alert-dialog` (`Root`, `Trigger`, `Portal`, `Backdrop` as AlertDialogOverlay, `Popup` as AlertDialogContent, `Title`, `Description`, `Close` as Action / Cancel).
- Supported `asChild` and `render` across all interactive elements.
- Leftover scan: clean (zero references to `radix-ui` in `alert-dialog.tsx`).

## Left alone

- None.

## Behavior changes

- None. Alert dialog remains fully modal and accessible.

## Verify by hand

- Trigger a deletion or critical action confirmation dialog (e.g. borrar orden, eliminar usuario).
