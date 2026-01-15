const { withAndroidColors, AndroidConfig } = require('@expo/config-plugins');

const { Colors } = AndroidConfig;

const DEFAULT_CROP_BACKGROUND = '#BDBDBD';

const withImagePickerCropBackground = (config, props = {}) => {
  const cropBackgroundColor = props.cropBackgroundColor ?? DEFAULT_CROP_BACKGROUND;

  return withAndroidColors(config, (config) => {
    config.modResults = Colors.assignColorValue(config.modResults, {
      name: 'expoCropBackgroundColor',
      value: cropBackgroundColor,
    });

    return config;
  });
};

module.exports = withImagePickerCropBackground;
