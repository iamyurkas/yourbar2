declare module "expo-image-manipulator" {
  export enum SaveFormat {
    JPEG = "jpeg",
    PNG = "png",
    WEBP = "webp",
  }

  export type Action =
    | {
        crop: {
          originX: number;
          originY: number;
          width: number;
          height: number;
        };
      }
    | {
        resize: {
          width?: number;
          height?: number;
        };
      }
    | {
        rotate: number;
      }
    | {
        flip: "vertical" | "horizontal";
      };

  export type SaveOptions = {
    compress?: number;
    format?: SaveFormat;
    base64?: boolean;
  };

  export type ManipulateResult = {
    uri: string;
    width: number;
    height: number;
    base64?: string;
  };

  export function manipulateAsync(
    uri: string,
    actions?: Action[],
    saveOptions?: SaveOptions,
  ): Promise<ManipulateResult>;
}
