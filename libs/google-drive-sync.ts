import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const SESSION_FILENAME = 'google-drive-session.json';
const SYNC_FILENAME = 'yourbar-sync-latest.base64';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export type GoogleDriveSession = {
  accessToken: string;
  expiresAt: number;
  tokenType: string;
  email?: string;
};

type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
};

function getStoragePath(): string | null {
  const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!directory) {
    return null;
  }

  return `${directory.replace(/\/?$/, '/')}${SESSION_FILENAME}`;
}

async function persistSession(session: GoogleDriveSession): Promise<void> {
  const path = getStoragePath();
  if (!path) {
    return;
  }

  await FileSystem.writeAsStringAsync(path, JSON.stringify(session));
}

export async function loadGoogleDriveSession(): Promise<GoogleDriveSession | null> {
  const path = getStoragePath();
  if (!path) {
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || info.isDirectory) {
      return null;
    }

    const value = await FileSystem.readAsStringAsync(path);
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as GoogleDriveSession;
    if (!parsed?.accessToken || !parsed?.expiresAt) {
      return null;
    }

    if (Date.now() >= parsed.expiresAt) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Unable to load Google Drive session', error);
    return null;
  }
}

export async function clearGoogleDriveSession(): Promise<void> {
  const path = getStoragePath();
  if (!path) {
    return;
  }

  await FileSystem.deleteAsync(path, { idempotent: true });
}

function resolveClientIdCandidate(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getGoogleClientId(): string | null {
  const expoExtra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const manifest2Extra = Constants.manifest2?.extra?.expoClient?.extra as Record<string, unknown> | undefined;
  const manifestExtra = (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const platformCandidates =
    Platform.OS === 'android'
      ? [
        expoExtra?.googleDriveAndroidClientId,
        manifest2Extra?.googleDriveAndroidClientId,
        manifestExtra?.googleDriveAndroidClientId,
        process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID,
      ]
      : Platform.OS === 'ios'
        ? [
          expoExtra?.googleDriveIosClientId,
          manifest2Extra?.googleDriveIosClientId,
          manifestExtra?.googleDriveIosClientId,
          process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID,
        ]
        : [];

  const candidates = [
    ...platformCandidates,
    expoExtra?.googleDriveClientId,
    manifest2Extra?.googleDriveClientId,
    manifestExtra?.googleDriveClientId,
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID,
  ].map(resolveClientIdCandidate);

  for (const value of candidates) {
    if (value) {
      return value;
    }
  }

  return null;
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(getGoogleClientId());
}

async function getGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return undefined;
    }

    const json = (await response.json()) as { email?: unknown };
    return typeof json.email === 'string' ? json.email : undefined;
  } catch {
    return undefined;
  }
}

export async function signInToGoogleDrive(): Promise<GoogleDriveSession> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('missing_client_id');
  }

  const resolvedScheme = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(resolvedScheme) ? resolvedScheme[0] : (resolvedScheme ?? 'yourbar');
  const redirectUri = Linking.createURL('oauthredirect', { scheme });
  const codeVerifier = createCodeVerifier();
  const codeChallenge = codeVerifier;

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(GOOGLE_DRIVE_SCOPE)}` +
    `&prompt=consent` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=plain`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) {
    throw new Error('auth_cancelled');
  }

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  const authError = url.searchParams.get('error');
  if (!code || authError) {
    throw new Error(`auth_failed:${authError ?? 'missing_code'}`);
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`token_exchange_failed:${tokenResponse.status}:${errorText}`);
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number | string;
  };

  const accessToken = tokenPayload.access_token;
  const tokenType = tokenPayload.token_type ?? 'Bearer';
  const expiresIn = Number(tokenPayload.expires_in ?? '3600');

  if (!accessToken || !Number.isFinite(expiresIn)) {
    throw new Error('auth_failed');
  }

  const session: GoogleDriveSession = {
    accessToken,
    tokenType,
    expiresAt: Date.now() + Math.max(300, expiresIn - 30) * 1000,
    email: await getGoogleUserEmail(accessToken),
  };

  await persistSession(session);
  return session;
}

function createCodeVerifier(length = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return result;
}

async function fetchDriveFiles(session: GoogleDriveSession): Promise<DriveFile[]> {
  const query = `name='${SYNC_FILENAME}' and 'appDataFolder' in parents and trashed=false`;
  const url =
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder` +
    `&q=${encodeURIComponent(query)}` +
    `&fields=${encodeURIComponent('files(id,name,modifiedTime)')}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`drive_list_failed:${response.status}`);
  }

  const payload = (await response.json()) as { files?: DriveFile[] };
  return payload.files ?? [];
}

function buildMultipartBody(metadata: Record<string, unknown>, content: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');
}

export async function uploadBackupToGoogleDrive(session: GoogleDriveSession, backupBase64: string): Promise<void> {
  const files = await fetchDriveFiles(session);
  const existing = files[0];

  const boundary = `yourbar-${Date.now().toString(36)}`;
  const metadata: Record<string, unknown> = existing
    ? { name: SYNC_FILENAME }
    : { name: SYNC_FILENAME, parents: ['appDataFolder'] };

  const method = existing ? 'PATCH' : 'POST';
  const endpoint = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: buildMultipartBody(metadata, backupBase64, boundary),
  });

  if (!response.ok) {
    throw new Error(`drive_upload_failed:${response.status}`);
  }
}

export async function downloadBackupFromGoogleDrive(session: GoogleDriveSession): Promise<string | null> {
  const files = await fetchDriveFiles(session);
  const existing = files[0];
  if (!existing) {
    return null;
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`drive_download_failed:${response.status}`);
  }

  return response.text();
}
