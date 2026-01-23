import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

export const CROP_RESULT_PARAM = 'cropResult';

export type CropResult = {
  uri: string;
  width: number;
  height: number;
};

type CropLaunchOptions = {
  sourceUri: string;
  aspect?: number;
  returnToPath?: string;
  returnToParams?: string;
};

export const getParamValue = (value?: string | string[]): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export const parseReturnParams = (
  value?: string | string[],
): Record<string, string | number | boolean | null> | undefined => {
  const raw = getParamValue(value);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, string | number | boolean | null>;
  } catch {
    return undefined;
  }
};

export const parseCropResult = (value?: string | string[]): CropResult | undefined => {
  const raw = getParamValue(value);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as CropResult;
    if (!parsed || typeof parsed?.uri !== 'string') {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

export const buildCropReturnParams = (
  returnToParams: string | string[] | undefined,
  cropResult: CropResult,
): Record<string, string | number | boolean | null> => ({
  ...(parseReturnParams(returnToParams) ?? {}),
  [CROP_RESULT_PARAM]: JSON.stringify(cropResult),
});

export const openCropScreen = ({
  sourceUri,
  aspect = 1,
  returnToPath,
  returnToParams,
}: CropLaunchOptions) => {
  router.push({
    pathname: '/crop',
    params: {
      sourceUri,
      aspect: String(aspect),
      returnToPath,
      returnToParams,
    },
  });
};

export const pickImageAndOpenCrop = async ({
  aspect,
  returnToPath,
  returnToParams,
}: Omit<CropLaunchOptions, 'sourceUri'>) => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (!result.canceled && result.assets?.length) {
    const asset = result.assets[0];
    if (asset?.uri) {
      openCropScreen({
        sourceUri: asset.uri,
        aspect,
        returnToPath,
        returnToParams,
      });
    }
  }
};
