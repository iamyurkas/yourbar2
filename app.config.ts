import base from "./app.base.json";

type ExpoConfig = Record<string, any>;
type ExpoIosConfig = {
  infoPlist?: Record<string, unknown>;
} & Record<string, unknown>;

export default ({ config }: { config: ExpoConfig }) => ({
  expo: {
    ...config,
    ...base.expo,

	  ios: {
	    ...(config.ios ?? {}),
	    ...(base.expo.ios ?? {}),
	    bundleIdentifier: "com.yourbarapp.free",

	    infoPlist: {
	      ...(((config.ios ?? {}) as ExpoIosConfig).infoPlist ?? {}),
	      ...(((base.expo.ios ?? {}) as ExpoIosConfig).infoPlist ?? {}),
	      ITSAppUsesNonExemptEncryption: false,
        NSPhotoLibraryUsageDescription:
          "Your Bar uses your photo library so you can attach custom photos to cocktails and ingredients.",
        NSPhotoLibraryAddUsageDescription:
          "Your Bar can save exported bar data to files you choose.",
      },
    },

    android: {
      ...(config.android ?? {}),
      ...(base.expo.android ?? {}),
      package: "com.yourbarapp.free",
    },

    plugins: base.expo.plugins ?? [],

    extra: {
      ...(config.extra ?? {}),
      ...(base.expo.extra ?? {}),
      iosAppStoreCountryCode:
        process.env.EXPO_PUBLIC_IOS_APP_STORE_COUNTRY_CODE ?? null,
      iosAppStoreId: process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? null,
      androidPlayStoreCountryCode:
        process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_COUNTRY_CODE ?? null,
      buildTime: new Date().toISOString(),
    },
  },
});
