# Fork Maintenance Guide

How to keep this fork up-to-date with upstream (`remnawave/subscription-page`) while preserving local customizations.

## Local customizations (what we maintain on top of upstream)

- **Payment providers:** Wata, Platega, CardLink integrated into a random-rotation flow. Source: `backend/src/common/{wata,platega,cardlink}/` plus `backend/src/modules/root/root.service.ts`.
- **Frontend payment button:** Tariff buttons rendered from a base64-encoded payload in `#pmt`. Source: `frontend/src/widgets/main/subscription-link/subscription-link.widget.tsx` and `frontend/src/entities/payment-store/`.
- **Payment webhook:** HMAC-signed outgoing notifications on tariff clicks, rate-limited per `shortUuid`. Source: `backend/src/modules/root/root.controller.ts` + `root.service.ts:sendPaymentWebhook`.
- **Localization refactor:** `getExpirationTextUtil` and related translation helpers live in `frontend/src/shared/utils/config-parser/config-parser.utils.ts` (not in the original `time-utils/get-expiration-text/` directory upstream uses).
- **CI:** `.github/workflows/ghcr-publish.yml` uses a canonical tag scheme (see README below). `.github/workflows/release-please.yml` generates release PRs from Conventional Commits.

## Git remotes

```
origin    https://github.com/DigneZzZ/subscription-page      # your fork
upstream  https://github.com/remnawave/subscription-page     # original
```

Verify: `git remote -v`.

## Routine upstream sync

Run this every time upstream releases a new version (or whenever you want to pull in changes).

```bash
# 1. Fetch upstream
git fetch upstream

# 2. Get on main and make sure it's up to date with origin
git checkout main
git pull origin main

# 3. Merge upstream/main into your main
#    -X ours tells git "on content conflicts, prefer our version"
#    This protects your payment/localization customizations.
git merge upstream/main -X ours --no-commit

# 4. Inspect the result carefully — especially these files:
git status
git diff --cached

# Pay special attention to:
#   - frontend/src/widgets/main/subscription-info/*       (we renamed + split)
#   - frontend/src/shared/utils/config-parser/*           (relocated util lives here)
#   - backend/src/modules/root/root.service.ts            (our payment rotation)
#   - backend/src/common/config/app-config/config.schema.ts  (our env vars)
#   - .github/workflows/                                  (we use our own setup)

# 5. Rebuild both parts — MUST pass before committing:
(cd backend && npm ci && npm run build) && \
(cd frontend && npm ci && npm run start:build)

# 6. Conclude the merge
git commit  # editor opens; summarize what upstream brings in
git push origin main
```

## Conflict patterns you'll see repeatedly

### "deleted by us" on a utility file upstream still uses

Means: you moved a function to a different file; upstream updated the old location. Action: keep the deletion (`git rm <file>`), then port any new logic from upstream's diff into your new location.

Example (already done on 2026-04-23): `get-expiration-text.util.ts` deletion — logic lives in `config-parser.utils.ts`. The "10-years → indefinitely" rule upstream added was ported there manually.

### "both modified" on `subscription-info-*.widget.tsx`

Means: upstream tweaked the legacy single-widget file; you split it into `expanded` + `collapsed`. Action: let `-X ours` keep your split, then cherry-pick UI-visible tweaks upstream made (colors, spacing, icons) into your expanded and collapsed variants manually. The `git diff upstream/main -- frontend/src/widgets/main/subscription-info/` shows what's meaningful.

### New `.github/workflows/*.yml` from upstream

Upstream occasionally adds new CI files that duplicate or conflict with our setup. Default action: **delete them** in the merge — our `ghcr-publish.yml` + `release-please.yml` combo covers everything. Verify the deleted workflow isn't doing something uniquely valuable (e.g., a security scan) before dropping.

## Releasing a new version of your fork

Commits in `main` follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` → minor bump
- `fix:` → patch bump
- `feat!:` or `BREAKING CHANGE:` footer → major bump (once we're past 1.0)
- `chore:`, `docs:`, `refactor:`, `ci:`, `test:` → no version bump

On each push to `main`, the `release-please` workflow opens (or updates) a PR titled something like `chore(release): release 7.2.0`. That PR:
1. Bumps `backend/package.json` and `frontend/package.json` in lockstep (linked versions).
2. Generates `CHANGELOG.md`.
3. Updates `.release-please-manifest.json`.

**To publish:** review the PR, merge it. Release-please will then:
- Create a GitHub release.
- Push a git tag `vX.Y.Z`.
- Tag triggers `ghcr-publish.yml`, which produces Docker images tagged `X.Y.Z`, `X.Y`, `X`, and **`latest`**.

## Docker image tag scheme

| Event | Tags the image gets |
|---|---|
| `git tag vX.Y.Z && git push origin vX.Y.Z` (done by release-please) | `X.Y.Z`, `X.Y`, `X`, **`latest`** |
| Push to `main` | `main`, `edge`, `sha-<short>` |
| Push to any other branch | `<branch-name>`, `sha-<short>` |
| Pull request opened | `pr-<number>` |

`latest` means "newest stable release" (semver tag), not "newest commit on main". Use `edge` for always-the-latest-main.

## When upstream changes are too invasive

If upstream does a major rewrite (filesystem reshuffle, breaking API changes in `@remnawave/subscription-page-types`, etc.), the `-X ours` strategy may paper over breakage rather than integrate it. Signs:
- `npm run build` fails in either half after the merge.
- `git diff upstream/main..HEAD -- <some area>` shows you're way out of sync.

Options, in order of least-effort first:
1. **Pick the version carefully:** only merge upstream up to a specific commit where your stuff still works. `git merge upstream/v7.1.8` instead of `upstream/main`.
2. **Rebase strategy:** `git checkout -b sync/upstream-X.Y.Z`, cherry-pick your customization commits onto a clean upstream base, fix each conflict per commit.
3. **Re-fork:** last resort, if upstream's history and yours have diverged beyond repair.

Avoid `git reset --hard upstream/main` — that wipes your customizations.
