import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

type PickPhotoSource = "camera" | "library";

type IOSCropPickerModule = {
  openCamera: (options: Record<string, unknown>) => Promise<{ path?: string }>;
  openPicker: (options: Record<string, unknown>) => Promise<{ path?: string }>;
};

function resolveIosCropPickerModule(): IOSCropPickerModule | null {
  try {
    const loadedModule = require("react-native-image-crop-picker") as
      | IOSCropPickerModule
      | { default?: IOSCropPickerModule | null }
      | null;
    const cropPicker = (loadedModule &&
      typeof loadedModule === "object" &&
      "default" in loadedModule
      ? loadedModule.default
      : loadedModule) as IOSCropPickerModule | null | undefined;

    if (
      !cropPicker ||
      typeof cropPicker.openCamera !== "function" ||
      typeof cropPicker.openPicker !== "function"
    ) {
      return null;
    }

    return cropPicker;
  } catch (error) {
    console.warn("iOS cropper module loading failed, using expo-image-picker fallback", error);
    return null;
  }
}

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

function isUnavailableCropperError(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  const message = String(error.message ?? "").toLowerCase();
  return (
    message.includes("cannot read property") ||
    message.includes("cannot convert null value to object") ||
    message.includes("native module") ||
    message.includes("openpicker") ||
    message.includes("opencamera")
  );
}

async function pickWithIosCropper(source: PickPhotoSource): Promise<string | null> {
  const cropPicker = resolveIosCropPickerModule();
  if (!cropPicker) {
    console.warn("iOS cropper is unavailable, using expo-image-picker fallback");
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
    if (isUnavailableCropperError(error)) {
      console.warn("iOS cropper runtime is unavailable, using expo-image-picker fallback", error);
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
