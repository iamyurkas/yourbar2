const { withAndroidStyles, withAndroidManifest } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to disable Android's "Force Dark" mode.
 * This ensures that the app's theme is not automatically darkened or mangled by the OS
 * on devices with aggressive dark mode settings (like Xiaomi/MIUI).
 */
const withAndroidForceDark = (config) => {
  // 1. Set android:forceDarkAllowed="false" in all styles
  config = withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style;
    if (styles) {
      styles.forEach((style) => {
        if (!style.item) {
          style.item = [];
        }

        // Check if the item already exists to avoid duplicates
        const hasForceDark = style.item.some(
          (item) => item.$.name === "android:forceDarkAllowed"
        );

        if (!hasForceDark) {
          style.item.push({
            $: { name: "android:forceDarkAllowed" },
            _: "false",
          });
        }
      });
    }

    return config;
  });

  // 2. Set android:forceDarkAllowed="false" in AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    if (application) {
      if (!application.$) {
        application.$ = {};
      }
      application.$["android:forceDarkAllowed"] = "false";

      if (application.activity) {
        application.activity.forEach((activity) => {
          if (!activity.$) {
            activity.$ = {};
          }
          activity.$["android:forceDarkAllowed"] = "false";
        });
      }
    }
    return config;
  });

  return config;
};

module.exports = withAndroidForceDark;
