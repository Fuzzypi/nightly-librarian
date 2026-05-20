# Verification

Run the local verification gate before committing or pushing:

```bash
npm run verify
```

The command is intentionally cheap and local. It does not require credentials, network access, production databases, or paid services.

## What It Checks

- `package.json` and `package-lock.json` parse as JSON
- markdown local links point at existing files
- tracked files do not contain common secret/token patterns
- Python scripts compile
- JavaScript files parse with `node --check`
- ignored/generated directories are not required

## Additional Release Checks

Before pushing a baseline or release change, also run:

```bash
git status --short --branch
git diff --check
```

For artifact-generation changes, preserve checks for:

- explicit digest import paths
- trusted digest input status
- source-link preservation
- fallback labeling
- idempotent output paths
- no public-posting side effects in dry-run mode
