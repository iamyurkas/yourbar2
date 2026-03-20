import { GoogleSignin, statusCodes, type User } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SECURE_EMAIL_KEY = 'google_drive_sync_email';
const SECURE_ACCESS_TOKEN_KEY = 'google_drive_sync_access_token';

export type GoogleDriveSession = {
  email: string;
  name?: string;
};

type GoogleDriveAuthConfig = {
  androidClientId: string;
  iosClientId: string;
  webClientId?: string;
};

let isConfigured = false;

function getGoogleDriveAuthConfig(): GoogleDriveAuthConfig {
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID?.trim() ?? '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID?.trim() ?? '';
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID?.trim() ?? '';

  return {
    androidClientId,
    iosClientId,
    webClientId: webClientId || undefined,
  };
}

export function configureGoogleDriveSignIn() {
  if (Platform.OS === 'web' || isConfigured) {
    return;
  }

  const config = getGoogleDriveAuthConfig();
  GoogleSignin.configure({
    scopes: [GOOGLE_DRIVE_SCOPE],
    offlineAccess: true,
    webClientId: config.webClientId,
    iosClientId: config.iosClientId || undefined,
    profileImageSize: 120,
  });
  isConfigured = true;
}

function mapUserToSession(user: User | null): GoogleDriveSession | null {
  if (!user?.user?.email) {
    return null;
  }

  return {
    email: user.user.email,
    name: user.user.name ?? undefined,
  };
}

export async function getGoogleDriveSession(): Promise<GoogleDriveSession | null> {
  configureGoogleDriveSignIn();
  if (Platform.OS === 'web') {
    return null;
  }

  const signedIn = await GoogleSignin.isSignedIn();
  if (!signedIn) {
    return null;
  }

  const user = await GoogleSignin.getCurrentUser();
  const session = mapUserToSession(user);
  if (!session) {
    return null;
  }

  await SecureStore.setItemAsync(SECURE_EMAIL_KEY, session.email);
  return session;
}

export async function signInToGoogleDrive(): Promise<GoogleDriveSession> {
  configureGoogleDriveSignIn();
  if (Platform.OS === 'web') {
    throw new Error('Google Drive sync is only supported on iOS and Android.');
  }

  const config = getGoogleDriveAuthConfig();
  if (!config.androidClientId || !config.iosClientId) {
    throw new Error('Google Drive client IDs are missing.');
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const user = await GoogleSignin.signIn();
  const session = mapUserToSession(user.data ?? null);

  if (!session) {
    throw new Error('Unable to read signed-in Google account.');
  }

  const tokens = await GoogleSignin.getTokens();
  await Promise.all([
    SecureStore.setItemAsync(SECURE_EMAIL_KEY, session.email),
    SecureStore.setItemAsync(SECURE_ACCESS_TOKEN_KEY, tokens.accessToken),
  ]);

  return session;
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  configureGoogleDriveSignIn();
  const tokens = await GoogleSignin.getTokens();
  await SecureStore.setItemAsync(SECURE_ACCESS_TOKEN_KEY, tokens.accessToken);
  return tokens.accessToken;
}

export async function signOutFromGoogleDrive() {
  try {
    await GoogleSignin.signOut();
  } finally {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_EMAIL_KEY),
      SecureStore.deleteItemAsync(SECURE_ACCESS_TOKEN_KEY),
    ]);
  }
}

export function isGoogleSignInCancelled(error: unknown): boolean {
  return typeof error === 'object'
    && error != null
    && 'code' in error
    && (error as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED;
}
