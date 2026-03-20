import base from "./app.base.json";

type ExpoConfig = Record<string, any>;
type ExpoIosConfig = {
  infoPlist?: Record<string, unknown>;
} & Record<string, unknown>;

export default ({ config }: { config: ExpoConfig }) => {
  const baseExpo = base.expo ?? {};
  const schemeSet = new Set<string>();
  const addScheme = (value?: string | null) => {
    if (!value) {
      return;
    }
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    schemeSet.add(normalized);
  };
  const addGoogleClientScheme = (clientId?: string | null) => {
    if (!clientId) {
      return;
    }
    const suffix = ".apps.googleusercontent.com";
    if (!clientId.endsWith(suffix)) {
      return;
    }
    const appIdPrefix = clientId.slice(0, -suffix.length).trim();
    if (!appIdPrefix) {
      return;
    }
    addScheme(`com.googleusercontent.apps.${appIdPrefix}`);
  };

  if (Array.isArray(baseExpo.scheme)) {
    baseExpo.scheme.forEach((value) => addScheme(typeof value === "string" ? value : null));
  } else {
    addScheme(typeof baseExpo.scheme === "string" ? baseExpo.scheme : null);
  }
  if (Array.isArray(config.scheme)) {
    config.scheme.forEach((value) => addScheme(typeof value === "string" ? value : null));
  } else {
    addScheme(typeof config.scheme === "string" ? config.scheme : null);
  }

  addGoogleClientScheme(process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? null);
  addGoogleClientScheme(process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? null);
  const mergedSchemes = Array.from(schemeSet);

  return {
    expo: {
      ...baseExpo,
      ...config,

      name: baseExpo.name,
      slug: baseExpo.slug,
      scheme: mergedSchemes,
      version: baseExpo.version,

      ios: {
        ...(baseExpo.ios ?? {}),
        ...(config.ios ?? {}),

        bundleIdentifier: "com.yourbarapp.free",

        infoPlist: {
          ...((baseExpo.ios as ExpoIosConfig)?.infoPlist ?? {}),
          ...((config.ios as ExpoIosConfig)?.infoPlist ?? {}),

          ITSAppUsesNonExemptEncryption: false,

          NSPhotoLibraryUsageDescription:
            "Your Bar uses your photo library so you can attach custom photos to cocktails and ingredients.",
        },
      },

      android: {
        ...(baseExpo.android ?? {}),
        ...(config.android ?? {}),

        package: "com.yourbarapp.free",
      },

      plugins: [...(baseExpo.plugins ?? []), ...(config.plugins ?? [])],

      extra: {
        ...(baseExpo.extra ?? {}),
        ...(config.extra ?? {}),

        iosAppStoreCountryCode:
          process.env.EXPO_PUBLIC_IOS_APP_STORE_COUNTRY_CODE ?? null,
        iosAppStoreId: process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? "6758964503",
        androidPlayStoreCountryCode:
          process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_COUNTRY_CODE ?? null,

        buildTime: new Date().toISOString(),
      },
    },
  };
};
