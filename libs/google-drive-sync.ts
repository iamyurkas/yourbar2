import { Platform } from "react-native";

const GOOGLE_OAUTH_SCOPE = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.appdata",
].join(" ");

const SYNC_FILE_NAME = "yourbar-sync.json";

type GoogleDriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
};

type DriveFilesListResponse = {
  files?: GoogleDriveFile[];
};

type SyncPayload = {
  schemaVersion: 1;
  archiveEncoding: "base64";
  archiveBase64: string;
  updatedAt: string;
};

function getPlatformClientId(): string | null {
  const fallback = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? null;

  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? fallback;
  }

  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? fallback;
  }

  return process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID ?? fallback;
}

export function buildGoogleOAuthUrl(redirectUri: string): string | null {
  const clientId = getPlatformClientId();
  if (!clientId) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: GOOGLE_OAUTH_SCOPE,
    include_granted_scopes: "true",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function parseDriveResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

async function findExistingSyncFile(accessToken: string): Promise<GoogleDriveFile | null> {
  const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseDriveResponse<DriveFilesListResponse>(response);
  return payload.files?.[0] ?? null;
}

export async function uploadArchiveToGoogleDrive(accessToken: string, archiveBase64: string): Promise<void> {
  const existingFile = await findExistingSyncFile(accessToken);
  const payload: SyncPayload = {
    schemaVersion: 1,
    archiveEncoding: "base64",
    archiveBase64,
    updatedAt: new Date().toISOString(),
  };

  if (existingFile) {
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    await parseDriveResponse<Record<string, unknown>>(response);
    return;
  }

  const createResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: SYNC_FILE_NAME,
        parents: ["appDataFolder"],
        mimeType: "application/json",
      }),
    },
  );

  const created = await parseDriveResponse<{ id: string }>(createResponse);
  const uploadResponse = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${created.id}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  await parseDriveResponse<Record<string, unknown>>(uploadResponse);
}

export async function downloadArchiveFromGoogleDrive(accessToken: string): Promise<{ archiveBase64: string; modifiedTime?: string } | null> {
  const existingFile = await findExistingSyncFile(accessToken);
  if (!existingFile) {
    return null;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const payload = await parseDriveResponse<Partial<SyncPayload>>(response);
  if (payload.archiveEncoding !== "base64" || typeof payload.archiveBase64 !== "string") {
    throw new Error("Invalid sync payload in Google Drive");
  }

  return {
    archiveBase64: payload.archiveBase64,
    modifiedTime: existingFile.modifiedTime,
  };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as { email?: string };
  return payload.email ?? null;
}
