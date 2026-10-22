## Summary

<!-- One or two sentences; the PR title must match the intended squashed commit (`feat(web): …`, `fix(api): …`). -->

## Checklist

- [ ] `pnpm lint` and `pnpm typecheck` pass
- [ ] `pnpm test` passes; changed logic ships with tests in the same commit
- [ ] e2e flows (`apps/web/e2e`) added/updated for user-visible race or auth changes
- [ ] UI changes: screenshots attached (desktop and mobile)
- [ ] No `console.log` left, no new deprecated APIs, i18n keys added for both locales

## Risk / rollback

<!-- What can break and how to revert: feature flag, git revert, migration note. Delete if trivial. -->
