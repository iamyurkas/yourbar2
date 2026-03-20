import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  configureGoogleDriveSignIn,
  getGoogleDriveAccessToken,
  getGoogleDriveSession,
  isGoogleSignInCancelled,
  isGoogleSignInUnavailable,
  signInToGoogleDrive,
  signOutFromGoogleDrive,
  type GoogleDriveSession,
} from '@/services/google-drive-auth';
import {
  createSyncEnvelope,
  readGoogleDriveSnapshot,
  upsertGoogleDriveSnapshot,
} from '@/services/google-drive-sync';
import { useInventory } from '@/providers/inventory-provider';
import type { InventorySyncStateSnapshot } from '@/providers/inventory-types';

type SyncStatus = 'idle' | 'signing_in' | 'syncing' | 'error';

type GoogleDriveSyncContextValue = {
  account: GoogleDriveSession | null;
  status: SyncStatus;
  lastSyncAt: string | null;
  errorMessage: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  restoreFromCloud: () => Promise<void>;
};

const GoogleDriveSyncContext = createContext<GoogleDriveSyncContextValue | undefined>(undefined);

const DEVICE_ID_KEY = 'google_drive_sync_device_id';
const LAST_SYNC_KEY = 'google_drive_last_sync_at';
const LAST_SYNC_ERROR_KEY = 'google_drive_last_sync_error';
const SYNC_REVISION_KEY = 'google_drive_sync_revision';

async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = [
    Application.androidId,
    await Application.getIosIdForVendorAsync(),
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  ].find(Boolean) ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

function getAppVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

function shouldUseRemote(remote: { syncRevision: number; exportedAt: string }, local: { syncRevision: number; exportedAt: string }) {
  if (remote.syncRevision !== local.syncRevision) {
    return remote.syncRevision > local.syncRevision;
  }

  return remote.exportedAt > local.exportedAt;
}

export function GoogleDriveSyncProvider({ children }: { children: React.ReactNode }) {
  const { exportInventorySyncState, importInventorySyncState, loading } = useInventory();
  const [account, setAccount] = useState<GoogleDriveSession | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);
  const pushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistSyncState = useCallback(async (nextSyncAt: string | null, nextError: string | null) => {
    setLastSyncAt(nextSyncAt);
    setErrorMessage(nextError);

    if (nextSyncAt) {
      await SecureStore.setItemAsync(LAST_SYNC_KEY, nextSyncAt);
    }

    if (nextError) {
      await SecureStore.setItemAsync(LAST_SYNC_ERROR_KEY, nextError);
    } else {
      await SecureStore.deleteItemAsync(LAST_SYNC_ERROR_KEY);
    }
  }, []);

  const performSync = useCallback(async (mode: 'push' | 'pull') => {
    if (loading) {
      return;
    }

    const snapshot = exportInventorySyncState();
    if (!snapshot) {
      return;
    }

    setStatus('syncing');
    const accessToken = await getGoogleDriveAccessToken();
    const deviceId = await getDeviceId();
    const appVersion = getAppVersion();
    const syncRevision = Number(await SecureStore.getItemAsync(SYNC_REVISION_KEY) ?? '0');

    if (mode === 'pull') {
      const remoteFile = await readGoogleDriveSnapshot<InventorySyncStateSnapshot>(accessToken);
      if (remoteFile?.envelope?.snapshot) {
        const localEnvelope = createSyncEnvelope({
          snapshot,
          deviceId,
          appVersion,
          syncRevision,
        });

        if (shouldUseRemote(remoteFile.envelope, localEnvelope)) {
          importInventorySyncState(remoteFile.envelope.snapshot);
          lastFingerprintRef.current = JSON.stringify(remoteFile.envelope.snapshot);
          await SecureStore.setItemAsync(SYNC_REVISION_KEY, String(remoteFile.envelope.syncRevision));
        }
      }

      const completedAt = new Date().toISOString();
      await persistSyncState(completedAt, null);
      setStatus('idle');
      return;
    }

    const nextRevision = syncRevision + 1;
    const envelope = createSyncEnvelope({
      snapshot,
      deviceId,
      appVersion,
      syncRevision: nextRevision,
    });

    await upsertGoogleDriveSnapshot({ accessToken, envelope });
    await SecureStore.setItemAsync(SYNC_REVISION_KEY, String(nextRevision));

    const completedAt = new Date().toISOString();
    await persistSyncState(completedAt, null);
    setStatus('idle');
  }, [exportInventorySyncState, importInventorySyncState, loading, persistSyncState]);

  const syncNow = useCallback(async () => {
    try {
      await performSync('push');
    } catch (error) {
      if (isGoogleSignInUnavailable(error)) {
        await persistSyncState(lastSyncAt, 'Google sync is unavailable in Expo Go. Use a development build.');
        setStatus('error');
        return;
      }

      const message = 'Unable to sync now. Please check your internet connection and try again.';
      await persistSyncState(lastSyncAt, message);
      setStatus('error');
      retryTimeoutRef.current = setTimeout(() => {
        void performSync('push').catch(() => undefined);
      }, 30000);
    }
  }, [lastSyncAt, performSync, persistSyncState]);

  const restoreFromCloud = useCallback(async () => {
    try {
      await performSync('pull');
    } catch (error) {
      if (isGoogleSignInUnavailable(error)) {
        await persistSyncState(lastSyncAt, 'Google sync is unavailable in Expo Go. Use a development build.');
        setStatus('error');
        return;
      }

      const message = 'Unable to restore from cloud right now. Please try again.';
      await persistSyncState(lastSyncAt, message);
      setStatus('error');
    }
  }, [lastSyncAt, performSync, persistSyncState]);

  const signIn = useCallback(async () => {
    setStatus('signing_in');
    setErrorMessage(null);

    try {
      const session = await signInToGoogleDrive();
      setAccount(session);
      setStatus('idle');
      await performSync('pull');
    } catch (error) {
      if (isGoogleSignInCancelled(error)) {
        setStatus('idle');
        return;
      }

      if (isGoogleSignInUnavailable(error)) {
        setStatus('error');
        setErrorMessage('Google sign-in requires a native development/production build (not Expo Go).');
        return;
      }

      setStatus('error');
      setErrorMessage('Google sign-in failed. Please try again.');
    }
  }, [performSync]);

  const signOut = useCallback(async () => {
    await signOutFromGoogleDrive();
    setAccount(null);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    void (async () => {
      let session: GoogleDriveSession | null = null;
      try {
        configureGoogleDriveSignIn();
        session = await getGoogleDriveSession();
      } catch (error) {
        if (isGoogleSignInUnavailable(error)) {
          setErrorMessage('Google sign-in requires a native development/production build (not Expo Go).');
        }
      }

      const [storedSyncAt, storedError] = await Promise.all([
        SecureStore.getItemAsync(LAST_SYNC_KEY),
        SecureStore.getItemAsync(LAST_SYNC_ERROR_KEY),
      ]);

      setAccount(session);
      setLastSyncAt(storedSyncAt ?? null);
      setErrorMessage(storedError ?? null);

      if (session) {
        await performSync('pull');
      }
    })();
  }, [performSync]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && account) {
        void performSync('pull').catch(() => undefined);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [account, performSync]);

  useEffect(() => {
    if (!account || loading) {
      return;
    }

    const snapshot = exportInventorySyncState();
    if (!snapshot) {
      return;
    }

    const nextFingerprint = JSON.stringify(snapshot);
    if (lastFingerprintRef.current === nextFingerprint) {
      return;
    }

    lastFingerprintRef.current = nextFingerprint;

    if (pushDebounceRef.current) {
      clearTimeout(pushDebounceRef.current);
    }

    pushDebounceRef.current = setTimeout(() => {
      void syncNow();
    }, 2000);

    return () => {
      if (pushDebounceRef.current) {
        clearTimeout(pushDebounceRef.current);
      }
    };
  }, [account, exportInventorySyncState, loading, syncNow]);

  const value = useMemo(() => ({
    account,
    status,
    lastSyncAt,
    errorMessage,
    signIn,
    signOut,
    syncNow,
    restoreFromCloud,
  }), [account, errorMessage, lastSyncAt, restoreFromCloud, signIn, signOut, status, syncNow]);

  return (
    <GoogleDriveSyncContext.Provider value={value}>
      {children}
    </GoogleDriveSyncContext.Provider>
  );
}

export function useGoogleDriveSync() {
  const context = useContext(GoogleDriveSyncContext);
  if (!context) {
    throw new Error('useGoogleDriveSync must be used within GoogleDriveSyncProvider.');
  }

  return context;
}
