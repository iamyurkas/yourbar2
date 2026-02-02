// plugins/withForceDarkAllowed.js
const { withAndroidStyles, AndroidConfig } = require("@expo/config-plugins");

function setForceDarkAllowedFalse(styles) {
  return AndroidConfig.Styles.assignStylesValue(styles, {
    add: true,
    parent: { name: "AppTheme" },
    name: "android:forceDarkAllowed",
    value: "false",
  });
}

module.exports = function withForceDarkAllowed(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = setForceDarkAllowedFalse(config.modResults);
    return config;
  });
};
