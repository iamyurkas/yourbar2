# SQLite storage migration rollout

## Rollout plan (dev → beta → prod)

1. **Dev (internal):** set `EXPO_PUBLIC_USE_SQLITE_STORAGE=true` in local env, validate migration from existing `inventory-state.json`, and run smoke tests for cold start, toggles, import/export, and Google Drive sync.
2. **Beta (small cohort):** enable the flag for a subset of beta users; collect metrics for app start, toggle latency, and error logs (`SQLite inventory * failed` fallback warnings).
3. **Prod staged rollout:** roll out flag gradually (10% → 25% → 50% → 100%). Keep JSON fallback active and monitor migration success (`json_snapshot_migrated` in metadata) and persistence errors.

## Performance profiling protocol

Capture baseline (JSON) and SQLite values on the same device class:

- **Cold start:** time from provider mount to first non-loading render.
- **Toggle latency:** ingredient availability toggle action to UI settled state.
- **List filtering:** time to render filtered cocktails and ingredients.

### Suggested collection

- Use `performance.now()` markers around provider bootstrap and mutation handlers.
- Record p50/p95 over at least 30 runs per scenario.
- Compare JSON vs SQLite with the same dataset size and same build type.

## Rollback plan to JSON storage

1. Set `EXPO_PUBLIC_USE_SQLITE_STORAGE=false` and ship hotfix/release.
2. App immediately resumes `JsonInventoryStorageAdapter` reads/writes without changing public provider API.
3. Keep SQLite DB in place for forensic inspection; do not delete automatically.
4. If needed, export SQLite snapshot (via adapter) and write through JSON adapter to restore file-backed continuity.
