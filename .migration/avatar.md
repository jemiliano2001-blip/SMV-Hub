# avatar

2026-08-20, transformation engine, Base UI avatar migration complete.

## Changed

- `components/ui/avatar.tsx`: Migrated from `radix-ui` `Avatar` to `@base-ui/react/avatar`.
- Leftover scan: clean (zero references to `radix-ui` in `avatar.tsx`).

## Left alone

- None.

## Behavior changes

- None. Avatar renders image with fallback initials.

## Verify by hand

- Verify user profile avatars and initials fallback in header and user lists.
