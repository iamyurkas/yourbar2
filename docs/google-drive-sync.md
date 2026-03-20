# Google Drive sync (native Google Sign-In)

Your Bar uses **native Google Sign-In** via `@react-native-google-signin/google-signin`.

## Why not browser redirect OAuth on Android?

Android Google OAuth in Expo should use native sign-in APIs for production reliability. Browser `AuthSession` + custom redirect URIs are more fragile (deep-link mismatch risks, browser interruptions, and proxy redirect coupling).

This app intentionally does **not** use:

- Expo AuthSession browser OAuth flow for Android
- Expo proxy redirect
- custom redirect URI OAuth flow for Android Google sign-in

## Required env vars

- `EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID`

`EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` is no longer needed.

## Sync model

- Drive API v3
- Hidden `appDataFolder`
- Stable filename: `yourbar-sync.json`
- Single typed envelope with metadata:
  - `schemaVersion`
  - `exportedAt`
  - `deviceId`
  - `appVersion`
  - `syncRevision`
  - `checksum`
  - `snapshot`

Conflict handling uses deterministic snapshot-level LWW:

1. Newer `exportedAt` wins
2. Tie-break by higher `syncRevision`
3. Final tie-break by lexicographic `deviceId`

The sync file is deduplicated in `appDataFolder` (newest file kept).
