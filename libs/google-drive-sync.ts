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

type GoogleOAuthRequest = {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  clientSource: "default" | "android" | "ios" | "web";
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
  scope?: string;
};

function getPlatformClientId(): { clientId: string; source: "default" | "android" | "ios" | "web" } | null {
  const fallback = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? null;
  const webClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID ?? null;
  const androidClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? null;
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? null;

  if (Platform.OS === "android") {
    if (fallback) {
      return { clientId: fallback, source: "default" };
    }
    if (webClient) {
      return { clientId: webClient, source: "web" };
    }
    if (androidClient) {
      return { clientId: androidClient, source: "android" };
    }
    return null;
  }

  if (Platform.OS === "ios") {
    if (iosClient) {
      return { clientId: iosClient, source: "ios" };
    }
    if (fallback) {
      return { clientId: fallback, source: "default" };
    }
    if (webClient) {
      return { clientId: webClient, source: "web" };
    }
    return null;
  }

  if (webClient) {
    return { clientId: webClient, source: "web" };
  }
  if (fallback) {
    return { clientId: fallback, source: "default" };
  }
  return null;
}

function getGoogleNativeRedirectScheme(clientId: string): string | null {
  const suffix = ".apps.googleusercontent.com";
  if (!clientId.endsWith(suffix)) {
    return null;
  }

  const appIdPrefix = clientId.slice(0, -suffix.length);
  if (!appIdPrefix) {
    return null;
  }

  return `com.googleusercontent.apps.${appIdPrefix}`;
}

function createCodeVerifier(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = 64;
  let output = "";
  for (let index = 0; index < bytes; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    output += alphabet[randomIndex];
  }
  return output;
}

export function buildGoogleOAuthRequest(fallbackRedirectUri: string): GoogleOAuthRequest | null {
  const client = getPlatformClientId();
  if (!client) {
    console.warn("[GoogleDriveSync] Google OAuth client id is not configured");
    return null;
  }
  const clientId = client.clientId;

  const nativeScheme = getGoogleNativeRedirectScheme(clientId);
  const canUseNativeRedirect = Platform.OS === "ios" && client.source === "ios" && Boolean(nativeScheme);
  const redirectUri = Platform.OS === "web" || !canUseNativeRedirect
    ? fallbackRedirectUri
    : `${nativeScheme}:/oauthredirect`;
  const codeVerifier = createCodeVerifier();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    include_granted_scopes: "true",
    access_type: "offline",
    code_challenge: codeVerifier,
    code_challenge_method: "plain",
    prompt: "consent",
  });

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    clientId,
    redirectUri,
    codeVerifier,
    clientSource: client.source,
  };
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
  const file = payload.files?.[0] ?? null;
  console.info("[GoogleDriveSync] Drive file lookup completed", {
    found: Boolean(file),
    fileId: file?.id ?? null,
    modifiedTime: file?.modifiedTime ?? null,
  });
  return file;
}

export async function uploadArchiveToGoogleDrive(accessToken: string, archiveBase64: string): Promise<void> {
  console.info("[GoogleDriveSync] uploadArchiveToGoogleDrive invoked", {
    archiveBase64Length: archiveBase64.length,
  });
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
  console.info("[GoogleDriveSync] downloadArchiveFromGoogleDrive invoked");
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

export async function exchangeGoogleCodeForTokens(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleTokenResponse> {
  console.info("[GoogleDriveSync] Exchanging OAuth code for token", {
    redirectUri: input.redirectUri,
    codeLength: input.code.length,
  });
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  return parseDriveResponse<GoogleTokenResponse>(response);
}
