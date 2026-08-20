# dropdown-menu

2026-08-20, transformation engine, Base UI dropdown-menu migration complete.

## Changed

- `components/ui/dropdown-menu.tsx`: Migrated from `radix-ui` `DropdownMenu` to `@base-ui/react/menu` (`Menu.Root`, `Menu.Trigger`, `Menu.Portal` > `Menu.Positioner` > `Menu.Popup`, `Menu.Item`, `Menu.Group`, `Menu.GroupLabel` as DropdownMenuLabel, `Menu.CheckboxItem`, `Menu.CheckboxItemIndicator`, `Menu.RadioGroup`, `Menu.RadioItem`, `Menu.RadioItemIndicator`, `Menu.Separator`, `Menu.SubmenuRoot`, `Menu.SubmenuTrigger`).
- Supported `asChild` / `render` on `DropdownMenuTrigger`.
- Leftover scan: clean (zero references to `radix-ui` in `dropdown-menu.tsx`).

## Left alone

- None.

## Behavior changes

- None for consumers. Submenus and keyboard navigation match 1:1.

## Verify by hand

- Click dropdown menus and submenus across the app to verify trigger focus and open/close interaction.
