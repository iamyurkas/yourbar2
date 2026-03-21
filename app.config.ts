import base from "./app.base.json";

type ExpoConfig = Record<string, any>;
type ExpoIosConfig = {
  infoPlist?: Record<string, unknown>;
} & Record<string, unknown>;

export default ({ config }: { config: ExpoConfig }) => {
  const baseExpo = base.expo ?? {};
  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID?.trim() ?? "";
  const iosUrlScheme = iosClientId
    ? iosClientId.split(".").reverse().join(".")
    : undefined;
  const googleSignInPlugin = [
    "@react-native-google-signin/google-signin",
    ...(iosUrlScheme ? [{ iosUrlScheme }] : []),
  ];

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
          NSCameraUsageDescription:
            "Your Bar uses your camera so you can take photos for cocktails and ingredients.",
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
        googleSignInPlugin,
      ],

      extra: {
        ...(baseExpo.extra ?? {}),
        ...(config.extra ?? {}),

        iosAppStoreCountryCode:
          process.env.EXPO_PUBLIC_IOS_APP_STORE_COUNTRY_CODE ?? null,
        iosAppStoreId: process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? "6758964503",
        androidPlayStoreCountryCode:
          process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_COUNTRY_CODE ?? null,

        buildTime: new Date().toISOString(),
        googleDriveAuth: {
          androidClientId:
            process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? null,
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? null,
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID ?? null,
        },
      },
    },
  };
};
