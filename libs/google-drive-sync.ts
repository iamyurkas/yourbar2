const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
export const SYNC_FILENAME = 'yourbar-sync.json';

export type CloudSyncEnvelope<TSnapshot> = {
  schemaVersion: number;
  exportedAt: string;
  deviceId: string;
  appVersion: string;
  syncRevision: number;
  checksum: string;
  snapshot: TSnapshot;
};

type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
  version?: string;
  md5Checksum?: string;
};

export type CloudSyncFile = {
  id: string;
  modifiedTime: string;
  version?: string;
  md5Checksum?: string;
};

export type CloudSyncFetchResult<TSnapshot> = {
  file: CloudSyncFile;
  envelope: CloudSyncEnvelope<TSnapshot>;
};

function buildSyncFileQuery(): string {
  const query = [
    `name = '${SYNC_FILENAME}'`,
    "'appDataFolder' in parents",
    'trashed = false',
  ].join(' and ');

  return encodeURIComponent(query);
}

async function fetchJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Drive request failed (${response.status}): ${body}`);
  }

  return await response.json() as T;
}

async function listSyncFiles(accessToken: string): Promise<DriveFile[]> {
  const query = buildSyncFileQuery();
  const url = `${GOOGLE_DRIVE_API_BASE}/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime,version,md5Checksum)&pageSize=10`;
  const response = await fetchJson<{ files?: DriveFile[] }>(url, accessToken);

  return [...(response.files ?? [])].sort((a, b) => {
    return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
  });
}

async function dedupeSyncFiles(accessToken: string, files: DriveFile[]): Promise<DriveFile | null> {
  if (files.length === 0) {
    return null;
  }

  const primary = files[0];
  const duplicates = files.slice(1);

  await Promise.all(duplicates.map(async (file) => {
    const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${file.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      console.warn(`Failed deleting duplicate sync file ${file.id}: ${response.status} ${body}`);
    }
  }));

  return primary;
}

export async function fetchCloudSyncSnapshot<TSnapshot>(accessToken: string): Promise<CloudSyncFetchResult<TSnapshot> | null> {
  const files = await listSyncFiles(accessToken);
  const selectedFile = await dedupeSyncFiles(accessToken, files);

  if (!selectedFile) {
    return null;
  }

  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${selectedFile.id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }

    const body = await response.text();
    throw new Error(`Failed to download cloud snapshot (${response.status}): ${body}`);
  }

  const envelope = await response.json() as CloudSyncEnvelope<TSnapshot>;
  return {
    file: {
      id: selectedFile.id,
      modifiedTime: selectedFile.modifiedTime,
      version: selectedFile.version,
      md5Checksum: selectedFile.md5Checksum,
    },
    envelope,
  };
}

export async function upsertCloudSyncSnapshot<TSnapshot>(
  accessToken: string,
  envelope: CloudSyncEnvelope<TSnapshot>,
): Promise<CloudSyncFile> {
  const existing = await listSyncFiles(accessToken);
  const selected = await dedupeSyncFiles(accessToken, existing);

  const metadata = {
    name: SYNC_FILENAME,
    mimeType: 'application/json',
    parents: ['appDataFolder'],
  };

  const boundary = `yourbar_${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const multipartBody =
    delimiter
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + JSON.stringify(metadata)
    + delimiter
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + JSON.stringify(envelope)
    + closeDelimiter;

  const method = selected ? 'PATCH' : 'POST';
  const url = selected
    ? `${GOOGLE_DRIVE_UPLOAD_BASE}/files/${selected.id}?uploadType=multipart&fields=id,modifiedTime,version,md5Checksum`
    : `${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,modifiedTime,version,md5Checksum`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to upload cloud snapshot (${response.status}): ${body}`);
  }

  const payload = await response.json() as DriveFile;
  return {
    id: payload.id,
    modifiedTime: payload.modifiedTime,
    version: payload.version,
    md5Checksum: payload.md5Checksum,
  };
}
