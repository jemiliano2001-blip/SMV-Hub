# tabs

2026-08-20, transformation engine, Base UI tabs migration complete.

## Changed

- `components/ui/tabs.tsx`: Migrated from `radix-ui` `Tabs` to `@base-ui/react/tabs` (`Tabs.Root`, `Tabs.List`, `Tabs.Tab` as TabsTrigger, `Tabs.Panel` as TabsContent).
- Supported `data-active` alongside `data-[state=active]`.
- Leftover scan: clean (zero references to `radix-ui` in `tabs.tsx`).

## Left alone

- None.

## Behavior changes

- None for consumers.

## Verify by hand

- Click across tabs in `ModuleTabs` and module sub-views (e.g. Endmills, Requisiciones, Proveedores).
