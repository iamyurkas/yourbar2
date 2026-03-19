import base from "./app.base.json";

type ExpoConfig = Record<string, any>;
type ExpoIosConfig = {
  infoPlist?: Record<string, unknown>;
} & Record<string, unknown>;

export default ({ config }: { config: ExpoConfig }) => {
  const baseExpo = base.expo ?? {};
  const baseExtra = (baseExpo.extra as Record<string, any>) ?? {};
  const configExtra = (config.extra as Record<string, any>) ?? {};

  const googleDriveClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? baseExtra.googleDriveClientId ?? configExtra.googleDriveClientId ?? null;
  const googleDriveAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? baseExtra.googleDriveAndroidClientId ?? configExtra.googleDriveAndroidClientId ?? null;
  const googleDriveIosClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? baseExtra.googleDriveIosClientId ?? configExtra.googleDriveIosClientId ?? null;
  const googleDriveWebClientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID ?? baseExtra.googleDriveWebClientId ?? configExtra.googleDriveWebClientId ?? null;

  // Use a specialized array to ensure proper client ID prioritization,
  // favoring iOS-type IDs to avoid custom URI scheme issues on Android
  // during browser-based OAuth flows.
  const googleClientIds = [
    googleDriveIosClientId,
    googleDriveAndroidClientId,
    googleDriveWebClientId,
    googleDriveClientId,
  ].filter((id): id is string => Boolean(id));

  return {
    expo: {
      ...baseExpo,
      ...config,

      name: baseExpo.name,
      slug: baseExpo.slug,
      scheme: baseExpo.scheme,
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

      plugins: [
        ...(baseExpo.plugins ?? []),
        ...(config.plugins ?? []),
        "expo-secure-store",
      ],

      extra: {
        ...baseExtra,
        ...configExtra,

        googleDriveClientId,
        googleDriveAndroidClientId,
        googleDriveIosClientId,
        googleDriveWebClientId,
        googleClientIds,

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
