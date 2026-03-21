# SQLite storage migration plan

## Feature flag

Set `EXPO_PUBLIC_USE_SQLITE_STORAGE=1` to enable SQLite-backed `InventoryStorageAdapter`.
When disabled (`0` or unset), JSON snapshot storage remains the active backend.

## Rollout

1. **dev**
   - Enable flag for internal QA builds only.
   - Verify one-time JSON -> SQLite migration on first launch.
   - Compare startup and list/filter/toggle latency against baseline JSON builds.
2. **beta**
   - Enable flag for a small beta cohort (10-20%).
   - Monitor migration completion rate, persistence failures, and import/export success.
3. **prod**
   - Ramp to 100% after stable beta telemetry and no data-loss regressions.

## Rollback

1. Set `EXPO_PUBLIC_USE_SQLITE_STORAGE=0` in release channel config.
2. App automatically falls back to JSON adapter.
3. Keep SQLite DB untouched so the flag can be re-enabled without data rebuild.
4. If needed, export from SQLite before rollback and persist equivalent JSON snapshot for safety.

## Performance profiling checklist

- Cold start: time to hydrated inventory state.
- Toggle latency: ingredient availability + party selection updates.
- List/filter interactions: cocktails and ingredients tabs with search and filters.
- Snapshot export/import latency and size parity with previous JSON format.
