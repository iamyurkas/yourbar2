import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
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
  GoogleDriveSyncError,
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
  diagnostics: string | null;
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
const LAST_SYNC_SNAPSHOT_KEY = 'google_drive_last_sync_snapshot';
const LAST_SYNC_SNAPSHOT_FILENAME = 'google-drive-last-sync-snapshot.json';
const SYNC_TIMEOUT_MS = 20000;
const AUTO_PULL_INTERVAL_MS = 5 * 60 * 1000;

function logSync(step: string, details?: Record<string, unknown>) {
  void step;
  void details;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`sync_timeout_${timeoutMs}`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function mapSyncErrorToUserMessage(error: unknown, mode: 'push' | 'pull'): string {
  if (isGoogleSignInUnavailable(error)) {
    return 'Google sync is unavailable in Expo Go. Use a development build.';
  }

  if (error instanceof GoogleDriveSyncError) {
    if (error.status === 401) {
      return 'Google authorization expired. Please sign out and sign in again.';
    }

    if (error.status === 403) {
      return 'Google Drive access is forbidden. Check Drive API and appDataFolder scope in Google Cloud Console.';
    }

    return mode === 'pull'
      ? 'Unable to restore from cloud right now.'
      : 'Unable to sync now.';
  }

  if (error instanceof Error && error.message.startsWith('sync_timeout_')) {
    return 'Google Drive sync timed out. Please try again.';
  }

  return mode === 'pull'
    ? 'Unable to restore from cloud right now. Please try again.'
    : 'Unable to sync now. Please check your internet connection and try again.';
}

function resolveLastSyncSnapshotPath(): string | undefined {
  const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!baseDirectory) {
    return undefined;
  }

  return `${baseDirectory.replace(/\/?$/, '/')}${LAST_SYNC_SNAPSHOT_FILENAME}`;
}

function buildDiagnostics(error: unknown, mode: 'push' | 'pull'): string {
  const timestamp = new Date().toISOString();
  if (error instanceof GoogleDriveSyncError) {
    return [
      `time=${timestamp}`,
      `mode=${mode}`,
      `operation=${error.operation}`,
      `status=${error.status ?? 'unknown'}`,
      `message=${error.message}`,
      `response=${(error.responseBody ?? '').slice(0, 300)}`,
    ].join('\n');
  }

  if (error instanceof Error) {
    return [
      `time=${timestamp}`,
      `mode=${mode}`,
      `message=${error.message}`,
      `stack=${(error.stack ?? '').slice(0, 300)}`,
    ].join('\n');
  }

  return `time=${timestamp}\nmode=${mode}\nerror=${String(error)}`;
}

async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  let generated: string | null = null;
  if (Application.applicationId) {
    if (Application.nativeApplicationVersion && Application.nativeBuildVersion) {
      logSync('getDeviceId:app_info', {
        applicationId: Application.applicationId,
        nativeVersion: Application.nativeApplicationVersion,
        nativeBuildVersion: Application.nativeBuildVersion,
      });
    }
  }

  if (Application.androidId) {
    generated = Application.androidId;
  } else {
    try {
      generated = await Application.getIosIdForVendorAsync();
    } catch {
      generated = null;
    }
  }

  if (!generated) {
    generated = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (const key of aKeys) {
      if (!(key in b) || !deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function isPrimitiveArray(values: readonly unknown[]): boolean {
  return values.every((value) => value === null || ['string', 'number', 'boolean'].includes(typeof value));
}

function mergePrimitiveArrayByDelta(baseValue: unknown, localValue: unknown, remoteValue: unknown): unknown {
  if (!Array.isArray(baseValue) || !Array.isArray(localValue) || !Array.isArray(remoteValue)) {
    return remoteValue;
  }

  if (!isPrimitiveArray(baseValue) || !isPrimitiveArray(localValue) || !isPrimitiveArray(remoteValue)) {
    return remoteValue;
  }

  const baseSet = new Set(baseValue);
  const localSet = new Set(localValue);
  const remoteSet = new Set(remoteValue);

  const localAdds = new Set(Array.from(localSet).filter((value) => !baseSet.has(value)));
  const localRemoves = new Set(Array.from(baseSet).filter((value) => !localSet.has(value)));
  const remoteAdds = new Set(Array.from(remoteSet).filter((value) => !baseSet.has(value)));
  const remoteRemoves = new Set(Array.from(baseSet).filter((value) => !remoteSet.has(value)));

  const mergedSet = new Set(baseSet);
  localAdds.forEach((value) => mergedSet.add(value));
  remoteAdds.forEach((value) => mergedSet.add(value));
  localRemoves.forEach((value) => mergedSet.delete(value));
  remoteRemoves.forEach((value) => mergedSet.delete(value));

  const merged = Array.from(mergedSet);
  if (merged.every((value) => typeof value === 'number')) {
    return merged.map((value) => Number(value)).sort((a, b) => a - b);
  }

  return merged;
}

function threeWayMerge(baseValue: unknown, localValue: unknown, remoteValue: unknown): unknown {
  if (deepEqual(localValue, remoteValue)) {
    return localValue;
  }

  if (deepEqual(localValue, baseValue)) {
    return remoteValue;
  }

  if (deepEqual(remoteValue, baseValue)) {
    return localValue;
  }

  if (Array.isArray(baseValue) && Array.isArray(localValue) && Array.isArray(remoteValue)) {
    return mergePrimitiveArrayByDelta(baseValue, localValue, remoteValue);
  }

  if (isPlainObject(baseValue) && isPlainObject(localValue) && isPlainObject(remoteValue)) {
    const keys = new Set([
      ...Object.keys(baseValue),
      ...Object.keys(localValue),
      ...Object.keys(remoteValue),
    ]);
    const merged: Record<string, unknown> = {};
    keys.forEach((key) => {
      merged[key] = threeWayMerge(baseValue[key], localValue[key], remoteValue[key]);
    });
    return merged;
  }

  return remoteValue;
}

function mergeSyncSnapshotsWithBase(params: {
  baseSnapshot: InventorySyncStateSnapshot | null;
  localSnapshot: InventorySyncStateSnapshot;
  remoteSnapshot: InventorySyncStateSnapshot;
}): InventorySyncStateSnapshot {
  const { baseSnapshot, localSnapshot, remoteSnapshot } = params;
  if (!baseSnapshot) {
    return remoteSnapshot;
  }

  return threeWayMerge(baseSnapshot, localSnapshot, remoteSnapshot) as InventorySyncStateSnapshot;
}

async function getLastSyncedSnapshot(): Promise<InventorySyncStateSnapshot | null> {
  const storagePath = resolveLastSyncSnapshotPath();
  if (storagePath) {
    try {
      const info = await FileSystem.getInfoAsync(storagePath);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(storagePath);
        if (raw) {
          return JSON.parse(raw) as InventorySyncStateSnapshot;
        }
      }
    } catch {}
  }

  const raw = await SecureStore.getItemAsync(LAST_SYNC_SNAPSHOT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as InventorySyncStateSnapshot;
  } catch {
    return null;
  }
}

async function setLastSyncedSnapshot(snapshot: InventorySyncStateSnapshot): Promise<void> {
  const raw = JSON.stringify(snapshot);
  const storagePath = resolveLastSyncSnapshotPath();
  if (storagePath) {
    await FileSystem.writeAsStringAsync(storagePath, raw);
    await SecureStore.deleteItemAsync(LAST_SYNC_SNAPSHOT_KEY);
    return;
  }

  await SecureStore.setItemAsync(LAST_SYNC_SNAPSHOT_KEY, raw);
}

export function GoogleDriveSyncProvider({ children }: { children: React.ReactNode }) {
  const { exportInventorySyncState, importInventorySyncState, loading } = useInventory();
  const [account, setAccount] = useState<GoogleDriveSession | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);
  const hasPendingChangesRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const performSyncRef = useRef<((mode: 'push' | 'pull') => Promise<void>) | null>(null);

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
    logSync('performSync:requested', { mode });
    if (syncInFlightRef.current) {
      logSync('performSync:skipped_in_flight', { mode });
      return syncInFlightRef.current;
    }

    if (loading) {
      logSync('performSync:skipped_loading', { mode });
      return;
    }

    const snapshot = exportInventorySyncState();
    if (!snapshot) {
      logSync('performSync:skipped_no_snapshot', { mode });
      return;
    }

    const syncPromise = (async () => {
      logSync('performSync:start', { mode });
      setStatus('syncing');
      const accessToken = await withTimeout(getGoogleDriveAccessToken(), SYNC_TIMEOUT_MS);
      const deviceId = await withTimeout(getDeviceId(), SYNC_TIMEOUT_MS);
      const appVersion = getAppVersion();
      const syncRevision = Number(await SecureStore.getItemAsync(SYNC_REVISION_KEY) ?? '0');
      logSync('performSync:context_ready', {
        mode,
        deviceId,
        appVersion,
        syncRevision,
      });

      if (mode === 'pull') {
        const baseSnapshot = await getLastSyncedSnapshot();
        const remoteFile = await withTimeout(
          readGoogleDriveSnapshot<InventorySyncStateSnapshot>(accessToken),
          SYNC_TIMEOUT_MS,
        );
        logSync('performSync:pull_remote_result', {
          hasRemoteFile: Boolean(remoteFile),
          remoteRevision: remoteFile?.envelope?.syncRevision ?? null,
          remoteExportedAt: remoteFile?.envelope?.exportedAt ?? null,
        });
        if (remoteFile?.envelope?.snapshot) {
          const localEnvelope = createSyncEnvelope({
            snapshot,
            deviceId,
            appVersion,
            syncRevision,
          });

          if (shouldUseRemote(remoteFile.envelope, localEnvelope)) {
            logSync('performSync:pull_applying_remote_snapshot', {
              remoteRevision: remoteFile.envelope.syncRevision,
            });
            const mergedRemoteSnapshot = mergeSyncSnapshotsWithBase({
              baseSnapshot,
              localSnapshot: snapshot,
              remoteSnapshot: remoteFile.envelope.snapshot,
            });
            importInventorySyncState(mergedRemoteSnapshot);
            lastFingerprintRef.current = JSON.stringify(mergedRemoteSnapshot);
            await SecureStore.setItemAsync(SYNC_REVISION_KEY, String(remoteFile.envelope.syncRevision));
            await setLastSyncedSnapshot(mergedRemoteSnapshot);
          }
          else {
            logSync('performSync:pull_kept_local_snapshot');
            await setLastSyncedSnapshot(snapshot);
          }
        }
        else {
          await setLastSyncedSnapshot(snapshot);
        }

        const completedAt = new Date().toISOString();
        await persistSyncState(completedAt, null);
        logSync('performSync:pull_success', { completedAt });
        setDiagnostics(null);
        return;
      }

      const nextRevision = syncRevision + 1;
      const envelope = createSyncEnvelope({
        snapshot,
        deviceId,
        appVersion,
        syncRevision: nextRevision,
      });

      await withTimeout(upsertGoogleDriveSnapshot({ accessToken, envelope }), SYNC_TIMEOUT_MS);
      await SecureStore.setItemAsync(SYNC_REVISION_KEY, String(nextRevision));
      await setLastSyncedSnapshot(envelope.snapshot);
      logSync('performSync:push_uploaded', {
        nextRevision,
        exportedAt: envelope.exportedAt,
      });

      const completedAt = new Date().toISOString();
      await persistSyncState(completedAt, null);
      logSync('performSync:push_success', { completedAt });
      setDiagnostics(null);
    })()
      .finally(() => {
        logSync('performSync:finished', { mode });
        setStatus('idle');
        syncInFlightRef.current = null;
      });

    syncInFlightRef.current = syncPromise;
    return syncPromise;
  }, [exportInventorySyncState, importInventorySyncState, loading, persistSyncState]);

  useEffect(() => {
    performSyncRef.current = performSync;
  }, [performSync]);

  const syncNow = useCallback(async () => {
    logSync('syncNow:requested');
    try {
      await performSync('pull');
      await performSync('push');
      hasPendingChangesRef.current = false;
      logSync('syncNow:completed_bidirectional');
    } catch (error) {
      logSync('syncNow:error', {
        errorType: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
      const message = mapSyncErrorToUserMessage(error, 'push');
      await persistSyncState(lastSyncAt, message);
      setDiagnostics(buildDiagnostics(error, 'push'));
      setStatus('error');
      retryTimeoutRef.current = setTimeout(() => {
        void performSync('push').catch(() => undefined);
      }, 30000);
    }
  }, [lastSyncAt, performSync, persistSyncState]);

  const restoreFromCloud = useCallback(async () => {
    logSync('restoreFromCloud:requested');
    try {
      await performSync('pull');
      await performSync('push');
      logSync('restoreFromCloud:completed_bidirectional');
    } catch (error) {
      logSync('restoreFromCloud:error', {
        errorType: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      });
      const message = mapSyncErrorToUserMessage(error, 'pull');
      await persistSyncState(lastSyncAt, message);
      setDiagnostics(buildDiagnostics(error, 'pull'));
      setStatus('error');
    }
  }, [lastSyncAt, performSync, persistSyncState]);

  const signIn = useCallback(async () => {
    logSync('signIn:requested');
    setStatus('signing_in');
    setErrorMessage(null);

    try {
      const session = await signInToGoogleDrive();
      logSync('signIn:success', { email: session.email });
      setAccount(session);
      setStatus('idle');
      await performSync('pull');
    } catch (error) {
      if (isGoogleSignInCancelled(error)) {
        logSync('signIn:cancelled');
        setStatus('idle');
        return;
      }

      if (isGoogleSignInUnavailable(error)) {
        setStatus('error');
        setErrorMessage('Google sign-in requires a native development/production build (not Expo Go).');
        setDiagnostics(buildDiagnostics(error, 'pull'));
        return;
      }

      setStatus('error');
      setErrorMessage('Google sign-in failed. Please try again.');
      setDiagnostics(buildDiagnostics(error, 'pull'));
      logSync('signIn:error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [performSync]);

  const signOut = useCallback(async () => {
    logSync('signOut:requested');
    await signOutFromGoogleDrive();
    await SecureStore.deleteItemAsync(LAST_SYNC_SNAPSHOT_KEY);
    const storagePath = resolveLastSyncSnapshotPath();
    if (storagePath) {
      await FileSystem.deleteAsync(storagePath, { idempotent: true });
    }
    setAccount(null);
    setStatus('idle');
    setErrorMessage(null);
    setDiagnostics(null);
  }, []);

  useEffect(() => {
    void (async () => {
      logSync('bootstrap:start');
      let session: GoogleDriveSession | null = null;
      try {
        configureGoogleDriveSignIn();
        logSync('bootstrap:configured_signin');
        session = await getGoogleDriveSession();
        logSync('bootstrap:session_loaded', { hasSession: Boolean(session) });
      } catch (error) {
        if (isGoogleSignInUnavailable(error)) {
          setErrorMessage('Google sign-in requires a native development/production build (not Expo Go).');
          setDiagnostics(buildDiagnostics(error, 'pull'));
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
        logSync('bootstrap:initial_sync');
        await performSyncRef.current?.('pull');
        await performSyncRef.current?.('push');
      }
      logSync('bootstrap:done');
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && account && hasPendingChangesRef.current) {
        logSync('appState:active_trigger_sync_with_pending_changes');
        void syncNow().catch(() => undefined);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [account, syncNow]);

  useEffect(() => {
    if (!account) {
      return;
    }

    const interval = setInterval(() => {
      if (!hasPendingChangesRef.current) {
        logSync('autoSync:interval_skipped_no_pending_changes', { intervalMs: AUTO_PULL_INTERVAL_MS });
        return;
      }

      logSync('autoSync:interval_trigger_sync', { intervalMs: AUTO_PULL_INTERVAL_MS });
      void syncNow().catch(() => undefined);
    }, AUTO_PULL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [account, syncNow]);

  useEffect(() => {
    if (!account || loading) {
      return;
    }

    const snapshot = exportInventorySyncState();
    if (!snapshot) {
      return;
    }

    const nextFingerprint = JSON.stringify(snapshot);
    if (lastFingerprintRef.current === null) {
      lastFingerprintRef.current = nextFingerprint;
      logSync('autoSync:fingerprint_initialized');
      return;
    }

    if (lastFingerprintRef.current === nextFingerprint) {
      logSync('autoSync:skipped_same_fingerprint');
      return;
    }

    lastFingerprintRef.current = nextFingerprint;
    hasPendingChangesRef.current = true;
    logSync('autoSync:marked_pending_changes');
  }, [account, exportInventorySyncState, loading]);

  const value = useMemo(() => ({
    account,
    status,
    lastSyncAt,
    errorMessage,
    diagnostics,
    signIn,
    signOut,
    syncNow,
    restoreFromCloud,
  }), [account, diagnostics, errorMessage, lastSyncAt, restoreFromCloud, signIn, signOut, status, syncNow]);

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
