import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';

import type { InventorySnapshot } from '@/libs/inventory-storage';

WebBrowser.maybeCompleteAuthSession();

const STATE_FILENAME = 'google-drive-sync-state.json';
const REMOTE_FILE_NAME = 'inventory-sync.json';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

type SyncState = {
  accessToken: string;
  expiresAt: number;
  remoteFileId?: string;
};

type RemotePayload<TCocktail, TIngredient> = {
  updatedAt: number;
  snapshot: InventorySnapshot<TCocktail, TIngredient>;
};

function resolveStatePath(): string | undefined {
  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!dir) {
    return undefined;
  }

  return `${dir.replace(/\/?$/, '/')}${STATE_FILENAME}`;
}

async function loadSyncState(): Promise<SyncState | null> {
  const path = resolveStatePath();
  if (!path) {
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      return null;
    }

    const contents = await FileSystem.readAsStringAsync(path);
    if (!contents) {
      return null;
    }

    return JSON.parse(contents) as SyncState;
  } catch {
    return null;
  }
}

async function saveSyncState(state: SyncState): Promise<void> {
  const path = resolveStatePath();
  if (!path) {
    return;
  }

  await FileSystem.writeAsStringAsync(path, JSON.stringify(state));
}

export async function disconnectGoogleDriveSync(): Promise<void> {
  const path = resolveStatePath();
  if (!path) {
    return;
  }

  await FileSystem.deleteAsync(path, { idempotent: true });
}

function getGoogleClientId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const value = extra.googleDriveClientId;
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? null;
}

function computeHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
}

export async function hasGoogleDriveSyncSession(): Promise<boolean> {
  const state = await loadSyncState();
  return Boolean(state?.accessToken && state.expiresAt > Date.now());
}

export async function signInToGoogleDrive(): Promise<boolean> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID');
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'yourbar' });
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth'
    + `?client_id=${encodeURIComponent(clientId)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + '&response_type=token'
    + `&scope=${encodeURIComponent(DRIVE_SCOPE)}`
    + '&prompt=consent';

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    return false;
  }

  const fragment = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in') ?? '3600');

  if (!accessToken) {
    return false;
  }

  await saveSyncState({
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
  });

  return true;
}

async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const state = await loadSyncState();
  if (!state || state.expiresAt <= Date.now()) {
    throw new Error('Google Drive session expired');
  }

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      ...(init.headers ?? {}),
    },
  });
}

async function findRemoteFileId(): Promise<string | undefined> {
  const response = await authorizedFetch(
    'https://www.googleapis.com/drive/v3/files'
    + `?q=${encodeURIComponent(`name='${REMOTE_FILE_NAME}' and trashed=false`)}`
    + '&spaces=appDataFolder&fields=files(id)',
  );

  if (!response.ok) {
    return undefined;
  }

  const payload = await response.json() as { files?: Array<{ id?: string }> };
  return payload.files?.[0]?.id;
}

async function uploadRemoteSnapshot<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const state = await loadSyncState();
  if (!state || state.expiresAt <= Date.now()) {
    throw new Error('Google Drive session expired');
  }

  const bodyPayload: RemotePayload<TCocktail, TIngredient> = {
    updatedAt: Number(snapshot.updatedAt ?? Date.now()),
    snapshot,
  };
  const contents = JSON.stringify(bodyPayload);
  const hash = computeHash(contents);

  const metadata = {
    name: REMOTE_FILE_NAME,
    parents: ['appDataFolder'],
    description: JSON.stringify({ updatedAt: bodyPayload.updatedAt, hash }),
  };

  const boundary = `yourbar-sync-${Date.now()}`;
  const multipartBody =
    `--${boundary}\r\n`
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + `${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\n`
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + `${contents}\r\n`
    + `--${boundary}--`;

  const targetFileId = state.remoteFileId ?? await findRemoteFileId();
  const method = targetFileId ? 'PATCH' : 'POST';
  const endpoint = targetFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${targetFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    throw new Error(`Google Drive upload failed (${response.status})`);
  }

  const result = await response.json() as { id?: string };
  await saveSyncState({
    ...state,
    remoteFileId: result.id ?? targetFileId,
  });
}

async function readRemoteSnapshot<TCocktail, TIngredient>(): Promise<RemotePayload<TCocktail, TIngredient> | null> {
  const fileId = await findRemoteFileId();
  if (!fileId) {
    return null;
  }

  const response = await authorizedFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
  );

  if (!response.ok) {
    return null;
  }

  return await response.json() as RemotePayload<TCocktail, TIngredient>;
}

export type GoogleDriveSyncResult<TCocktail, TIngredient> = {
  mergedSnapshot?: InventorySnapshot<TCocktail, TIngredient>;
  changed: boolean;
};

export async function syncSnapshotWithGoogleDrive<TCocktail, TIngredient>(
  localSnapshot: InventorySnapshot<TCocktail, TIngredient> | undefined,
): Promise<GoogleDriveSyncResult<TCocktail, TIngredient>> {
  const state = await loadSyncState();
  if (!state || state.expiresAt <= Date.now() || !localSnapshot) {
    return { mergedSnapshot: localSnapshot, changed: false };
  }

  const remotePayload = await readRemoteSnapshot<TCocktail, TIngredient>();
  if (!remotePayload) {
    await uploadRemoteSnapshot(localSnapshot);
    return { mergedSnapshot: localSnapshot, changed: false };
  }

  const localUpdatedAt = Number(localSnapshot.updatedAt ?? 0);
  const remoteUpdatedAt = Number(remotePayload.updatedAt ?? 0);

  if (remoteUpdatedAt > localUpdatedAt) {
    return { mergedSnapshot: remotePayload.snapshot, changed: true };
  }

  if (localUpdatedAt > remoteUpdatedAt) {
    await uploadRemoteSnapshot(localSnapshot);
  }

  return { mergedSnapshot: localSnapshot, changed: false };
}

export async function pushSnapshotToGoogleDrive<TCocktail, TIngredient>(
  snapshot: InventorySnapshot<TCocktail, TIngredient>,
): Promise<void> {
  const state = await loadSyncState();
  if (!state || state.expiresAt <= Date.now()) {
    return;
  }

  await uploadRemoteSnapshot(snapshot);
}
