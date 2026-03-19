import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'yourbar-sync-v1.json';
const DRIVE_SPACE = 'appDataFolder';

export type GoogleDriveTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

function randomString(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'a';
  }
  return value;
}

function getClientIdForPlatform(): string | undefined {
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  }

  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  }

  return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
}

function getRedirectUri(): string {
  const rawScheme = Constants.expoConfig?.scheme;
  const configuredScheme = Array.isArray(rawScheme) ? rawScheme[0] : rawScheme;
  const deepLink = Linking.createURL('oauthredirect', configuredScheme ? { scheme: configuredScheme } : undefined);
  if (!deepLink) {
    throw new Error('Unable to build OAuth redirect URL.');
  }

  return deepLink;
}

async function openGoogleAuthSession(authUrl: string, redirectUri: string): Promise<string> {
  const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (authResult.type === 'success' && authResult.url) {
    return authResult.url;
  }

  if (authResult.type !== 'cancel' && authResult.type !== 'dismiss') {
    throw new Error(`Google sign-in failed with status: ${authResult.type}`);
  }

  const fallbackResult = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error('Google sign-in timed out waiting for redirect.'));
    }, 120_000);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!url.startsWith(redirectUri)) {
        return;
      }

      clearTimeout(timeout);
      subscription.remove();
      resolve(url);
    });

    void WebBrowser.openBrowserAsync(authUrl).catch((error) => {
      clearTimeout(timeout);
      subscription.remove();
      reject(error);
    });
  });

  return fallbackResult;
}

function isTokenValid(tokens: GoogleDriveTokens): boolean {
  if (!tokens.accessToken) {
    return false;
  }
  if (!tokens.expiresAt) {
    return true;
  }
  return Date.now() + 60_000 < tokens.expiresAt;
}

export async function ensureFreshGoogleAccessToken(tokens: GoogleDriveTokens): Promise<GoogleDriveTokens> {
  if (isTokenValid(tokens)) {
    return tokens;
  }

  if (!tokens.refreshToken) {
    throw new Error('Refresh token is missing. Please sign in again.');
  }

  const clientId = getClientIdForPlatform();
  if (!clientId) {
    throw new Error('Google Drive client ID is not configured.');
  }

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed (${response.status})`);
  }

  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error('Token refresh response did not include access_token');
  }

  return {
    ...tokens,
    accessToken: payload.access_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined,
  };
}

export async function signInToGoogleDrive(): Promise<GoogleDriveTokens> {
  const clientId = getClientIdForPlatform();
  if (!clientId) {
    throw new Error('Google Drive client ID is not configured.');
  }

  const redirectUri = getRedirectUri();
  const state = randomString(16);
  const codeVerifier = randomString(64);

  const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_DRIVE_APPDATA_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: codeVerifier,
    code_challenge_method: 'plain',
  }).toString()}`;

  const redirectUrl = await openGoogleAuthSession(authUrl, redirectUri);

  const parsed = Linking.parse(redirectUrl);
  const params = parsed.queryParams ?? {};
  if (typeof params.state !== 'string' || params.state !== state) {
    throw new Error('Google sign-in state mismatch.');
  }

  if (typeof params.code !== 'string') {
    throw new Error('Google sign-in code is missing.');
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
  }

  const tokenPayload = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokenPayload.access_token) {
    throw new Error('Google token exchange failed.');
  }

  return {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    expiresAt: tokenPayload.expires_in ? Date.now() + tokenPayload.expires_in * 1000 : undefined,
  };
}

async function findAppDataFileId(accessToken: string): Promise<string | undefined> {
  const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=${DRIVE_SPACE}&q=${query}&fields=files(id,name,modifiedTime)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to query Google Drive (${response.status})`);
  }

  const payload = await response.json() as { files?: Array<{ id: string }> };
  return payload.files?.[0]?.id;
}

export async function uploadAppDataJson(accessToken: string, body: string): Promise<void> {
  const existingFileId = await findAppDataFileId(accessToken);
  const metadata = {
    name: DRIVE_FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };

  const boundary = 'yourbar-boundary';
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    body,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const method = existingFileId ? 'PATCH' : 'POST';
  const endpoint = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload sync file (${response.status})`);
  }
}

export async function downloadAppDataJson(accessToken: string): Promise<string | null> {
  const fileId = await findAppDataFileId(accessToken);
  if (!fileId) {
    return null;
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download sync file (${response.status})`);
  }

  return response.text();
}
