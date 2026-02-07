import base from "./app.base.json";

type ExpoConfig = Record<string, any>;

export default ({ config }: { config: ExpoConfig }) => ({
  expo: {
    ...config,
    ...base.expo,

    plugins: base.expo.plugins ?? [],

    extra: {
      ...(config.extra ?? {}),
      ...(base.expo.extra ?? {}),
      buildTime: new Date().toISOString(),
    },
  },
});
