import appJson from "./app.json";

export default {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    buildTime: new Date().toISOString(),
  },
};
