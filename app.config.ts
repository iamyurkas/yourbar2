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
  const configuredSchemes = [
    ...configureScheme(baseExpo.scheme),
    ...configureScheme(config.scheme),
    getGoogleSchemeFromClientId(process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID),
    getGoogleSchemeFromClientId(process.env.EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID),
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
