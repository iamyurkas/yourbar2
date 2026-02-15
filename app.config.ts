import base from "./app.base.json";

type ExpoConfig = Record<string, any>;

export default ({ config }: { config: ExpoConfig }) => ({
  expo: {
    ...config,
    ...base.expo,

    ios: {
      ...(config.ios ?? {}),
      ...(base.expo.ios ?? {}),
      bundleIdentifier: "com.yourbarapp.free",

      infoPlist: {
        ...((config.ios ?? {}).infoPlist ?? {}),
        ...((base.expo.ios ?? {}).infoPlist ?? {}),
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      ...(config.android ?? {}),
      ...(base.expo.android ?? {}),
    },

    plugins: base.expo.plugins ?? [],

    extra: {
      ...(config.extra ?? {}),
      ...(base.expo.extra ?? {}),
      iosAppStoreCountryCode: process.env.EXPO_PUBLIC_IOS_APP_STORE_COUNTRY_CODE ?? null,
      androidPlayStoreCountryCode: process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_COUNTRY_CODE ?? null,
      buildTime: new Date().toISOString(),
    },
  },
});
