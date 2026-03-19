import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_FILENAME = 'yourbar-sync.tar';

export type GoogleUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};

export const getGoogleClientId = () => {
  const extra = Constants.expoConfig?.extra;
  const clientIds = (extra?.googleClientIds as string[]) ?? [];

  // Favoring iOS-type IDs for Android browser-based auth as per project memory
  // to avoid custom URI scheme issues.
  if (Platform.OS === 'android') {
    const iosId = extra?.googleDriveIosClientId;
    if (iosId) {
      return iosId;
    }
  }

  return clientIds[0] ?? null;
};

const getRedirectUri = () => {
  const scheme = Constants.expoConfig?.scheme;
  return AuthSession.makeRedirectUri({
    scheme: Array.isArray(scheme) ? scheme[0] : scheme,
    path: 'google-auth',
  });
};

export async function signInWithGoogle(): Promise<GoogleUser | null> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google Client ID not configured');
  }

  const redirectUri = getRedirectUri();

  const authRequest = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    responseType: AuthSession.ResponseType.Token,
  });

  const result = await authRequest.promptAsync({ authorizationEndpoint: GOOGLE_AUTH_ENDPOINT });

  if (result.type === 'success' && result.params.access_token) {
    const accessToken = result.params.access_token;
    await SecureStore.setItemAsync('google_access_token', accessToken);

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userResponse.json();

    return {
      id: userData.sub,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
    };
  }

  return null;
}

async function findSyncFile(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${SYNC_FILENAME}' and trashed = false`);
  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?q=${query}&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  const files = data.files || [];
  return files.length > 0 ? files[0].id : null;
}

export async function uploadToGoogleDrive(accessToken: string, archiveBase64: string): Promise<void> {
  const fileId = await findSyncFile(accessToken);
  const metadata = {
    name: SYNC_FILENAME,
    mimeType: 'application/x-tar',
  };

  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/x-tar\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    archiveBase64 +
    closeDelimiter;

  const url = fileId
    ? `${GOOGLE_DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=multipart`
    : `${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;

  const method = fileId ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to Google Drive: ${response.status} ${errorText}`);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('google_access_token');
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync('google_access_token');
}

export async function downloadFromGoogleDrive(accessToken: string): Promise<string | null> {
  const fileId = await findSyncFile(accessToken);
  if (!fileId) {
    return null;
  }

  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to download from Google Drive: ${response.status}`);
  }

  // Google Drive API returns raw binary for alt=media
  // We need to convert it to base64 for our existing archive utils
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // remove "data:application/x-tar;base64,"
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getFileMetadata(accessToken: string): Promise<{ modifiedTime: string } | null> {
  const fileId = await findSyncFile(accessToken);
  if (!fileId) {
    return null;
  }

  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}?fields=modifiedTime`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}
