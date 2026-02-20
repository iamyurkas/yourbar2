const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to remove orientation restrictions from Android activities.
 * This is important for supporting large screens, tablets, and foldables,
 * especially as Android 16 starts ignoring these restrictions for large devices.
 */
module.exports = function withOrientationRestrictionsRemoved(config) {
  return withAndroidManifest(config, (config) => {
    const mainManifest = config.modResults;
    const application = mainManifest.manifest.application[0];
    const activities = application.activity || [];

    // Ensure the tools namespace is present for tools:remove
    if (!mainManifest.manifest.$["xmlns:tools"]) {
      mainManifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    // 1. Remove orientation from any existing activities in the current manifest (like MainActivity)
    activities.forEach((activity) => {
      if (activity.$["android:screenOrientation"]) {
        delete activity.$["android:screenOrientation"];
      }
    });

    // 2. Explicitly lift restriction from GmsBarcodeScanningDelegateActivity using tools:remove.
    // This activity often comes from libraries and might have a hardcoded orientation.
    const barcodeActivityName = "com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity";
    let barcodeActivity = activities.find(a => a.$["android:name"] === barcodeActivityName);

    if (!barcodeActivity) {
      barcodeActivity = {
        $: {
          "android:name": barcodeActivityName,
          "tools:remove": "android:screenOrientation",
        }
      };
      activities.push(barcodeActivity);
    } else {
      barcodeActivity.$["tools:remove"] = "android:screenOrientation";
      // If it also has it locally, delete it
      delete barcodeActivity.$["android:screenOrientation"];
    }

    application.activity = activities;
    return config;
  });
};
