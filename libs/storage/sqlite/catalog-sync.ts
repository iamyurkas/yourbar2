import { loadInventoryData } from '@/libs/inventory-data';
import type { MigrationDb } from '@/libs/storage/sqlite/migrations';

type CatalogMetaRow = {
  value: string;
};

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
}

function hashFNV1A(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeBundledCatalogRevision(): string {
  const data = loadInventoryData();
  const payload = stableStringify({
    cocktails: [...data.cocktails].sort((a, b) => a.id - b.id),
    ingredients: [...data.ingredients].sort((a, b) => a.id - b.id),
  });

  return hashFNV1A(payload);
}

export async function syncBundledCatalogIfNeededInTransaction(db: MigrationDb): Promise<void> {
  const revision = computeBundledCatalogRevision();
  const storedRevision = await db.getFirstAsync<CatalogMetaRow>(
    `SELECT value FROM catalog_meta WHERE key='bundled_catalog_revision' LIMIT 1;`,
  );

  if (storedRevision?.value === revision) {
    return;
  }

  const data = loadInventoryData();
  console.info(`[storage/sqlite] applying bundled catalog revision ${revision}`);

  for (const cocktail of data.cocktails) {
    await db.execAsync(
      `INSERT INTO catalog_cocktails (id, payload_json, revision, updated_at)
       VALUES (${cocktail.id}, ${JSON.stringify(JSON.stringify(cocktail))}, ${JSON.stringify(revision)}, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         payload_json=excluded.payload_json,
         revision=excluded.revision,
         updated_at=datetime('now');`,
    );
  }

  for (const ingredient of data.ingredients) {
    await db.execAsync(
      `INSERT INTO catalog_ingredients (id, payload_json, revision, updated_at)
       VALUES (${ingredient.id}, ${JSON.stringify(JSON.stringify(ingredient))}, ${JSON.stringify(revision)}, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         payload_json=excluded.payload_json,
         revision=excluded.revision,
         updated_at=datetime('now');`,
    );
  }

  await db.execAsync(
    `INSERT INTO catalog_meta (key, value, updated_at)
     VALUES ('bundled_catalog_revision', ${JSON.stringify(revision)}, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now');`,
  );
}
