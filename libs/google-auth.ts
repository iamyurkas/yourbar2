import { Platform } from 'react-native';

const GOOGLE_USER_KEY = 'google_drive_user';
const GOOGLE_ACCESS_TOKEN_KEY = 'google_drive_access_token';

const memorySession = new Map<string, string>();

type GoogleSigninModule = {
  GoogleSignin: {
    configure: (config: Record<string, unknown>) => void;
    hasPlayServices: (options?: { showPlayServicesUpdateDialog?: boolean }) => Promise<void>;
    signIn: () => Promise<{ data?: { user?: GoogleProfile } }>;
    getCurrentUser: () => Promise<{ user?: GoogleProfile } | null>;
    getTokens: () => Promise<{ accessToken: string }>;
    signOut: () => Promise<void>;
  };
  statusCodes?: {
    SIGN_IN_CANCELLED?: string;
  };
};

type SecureStoreModule = {
  setItemAsync: (key: string, value: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  deleteItemAsync: (key: string) => Promise<void>;
};

type GoogleProfile = {
  id: string;
  email: string;
  name?: string | null;
  photo?: string | null;
};

export type GoogleAuthUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};

let isConfigured = false;

function getGoogleSigninModule(): GoogleSigninModule | null {
  try {
    return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  } catch {
    return null;
  }
}

function getSecureStoreModule(): SecureStoreModule | null {
  try {
    return require('expo-secure-store') as SecureStoreModule;
  } catch {
    return null;
  }
}

async function setStoredValue(key: string, value: string): Promise<void> {
  const secureStore = getSecureStoreModule();
  if (secureStore) {
    await secureStore.setItemAsync(key, value);
    return;
  }

  memorySession.set(key, value);
}

async function getStoredValue(key: string): Promise<string | null> {
  const secureStore = getSecureStoreModule();
  if (secureStore) {
    return await secureStore.getItemAsync(key);
  }

  return memorySession.get(key) ?? null;
}

async function deleteStoredValue(key: string): Promise<void> {
  const secureStore = getSecureStoreModule();
  if (secureStore) {
    await secureStore.deleteItemAsync(key);
    return;
  }

  memorySession.delete(key);
}

function getPlatformClientId(): { iosClientId?: string; webClientId?: string } {
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID;

  if (Platform.OS === 'ios') {
    return { iosClientId, webClientId };
  }

  if (Platform.OS === 'android') {
    return { webClientId: androidClientId ?? webClientId };
  }

  return { webClientId };
}

function getGoogleSigninOrThrow(): GoogleSigninModule {
  const googleSignInModule = getGoogleSigninModule();
  if (!googleSignInModule) {
    throw new Error('Google Sign-In native module is unavailable. Build and run a dev client on Android/iOS.');
  }

  return googleSignInModule;
}

export function configureGoogleAuth(): void {
  if (isConfigured) {
    return;
  }

  const { GoogleSignin } = getGoogleSigninOrThrow();
  const { iosClientId, webClientId } = getPlatformClientId();

  GoogleSignin.configure({
    scopes: [
      'https://www.googleapis.com/auth/drive.appdata',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    iosClientId,
    webClientId,
    profileImageSize: 120,
  });

  isConfigured = true;
}

function toGoogleAuthUser(user: GoogleProfile): GoogleAuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    picture: user.photo ?? undefined,
  };
}

export async function signInWithGoogleNative(): Promise<GoogleAuthUser> {
  configureGoogleAuth();
  const { GoogleSignin } = getGoogleSigninOrThrow();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const userData = response.data;

  if (!userData?.user) {
    throw new Error('Google sign-in did not return a user profile.');
  }

  const tokens = await GoogleSignin.getTokens();
  const user = toGoogleAuthUser(userData.user);

  await setStoredValue(GOOGLE_USER_KEY, JSON.stringify(user));
  await setStoredValue(GOOGLE_ACCESS_TOKEN_KEY, tokens.accessToken);

  return user;
}

export async function tryRestoreGoogleUser(): Promise<GoogleAuthUser | null> {
  const googleSignInModule = getGoogleSigninModule();
  if (googleSignInModule) {
    configureGoogleAuth();

    try {
      const currentUser = await googleSignInModule.GoogleSignin.getCurrentUser();
      if (currentUser?.user) {
        const user = toGoogleAuthUser(currentUser.user);
        await setStoredValue(GOOGLE_USER_KEY, JSON.stringify(user));
        return user;
      }
    } catch {
      // fallback to local value
    }
  }

  const storedUser = await getStoredValue(GOOGLE_USER_KEY);
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as GoogleAuthUser;
  } catch {
    return null;
  }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  const googleSignInModule = getGoogleSigninModule();
  if (googleSignInModule) {
    configureGoogleAuth();

    try {
      const tokens = await googleSignInModule.GoogleSignin.getTokens();
      if (tokens.accessToken) {
        await setStoredValue(GOOGLE_ACCESS_TOKEN_KEY, tokens.accessToken);
        return tokens.accessToken;
      }
    } catch {
      // fallback to cached token
    }
  }

  return await getStoredValue(GOOGLE_ACCESS_TOKEN_KEY);
}

export async function clearGoogleAuthSession(): Promise<void> {
  const googleSignInModule = getGoogleSigninModule();

  if (googleSignInModule) {
    try {
      await googleSignInModule.GoogleSignin.signOut();
    } catch {
      // ignore sign out failures and always clear local state
    }
  }

  await deleteStoredValue(GOOGLE_USER_KEY);
  await deleteStoredValue(GOOGLE_ACCESS_TOKEN_KEY);
}

export function isGoogleSignInCancelled(error: unknown): boolean {
  const googleSignInModule = getGoogleSigninModule();
  const cancelledCode = googleSignInModule?.statusCodes?.SIGN_IN_CANCELLED;

  return Boolean(
    cancelledCode
      && error
      && typeof error === 'object'
      && 'code' in error
      && (error as { code?: string }).code === cancelledCode,
  );
}
