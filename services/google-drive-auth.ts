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
const GOOGLE_SIGNIN_UNAVAILABLE_CODE = 'google_signin_unavailable';

type GoogleSigninModule = {
  GoogleSignin: {
    configure: (config: Record<string, unknown>) => void;
    isSignedIn: () => Promise<boolean>;
    getCurrentUser: () => Promise<{ user?: { email?: string; name?: string } } | null>;
    hasPlayServices: (options?: { showPlayServicesUpdateDialog?: boolean }) => Promise<boolean>;
    signIn: () => Promise<{ data?: { user?: { email?: string; name?: string } } | null }>;
    getTokens: () => Promise<{ accessToken: string }>;
    signOut: () => Promise<void>;
  };
  statusCodes?: {
    SIGN_IN_CANCELLED?: string;
  };
};

function loadGoogleSigninModule(): GoogleSigninModule | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  } catch {
    return null;
  }
}

function requireGoogleSigninModule(): GoogleSigninModule {
  const module = loadGoogleSigninModule();
  if (!module) {
    const error = new Error('Native Google Sign-In is not available in this build.');
    (error as Error & { code?: string }).code = GOOGLE_SIGNIN_UNAVAILABLE_CODE;
    throw error;
  }

  return module;
}

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

  const { GoogleSignin } = requireGoogleSigninModule();
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

function mapUserToSession(user: { user?: { email?: string; name?: string } } | null): GoogleDriveSession | null {
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

  const { GoogleSignin } = requireGoogleSigninModule();
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

  const { GoogleSignin } = requireGoogleSigninModule();
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
  const { GoogleSignin } = requireGoogleSigninModule();
  const tokens = await GoogleSignin.getTokens();
  await SecureStore.setItemAsync(SECURE_ACCESS_TOKEN_KEY, tokens.accessToken);
  return tokens.accessToken;
}

export async function signOutFromGoogleDrive() {
  const module = loadGoogleSigninModule();
  try {
    if (module) {
      await module.GoogleSignin.signOut();
    }
  } finally {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_EMAIL_KEY),
      SecureStore.deleteItemAsync(SECURE_ACCESS_TOKEN_KEY),
    ]);
  }
}

export function isGoogleSignInCancelled(error: unknown): boolean {
  const module = loadGoogleSigninModule();
  const cancelledCode = module?.statusCodes?.SIGN_IN_CANCELLED;
  return typeof error === 'object'
    && error != null
    && 'code' in error
    && (error as { code?: string }).code === cancelledCode;
}

export function isGoogleSignInUnavailable(error: unknown): boolean {
  return typeof error === 'object'
    && error != null
    && 'code' in error
    && (error as { code?: string }).code === GOOGLE_SIGNIN_UNAVAILABLE_CODE;
}
