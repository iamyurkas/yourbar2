import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

type PickPhotoSource = "camera" | "library";

type IOSCropPickerModule = {
  openCamera: (options: Record<string, unknown>) => Promise<{ path?: string }>;
  openPicker: (options: Record<string, unknown>) => Promise<{ path?: string }>;
};

function isPickerCancelError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  return (
    code.toUpperCase().includes("CANCEL") ||
    message.toUpperCase().includes("CANCEL")
  );
}

async function pickWithIosCropper(source: PickPhotoSource): Promise<string | null> {
  let cropPicker: IOSCropPickerModule;
  try {
    cropPicker = require("react-native-image-crop-picker") as IOSCropPickerModule;
  } catch (error) {
    console.warn("iOS cropper is unavailable, using expo-image-picker fallback", error);
    return null;
  }

  const options = {
    cropping: true,
    freeStyleCropEnabled: true,
    mediaType: "photo",
    compressImageQuality: 1,
  } satisfies Record<string, unknown>;

  try {
    const image =
      source === "camera"
        ? await cropPicker.openCamera(options)
        : await cropPicker.openPicker(options);
    return image?.path ?? null;
  } catch (error) {
    if (isPickerCancelError(error)) {
      return null;
    }
    throw error;
  }
}

export async function pickPhotoWithCrop(source: PickPhotoSource): Promise<string | null> {
  if (Platform.OS === "ios") {
    const iosCroppedUri = await pickWithIosCropper(source);
    if (iosCroppedUri) {
      return iosCroppedUri;
    }
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
        exif: false,
      })
      : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
        exif: false,
      });

  if (!result.canceled && result.assets?.length) {
    return result.assets[0]?.uri ?? null;
  }

  return null;
}
