import appJson from "./app.json";

export default {
  ...appJson.expo,

  plugins: [...(appJson.expo.plugins ?? []), "@sentry/react-native"],

  extra: {
    ...appJson.expo.extra,
    buildTime: new Date().toISOString(),
  },
};
