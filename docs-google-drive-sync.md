# Google Drive Sync (native mobile)

Your Bar now uses **native Google Sign-In** (`@react-native-google-signin/google-signin`) for iOS and Android.

## Why browser redirect OAuth is not used on Android

Android Google OAuth should use Google Play Services native sign-in for best reliability and user experience. Browser-based AuthSession/proxy/custom redirect flows are intentionally not used here.

## Required environment variables

- `EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID` (used by Google Sign-In token exchange)

`EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` is no longer required and should be removed if it duplicates the web client ID.

## Sync model

- Drive API v3 + hidden `appDataFolder`
- Stable filename: `yourbar-sync.json`
- One typed envelope with:
  - `schemaVersion`
  - `exportedAt`
  - `lastModified`
  - `deviceId`
  - `appVersion`
  - `syncRevision`
  - `checksum`
  - `snapshot`

The snapshot includes complete user state (bars, ingredients, cocktails, settings, tags, onboarding state, and related persisted app state).

### Delta vs full payload

- **On Google Drive we store one full sync envelope** (`yourbar-sync.json`) that contains the latest `snapshot`.
- Inside that `snapshot`, cocktails and ingredients are represented as a **delta against the built-in catalog** (created/updated/deleted), plus full user settings/state maps.
- So transport-wise the app exchanges the latest full envelope file, but snapshot content is already compacted via internal delta structures.

## Conflict policy

- Deterministic last-write-wins using `syncRevision` first, then timestamp (`exportedAt`) as tie-breaker.
- Pull respects newer cloud snapshots.
- Push increments local sync revision.

## Automatic sync behavior

- Pull on app startup (if signed in)
- Pull on sign-in
- Pull when app returns to foreground
- Debounced push after local state changes
- Manual actions from side menu: Sync now, Restore from cloud, Sign out
