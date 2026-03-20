import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, statusCodes, type User } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

const GOOGLE_USER_KEY = 'google_drive_user';
const GOOGLE_ACCESS_TOKEN_KEY = 'google_drive_access_token';

export type GoogleAuthUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};

let isConfigured = false;

function getPlatformClientId(): { iosClientId?: string; webClientId?: string } {
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID;

  if (Platform.OS === 'ios') {
    return {
      iosClientId,
      webClientId,
    };
  }

  if (Platform.OS === 'android') {
    return {
      webClientId: androidClientId ?? webClientId,
    };
  }

  return {
    webClientId,
  };
}

export function configureGoogleAuth(): void {
  if (isConfigured) {
    return;
  }

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

function toGoogleAuthUser(user: User): GoogleAuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    picture: user.photo ?? undefined,
  };
}

export async function signInWithGoogleNative(): Promise<GoogleAuthUser> {
  configureGoogleAuth();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const userData = response.data;

  if (!userData?.user) {
    throw new Error('Google sign-in did not return a user profile.');
  }

  const tokens = await GoogleSignin.getTokens();
  const user = toGoogleAuthUser(userData.user);

  await SecureStore.setItemAsync(GOOGLE_USER_KEY, JSON.stringify(user));
  await SecureStore.setItemAsync(GOOGLE_ACCESS_TOKEN_KEY, tokens.accessToken);

  return user;
}

export async function tryRestoreGoogleUser(): Promise<GoogleAuthUser | null> {
  configureGoogleAuth();

  try {
    const currentUser = await GoogleSignin.getCurrentUser();
    if (currentUser?.user) {
      const user = toGoogleAuthUser(currentUser.user);
      await SecureStore.setItemAsync(GOOGLE_USER_KEY, JSON.stringify(user));
      return user;
    }
  } catch {
    // no-op: fallback to secure storage value below
  }

  const storedUser = await SecureStore.getItemAsync(GOOGLE_USER_KEY);
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
  configureGoogleAuth();

  try {
    const tokens = await GoogleSignin.getTokens();
    if (tokens.accessToken) {
      await SecureStore.setItemAsync(GOOGLE_ACCESS_TOKEN_KEY, tokens.accessToken);
      return tokens.accessToken;
    }
  } catch {
    // fallback to cached token
  }

  return await SecureStore.getItemAsync(GOOGLE_ACCESS_TOKEN_KEY);
}

export async function clearGoogleAuthSession(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore sign out errors and always clear local state
  }

  await SecureStore.deleteItemAsync(GOOGLE_USER_KEY);
  await SecureStore.deleteItemAsync(GOOGLE_ACCESS_TOKEN_KEY);
}

export function isGoogleSignInCancelled(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && (error as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED,
  );
}
