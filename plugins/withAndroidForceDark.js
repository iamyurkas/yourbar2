const { withAndroidStyles } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to disable Android's "Force Dark" mode.
 * This ensures that the app's light theme is not automatically darkened by the OS
 * on devices with aggressive dark mode settings (like Xiaomi/MIUI).
 */
const withAndroidForceDark = (config) => {
  return withAndroidStyles(config, (config) => {
    const mainTheme = config.modResults.resources.style.find(
      (style) => style.$.name === "AppTheme" || style.$.name === "Theme.App"
    );

    if (mainTheme) {
      if (!mainTheme.item) {
        mainTheme.item = [];
      }

      // Check if the item already exists to avoid duplicates
      const hasForceDark = mainTheme.item.some(
        (item) => item.$.name === "android:forceDarkAllowed"
      );

      if (!hasForceDark) {
        mainTheme.item.push({
          $: { name: "android:forceDarkAllowed" },
          _: "false",
        });
      }
    }

    return config;
  });
};

module.exports = withAndroidForceDark;
