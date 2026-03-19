import base from "./app.base.json";

type ExpoConfig = Record<string, any>;
type ExpoIosConfig = {
  infoPlist?: Record<string, unknown>;
} & Record<string, unknown>;

export default ({ config }: { config: ExpoConfig }) => {
  const baseExpo = base.expo ?? {};
  const configureScheme = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.length > 0);
    }
    if (typeof value === "string" && value.length > 0) {
      return [value];
    }
    return [];
  };
  const getGoogleSchemeFromClientId = (clientId: string | undefined): string | null => {
    if (!clientId) {
      return null;
    }
    const suffix = ".apps.googleusercontent.com";
    if (!clientId.endsWith(suffix)) {
      return null;
    }
    const appIdPrefix = clientId.slice(0, -suffix.length);
    return appIdPrefix ? `com.googleusercontent.apps.${appIdPrefix}` : null;
  };

  const baseExtra = (baseExpo.extra ?? {}) as Record<string, unknown>;
  const configExtra = (config.extra ?? {}) as Record<string, unknown>;

  const googleDriveClientId =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ??
    (baseExtra.googleDriveClientId as string | undefined) ??
    (configExtra.googleDriveClientId as string | undefined) ??
    null;

  const googleDriveIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ??
    (baseExtra.googleDriveIosClientId as string | undefined) ??
    (configExtra.googleDriveIosClientId as string | undefined) ??
    null;

  const googleDriveAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ??
    (baseExtra.googleDriveAndroidClientId as string | undefined) ??
    (configExtra.googleDriveAndroidClientId as string | undefined) ??
    null;

  const googleDriveWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID ??
    (baseExtra.googleDriveWebClientId as string | undefined) ??
    (configExtra.googleDriveWebClientId as string | undefined) ??
    null;

  const googleClientIds = [
    googleDriveIosClientId,
    googleDriveAndroidClientId,
    googleDriveClientId,
    googleDriveWebClientId,
  ].filter((id): id is string => Boolean(id));

  const configuredSchemes = [
    ...configureScheme(baseExpo.scheme),
    ...configureScheme(config.scheme),
    getGoogleSchemeFromClientId(googleDriveAndroidClientId ?? undefined),
    getGoogleSchemeFromClientId(googleDriveIosClientId ?? undefined),
  ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);

  return {
    expo: {
      ...baseExpo,
      ...config,

      name: baseExpo.name,
      slug: baseExpo.slug,
      scheme: configuredSchemes.length > 0 ? configuredSchemes : baseExpo.scheme,
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
        ...baseExtra,
        ...configExtra,

        iosAppStoreCountryCode:
          process.env.EXPO_PUBLIC_IOS_APP_STORE_COUNTRY_CODE ??
          (baseExtra.iosAppStoreCountryCode as string | undefined) ??
          (configExtra.iosAppStoreCountryCode as string | undefined) ??
          null,
        iosAppStoreId:
          process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ??
          (baseExtra.iosAppStoreId as string | undefined) ??
          (configExtra.iosAppStoreId as string | undefined) ??
          "6758964503",
        androidPlayStoreCountryCode:
          process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_COUNTRY_CODE ??
          (baseExtra.androidPlayStoreCountryCode as string | undefined) ??
          (configExtra.androidPlayStoreCountryCode as string | undefined) ??
          null,

        googleDriveClientId,
        googleDriveIosClientId,
        googleDriveAndroidClientId,
        googleDriveWebClientId,
        googleClientIds,

        buildTime: new Date().toISOString(),
      },
    },
  };
};
