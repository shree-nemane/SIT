import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';

const { WidgetBridge } = NativeModules;

export interface ProcessedImageResult {
  imageId: string;
  localPath: string;
  width: number;
  height: number;
  fileSize: number;
}

export const imagePipeline = {
  /**
   * Pick an image from gallery or camera
   */
  async pickImage(useCamera: boolean = false): Promise<ProcessedImageResult | null> {
    try {
      if (useCamera && Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Stay in Touch needs camera access to take presence and profile photos.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          // console.warn('[ImagePipeline] Camera permission denied');
          return null;
        }
      }

      const options = {
        mediaType: 'photo' as const,
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.9 as const,
        includeBase64: false,
      };

      const result: ImagePickerResponse = useCamera
        ? await launchCamera(options)
        : await launchImageLibrary(options);

      if (result.didCancel || result.errorCode || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset.uri) return null;

      const imageId = `img_${Date.now()}`;
      return {
        imageId,
        localPath: asset.uri,
        width: asset.width || 1080,
        height: asset.height || 1080,
        fileSize: asset.fileSize || 0,
      };
    } catch (error) {
      // console.error('[ImagePipeline] Failed to pick/process image:', error);
      return null;
    }
  },

  /**
   * Crop, scale, and compress local image file using normalized crop coordinates (0.0 .. 1.0)
   * Preserves original cropped aspect ratio up to maximum dimension (default 1920px).
   */
  async cropAndScaleImage(
    sourceUri: string,
    cropX: number,
    cropY: number,
    cropWidth: number,
    cropHeight: number,
    targetWidth?: number,
    targetHeight?: number,
    sourceWidth: number = 1080,
    sourceHeight: number = 1080
  ): Promise<ProcessedImageResult | null> {
    try {
      const croppedPixelWidth = Math.max(1, Math.round(cropWidth * sourceWidth));
      const croppedPixelHeight = Math.max(1, Math.round(cropHeight * sourceHeight));
      const cropAspectRatio = croppedPixelWidth / croppedPixelHeight;

      let finalWidth = targetWidth || croppedPixelWidth;
      let finalHeight = targetHeight || croppedPixelHeight;

      // If target bounds not specified or for presence (non-square target), apply 1920px max dimension bound while preserving crop aspect ratio
      if (!targetWidth || !targetHeight || targetWidth !== targetHeight) {
        const MAX_DIM = 1920;
        if (croppedPixelWidth > MAX_DIM || croppedPixelHeight > MAX_DIM) {
          if (croppedPixelWidth >= croppedPixelHeight) {
            finalWidth = MAX_DIM;
            finalHeight = Math.round(MAX_DIM / cropAspectRatio);
          } else {
            finalHeight = MAX_DIM;
            finalWidth = Math.round(MAX_DIM * cropAspectRatio);
          }
        } else {
          finalWidth = croppedPixelWidth;
          finalHeight = croppedPixelHeight;
        }
      }

      if (Platform.OS === 'android' && WidgetBridge && WidgetBridge.cropAndResizeImage) {
        const croppedFileUri = await WidgetBridge.cropAndResizeImage(
          sourceUri,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          finalWidth,
          finalHeight
        );

        if (croppedFileUri) {
          const imageId = `img_${Date.now()}`;
          return {
            imageId,
            localPath: croppedFileUri,
            width: finalWidth,
            height: finalHeight,
            fileSize: 150000,
          };
        }
      }

      // Fallback: if native cropper is unattached, return sourceUri with final dimensions
      const imageId = `img_${Date.now()}`;
      return {
        imageId,
        localPath: sourceUri,
        width: finalWidth,
        height: finalHeight,
        fileSize: 200000,
      };
    } catch (error) {
      // console.error('[ImagePipeline] Error cropping image:', error);
      const imageId = `img_${Date.now()}`;
      return {
        imageId,
        localPath: sourceUri,
        width: sourceWidth,
        height: sourceHeight,
        fileSize: 200000,
      };
    }
  },
};

export default imagePipeline;
