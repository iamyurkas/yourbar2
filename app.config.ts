import base from "./app.base.json";

type ExpoConfig = Record<string, any>;
type ExpoIosConfig = {
  infoPlist?: Record<string, unknown>;
} & Record<string, unknown>;

export default ({ config }: { config: ExpoConfig }) => {
  const baseExpo = base.expo ?? {};
  const googleClientIds = [
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? null,
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? null,
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? null,
  ];
  const googleSchemes = googleClientIds
    .flatMap((candidate) => (typeof candidate === "string" ? [candidate.trim()] : []))
    .filter((candidate) => candidate.endsWith(".apps.googleusercontent.com"))
    .map((candidate) =>
      `com.googleusercontent.apps.${candidate.replace(/\\.apps\\.googleusercontent\\.com$/, "")}`,
    );
  const configuredScheme = baseExpo.scheme ?? config.scheme ?? "yourbar";
  const primaryScheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme;
  const uniqueGoogleSchemes = Array.from(new Set(googleSchemes));
  const existingIosUrlTypes = [
    ...((((baseExpo.ios as ExpoIosConfig)?.infoPlist?.CFBundleURLTypes as Array<Record<string, unknown>> | undefined) ?? [])),
    ...((((config.ios as ExpoIosConfig)?.infoPlist?.CFBundleURLTypes as Array<Record<string, unknown>> | undefined) ?? [])),
  ];
  const googleIosUrlTypes = uniqueGoogleSchemes.map((scheme) => ({
    CFBundleURLSchemes: [scheme],
  }));
  const existingAndroidIntentFilters = [
    ...(((baseExpo.android as { intentFilters?: Array<Record<string, unknown>> } | undefined)?.intentFilters ?? [])),
    ...(((config.android as { intentFilters?: Array<Record<string, unknown>> } | undefined)?.intentFilters ?? [])),
  ];
  const googleAndroidIntentFilters = uniqueGoogleSchemes.map((scheme) => ({
    action: "VIEW",
    category: ["BROWSABLE", "DEFAULT"],
    data: [{ scheme }],
  }));

  return {
    expo: {
      ...baseExpo,
      ...config,

      name: baseExpo.name,
      slug: baseExpo.slug,
      scheme: primaryScheme,
      version: baseExpo.version,

      ios: {
        ...(baseExpo.ios ?? {}),
        ...(config.ios ?? {}),

        bundleIdentifier: "com.yourbarapp.free",

        infoPlist: {
          ...((baseExpo.ios as ExpoIosConfig)?.infoPlist ?? {}),
          ...((config.ios as ExpoIosConfig)?.infoPlist ?? {}),
          CFBundleURLTypes: [...existingIosUrlTypes, ...googleIosUrlTypes],

          ITSAppUsesNonExemptEncryption: false,

          NSPhotoLibraryUsageDescription:
            "Your Bar uses your photo library so you can attach custom photos to cocktails and ingredients.",
        },
      },

      android: {
        ...(baseExpo.android ?? {}),
        ...(config.android ?? {}),
        intentFilters: [...existingAndroidIntentFilters, ...googleAndroidIntentFilters],

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
        googleDriveClientId:
          process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ?? null,
        googleDriveAndroidClientId:
          process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID ?? null,
        googleDriveIosClientId:
          process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID ?? null,

        buildTime: new Date().toISOString(),
      },
    },
  };
};
