# select

2026-08-20, transformation engine, Base UI select migration complete.

## Changed

- `components/ui/select.tsx`: Migrated from `radix-ui` `Select` to `@base-ui/react/select` (`Root`, `Group`, `Value`, `Trigger`, `Portal` > `Positioner` > `Popup` > `List`, `Item`, `ItemText`, `ItemIndicator`, `GroupLabel` as SelectLabel, `Separator`, `ScrollUpArrow` / `ScrollDownArrow`).
- Replaced `SelectPrimitive.Viewport` with `SelectPrimitive.List`.
- Replaced `SelectPrimitive.Label` with `SelectPrimitive.GroupLabel`.
- Leftover scan: clean (zero references to `radix-ui` in `select.tsx`).

## Left alone

- None.

## Behavior changes

- `alignItemWithTrigger` enabled for `position="item-aligned"` and disabled for `position="popper"`.

## Verify by hand

- Open selects in forms and filters (e.g. proveedor filter, moneda select, area select) and select options via mouse and keyboard arrows.
