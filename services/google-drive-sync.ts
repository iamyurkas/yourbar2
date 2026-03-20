export const GOOGLE_DRIVE_SYNC_FILENAME = 'yourbar-sync.json';
export class GoogleDriveSyncError extends Error {
  status?: number;
  operation: string;
  responseBody?: string;

  constructor(params: {
    message: string;
    operation: string;
    status?: number;
    responseBody?: string;
  }) {
    super(params.message);
    this.name = 'GoogleDriveSyncError';
    this.operation = params.operation;
    this.status = params.status;
    this.responseBody = params.responseBody;
  }
}

export type GoogleDriveSyncEnvelope<TSnapshot> = {
  schemaVersion: number;
  exportedAt: string;
  lastModified: string;
  deviceId: string;
  appVersion: string;
  syncRevision: number;
  checksum: string;
  snapshot: TSnapshot;
};

export type RemoteSyncFile<TSnapshot> = {
  fileId: string;
  modifiedTime: string;
  envelope: GoogleDriveSyncEnvelope<TSnapshot>;
};

const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

function createChecksum(snapshot: unknown): string {
  const input = JSON.stringify(snapshot);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

function createAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function fetchJson<T>(input: string, init: RequestInit, operation: string): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const message = await response.text();
    throw new GoogleDriveSyncError({
      message: `Google Drive request failed (${response.status}).`,
      operation,
      status: response.status,
      responseBody: message,
    });
  }

  return response.json() as Promise<T>;
}

export function createSyncEnvelope<TSnapshot>(params: {
  snapshot: TSnapshot;
  deviceId: string;
  appVersion: string;
  syncRevision: number;
}): GoogleDriveSyncEnvelope<TSnapshot> {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 1,
    exportedAt: timestamp,
    lastModified: timestamp,
    deviceId: params.deviceId,
    appVersion: params.appVersion,
    syncRevision: params.syncRevision,
    checksum: createChecksum(params.snapshot),
    snapshot: params.snapshot,
  };
}

export async function findGoogleDriveSyncFile(accessToken: string): Promise<{ id: string; modifiedTime: string } | null> {
  const query = encodeURIComponent("name='yourbar-sync.json' and 'appDataFolder' in parents and trashed=false");
  const url = `${DRIVE_API_BASE_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1&q=${query}`;
  const response = await fetchJson<{ files?: Array<{ id: string; modifiedTime: string }> }>(url, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
  }, 'findFile');

  const file = response.files?.[0];
  if (!file) {
    return null;
  }

  return {
    id: file.id,
    modifiedTime: file.modifiedTime,
  };
}

export async function readGoogleDriveSnapshot<TSnapshot>(accessToken: string): Promise<RemoteSyncFile<TSnapshot> | null> {
  const file = await findGoogleDriveSyncFile(accessToken);
  if (!file) {
    return null;
  }

  const downloadUrl = `${DRIVE_API_BASE_URL}/${file.id}?alt=media`;
  const envelope = await fetchJson<GoogleDriveSyncEnvelope<TSnapshot>>(downloadUrl, {
    method: 'GET',
    headers: createAuthHeaders(accessToken),
  }, 'readFile');

  return {
    fileId: file.id,
    modifiedTime: file.modifiedTime,
    envelope,
  };
}

export async function upsertGoogleDriveSnapshot<TSnapshot>(params: {
  accessToken: string;
  envelope: GoogleDriveSyncEnvelope<TSnapshot>;
}): Promise<void> {
  const { accessToken, envelope } = params;
  const existing = await findGoogleDriveSyncFile(accessToken);

  const metadata = existing
    ? { name: GOOGLE_DRIVE_SYNC_FILENAME }
    : { name: GOOGLE_DRIVE_SYNC_FILENAME, parents: ['appDataFolder'] };

  const boundary = 'yourbar-sync-boundary';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(envelope),
    `--${boundary}--`,
  ].join('\r\n');

  const method = existing ? 'PATCH' : 'POST';
  const endpoint = existing
    ? `${DRIVE_UPLOAD_URL}/${existing.id}?uploadType=multipart&fields=id,modifiedTime`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,modifiedTime`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      ...createAuthHeaders(accessToken),
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new GoogleDriveSyncError({
      message: `Failed to upload sync snapshot (${response.status}).`,
      operation: existing ? 'updateFile' : 'createFile',
      status: response.status,
      responseBody: message,
    });
  }
}
