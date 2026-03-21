import type { SQLiteDatabase } from 'expo-sqlite';

import bundledData from '@/assets/data/data.json';
import { APP_STATE_KEYS } from '@/libs/storage/sqlite/schema';

type CatalogData = {
  cocktails?: Array<{ id?: number }>;
  ingredients?: Array<{ id?: number }>;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function getBundledCatalogRevision(): string {
  return simpleHash(stableStringify(bundledData));
}

async function getStateValue(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM app_state WHERE key = ?', [key]);
  return row?.value_json ?? null;
}

async function setStateValue(db: SQLiteDatabase, key: string, value: unknown): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO app_state (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
    [key, JSON.stringify(value), now],
  );
}

async function upsertCatalogEntities(
  db: SQLiteDatabase,
  entityType: 'cocktail' | 'ingredient',
  entities: Array<{ id?: number }>,
  revision: string,
): Promise<void> {
  for (const entity of entities) {
    const rawId = Number(entity.id ?? -1);
    if (!Number.isFinite(rawId) || rawId < 0) {
      continue;
    }

    const entityId = Math.trunc(rawId);
    await db.runAsync(
      `INSERT INTO catalog_entities (entity_type, entity_id, payload_json, catalog_revision)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id)
       DO UPDATE SET payload_json=excluded.payload_json, catalog_revision=excluded.catalog_revision`,
      [entityType, entityId, JSON.stringify(entity), revision],
    );
  }
}

export async function syncBundledCatalogIfNeeded(db: SQLiteDatabase): Promise<void> {
  const revision = getBundledCatalogRevision();
  const storedRevisionJson = await getStateValue(db, APP_STATE_KEYS.catalogRevision);
  const storedRevision = storedRevisionJson ? JSON.parse(storedRevisionJson) as string : null;

  if (storedRevision === revision) {
    return;
  }

  console.info(`[sqlite] applying bundled catalog revision ${revision} (previous ${storedRevision ?? 'none'})`);
  const catalog = bundledData as CatalogData;

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    await upsertCatalogEntities(db, 'cocktail', catalog.cocktails ?? [], revision);
    await upsertCatalogEntities(db, 'ingredient', catalog.ingredients ?? [], revision);
    await setStateValue(db, APP_STATE_KEYS.catalogRevision, revision);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error('[sqlite] failed to sync bundled catalog', error);
    throw error;
  }
}
