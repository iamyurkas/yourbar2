import { Platform } from "react-native";

import { bytesToBase64 } from "@/libs/archive-utils";

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
  codeChallengeMethod: "S256" | "plain";
  clientSource: "default" | "android" | "ios" | "web";
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
  scope?: string;
};

function getPlatformClientId(
  forceSource?: "default" | "android" | "ios" | "web",
): { clientId: string; source: "default" | "android" | "ios" | "web" } | null {
  const fallback = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? null;
  const webClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID ?? null;
  const androidClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? null;
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? null;
  const useAndroidClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_USE_ANDROID_CLIENT === "true";
  const useIosClient = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_USE_IOS_CLIENT === "true";

  if (Platform.OS === "android") {
    if (forceSource === "android" && useAndroidClient && androidClient) {
      return { clientId: androidClient, source: "android" };
    }
    if (forceSource === "default" && fallback) {
      return { clientId: fallback, source: "default" };
    }
    if (forceSource === "web" && webClient) {
      return { clientId: webClient, source: "web" };
    }
    if (forceSource) {
      return null;
    }
    if (useAndroidClient && androidClient) {
      return { clientId: androidClient, source: "android" };
    }
    if (fallback) {
      return { clientId: fallback, source: "default" };
    }
    if (webClient) {
      return { clientId: webClient, source: "web" };
    }
    return null;
  }

  if (Platform.OS === "ios") {
    if (forceSource === "ios" && useIosClient && iosClient) {
      return { clientId: iosClient, source: "ios" };
    }
    if (forceSource === "default" && fallback) {
      return { clientId: fallback, source: "default" };
    }
    if (forceSource === "web" && webClient) {
      return { clientId: webClient, source: "web" };
    }
    if (forceSource) {
      return null;
    }
    if (useIosClient && iosClient) {
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

  if (forceSource === "web" && webClient) {
    return { clientId: webClient, source: "web" };
  }
  if (forceSource === "default" && fallback) {
    return { clientId: fallback, source: "default" };
  }
  if (forceSource) {
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

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256Bytes(message: Uint8Array): Uint8Array {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLength = message.length * 8;
  const withOne = message.length + 1;
  const totalLength = Math.ceil((withOne + 8) / 64) * 64;
  const padded = new Uint8Array(totalLength);
  padded.set(message);
  padded[message.length] = 0x80;

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  padded[totalLength - 8] = (high >>> 24) & 0xff;
  padded[totalLength - 7] = (high >>> 16) & 0xff;
  padded[totalLength - 6] = (high >>> 8) & 0xff;
  padded[totalLength - 5] = high & 0xff;
  padded[totalLength - 4] = (low >>> 24) & 0xff;
  padded[totalLength - 3] = (low >>> 16) & 0xff;
  padded[totalLength - 2] = (low >>> 8) & 0xff;
  padded[totalLength - 1] = low & 0xff;

  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let j = 0; j < 16; j += 1) {
      const idx = i + j * 4;
      w[j] = ((padded[idx] << 24) | (padded[idx + 1] << 16) | (padded[idx + 2] << 8) | padded[idx + 3]) >>> 0;
    }
    for (let j = 16; j < 64; j += 1) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let j = 0; j < 64; j += 1) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const hash = new Uint8Array(32);
  H.forEach((value, index) => {
    const offset = index * 4;
    hash[offset] = (value >>> 24) & 0xff;
    hash[offset + 1] = (value >>> 16) & 0xff;
    hash[offset + 2] = (value >>> 8) & 0xff;
    hash[offset + 3] = value & 0xff;
  });
  return hash;
}

async function createCodeChallenge(codeVerifier: string): Promise<{
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
}> {
  const data = new TextEncoder().encode(codeVerifier);
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
      const digest = await subtle.digest("SHA-256", data);
      return {
        codeChallenge: bytesToBase64Url(new Uint8Array(digest)),
        codeChallengeMethod: "S256",
      };
    }
    const digest = sha256Bytes(data);
    return {
      codeChallenge: bytesToBase64Url(digest),
      codeChallengeMethod: "S256",
    };
  } catch {
    return { codeChallenge: codeVerifier, codeChallengeMethod: "plain" };
  }
}

export async function buildGoogleOAuthRequest(input: {
  appRedirectUri: string;
  proxyRedirectUri?: string | null;
  preferProxyRedirect?: boolean;
  forceClientSource?: "default" | "android" | "ios" | "web";
}): Promise<GoogleOAuthRequest | null> {
  const client = getPlatformClientId(input.forceClientSource);
  if (!client) {
    console.warn("[GoogleDriveSync] Google OAuth client id is not configured");
    return null;
  }
  const clientId = client.clientId;

  const nativeScheme = getGoogleNativeRedirectScheme(clientId);
  const canUseNativeRedirect = Boolean(nativeScheme) && (
    (Platform.OS === "ios" && client.source === "ios")
    || (Platform.OS === "android" && client.source === "android")
  );
  const nativeRedirectPath = Platform.OS === "android" ? "oauth2redirect" : "oauthredirect";
  const shouldUseProxyRedirect = Boolean(input.preferProxyRedirect)
    && Platform.OS !== "web"
    && (client.source === "default" || client.source === "web");
  const requiresProxyRedirect = Platform.OS === "android"
    && (client.source === "default" || client.source === "web");
  if (requiresProxyRedirect && !input.proxyRedirectUri) {
    console.warn("[GoogleDriveSync] Android default/web OAuth client requires EXPO_PUBLIC_GOOGLE_DRIVE_REDIRECT_URI");
    return null;
  }
  if (shouldUseProxyRedirect && !input.proxyRedirectUri) {
    console.warn("[GoogleDriveSync] Missing proxy redirect URI for web/default client on native platform");
    return null;
  }
  const redirectUri = canUseNativeRedirect
    ? `${nativeScheme}:/${nativeRedirectPath}`
    : (shouldUseProxyRedirect ? (input.proxyRedirectUri ?? input.appRedirectUri) : input.appRedirectUri);
  const codeVerifier = createCodeVerifier();
  const { codeChallenge, codeChallengeMethod } = await createCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    include_granted_scopes: "true",
    access_type: "offline",
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    prompt: "consent",
  });

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    clientId,
    redirectUri,
    codeVerifier,
    codeChallengeMethod,
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
