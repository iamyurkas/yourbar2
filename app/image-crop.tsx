import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { ImageCropper } from "@/components/ImageCropper";
import { CropShape } from "@/libs/image-crop-utils";

type CropRouteParams = {
  imageUri?: string;
  cropAspectRatio?: string;
  cropShape?: CropShape;
  returnTo?: string;
  resultParam?: string;
};

export default function ImageCropScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CropRouteParams>();

  const imageUri = params.imageUri;
  const cropAspectRatio = params.cropAspectRatio ? Number(params.cropAspectRatio) : 1;
  const cropShape = params.cropShape ?? "rect";

  const resultParam = params.resultParam ?? "croppedUri";

  const normalizedReturnPath = useMemo(() => {
    if (!params.returnTo) {
      return null;
    }

    return params.returnTo.startsWith("/") ? params.returnTo : `/${params.returnTo}`;
  }, [params.returnTo]);

  if (!imageUri) {
    router.back();
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <ImageCropper
        imageUri={imageUri}
        cropAspectRatio={Number.isFinite(cropAspectRatio) && cropAspectRatio > 0 ? cropAspectRatio : 1}
        cropShape={cropShape}
        onCancel={() => router.back()}
        onCropped={(uri) => {
          if (normalizedReturnPath) {
            router.replace({
              pathname: normalizedReturnPath,
              params: {
                [resultParam]: uri,
              },
            });
            return;
          }

          router.back();
        }}
      />
    </>
  );
}
