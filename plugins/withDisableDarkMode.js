const { withAndroidManifest, withAndroidStyles } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to disable Android's "Force Dark Mode" feature,
 * which is especially aggressive on MIUI (Xiaomi/Redmi) devices.
 */
function withDisableDarkMode(config) {
  // 1. Add meta-data to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    if (!mainApplication["meta-data"]) {
      mainApplication["meta-data"] = [];
    }

    // Check if it already exists to avoid duplicates
    const hasForceDarkMetaData = mainApplication["meta-data"].some(
      (item) => item.$["android:name"] === "android.force_dark_mode_supported"
    );

    if (!hasForceDarkMetaData) {
      mainApplication["meta-data"].push({
        $: {
          "android:name": "android.force_dark_mode_supported",
          "android:value": "false",
        },
      });
    }

    return config;
  });

  // 2. Add forceDarkAllowed=false to Android styles
  config = withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style || [];

    styles.forEach((style) => {
      // Apply to AppTheme and any style inheriting from Theme.AppCompat.Light
      // which are the common names for Expo's main theme.
      if (
        style.$.name === "AppTheme" ||
        (style.$.parent && style.$.parent.includes("Theme.AppCompat.Light"))
      ) {
        if (!style.item) {
          style.item = [];
        }

        const hasForceDarkItem = style.item.some(
          (item) => item.$.name === "android:forceDarkAllowed"
        );

        if (!hasForceDarkItem) {
          style.item.push({
            $: { name: "android:forceDarkAllowed" },
            _: "false",
          });
        }
      }
    });

    return config;
  });

  return config;
}

module.exports = withDisableDarkMode;
