import { useMemo } from 'react';
import type { Frame } from 'react-native-vision-camera';
import { runAsync, runAtTargetFps, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

export interface PreCaptureQuality {
  sharpness: number; // 0-1, higher = sharper
  brightness: number; // 0-1, higher = brighter
  isBlurry: boolean;
  isTooDark: boolean;
  isValid: boolean;
}

const BLUR_THRESHOLD = 0.4; // sharpness below this = blurry
const BRIGHTNESS_THRESHOLD = 0.3; // brightness below this = too dark

function analyzeFrameBuffer(
  data: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  pixelFormat: string
): { sharpness: number; brightness: number } {
  'worklet';
  let brightness = 0;
  let pixelCount = 0;

  const step = Math.max(1, Math.floor(Math.min(width, height) / 64));
  const laplacianValues: number[] = [];

  if (pixelFormat === 'rgb') {
    const bytesPerPixel = Math.max(3, Math.floor(bytesPerRow / width));
    const offsetY = Math.floor(height * 0.25);
    const endY = Math.floor(height * 0.75);
    const offsetX = Math.floor(width * 0.25);
    const endX = Math.floor(width * 0.75);

    for (let y = offsetY; y < endY; y += step) {
      for (let x = offsetX; x < endX; x += step) {
        const idx = Math.floor(y * bytesPerRow + x * bytesPerPixel);
        const r = data[idx] ?? 0;
        const g = data[idx + 1] ?? 0;
        const b = data[idx + 2] ?? 0;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        brightness += lum;
        pixelCount++;

        if (y > offsetY && y < endY - step && x > offsetX && x < endX - step) {
          const centerIdx = Math.floor(y * bytesPerRow + x * bytesPerPixel);
          const topIdx = Math.floor((y - step) * bytesPerRow + x * bytesPerPixel);
          const bottomIdx = Math.floor((y + step) * bytesPerRow + x * bytesPerPixel);
          const leftIdx = Math.floor(y * bytesPerRow + (x - step) * bytesPerPixel);
          const rightIdx = Math.floor(y * bytesPerRow + (x + step) * bytesPerPixel);

          const centerLum =
            (0.299 * (data[centerIdx] ?? 0) +
              0.587 * (data[centerIdx + 1] ?? 0) +
              0.114 * (data[centerIdx + 2] ?? 0)) /
            255;
          const topLum =
            (0.299 * (data[topIdx] ?? 0) +
              0.587 * (data[topIdx + 1] ?? 0) +
              0.114 * (data[topIdx + 2] ?? 0)) /
            255;
          const bottomLum =
            (0.299 * (data[bottomIdx] ?? 0) +
              0.587 * (data[bottomIdx + 1] ?? 0) +
              0.114 * (data[bottomIdx + 2] ?? 0)) /
            255;
          const leftLum =
            (0.299 * (data[leftIdx] ?? 0) +
              0.587 * (data[leftIdx + 1] ?? 0) +
              0.114 * (data[leftIdx + 2] ?? 0)) /
            255;
          const rightLum =
            (0.299 * (data[rightIdx] ?? 0) +
              0.587 * (data[rightIdx + 1] ?? 0) +
              0.114 * (data[rightIdx + 2] ?? 0)) /
            255;

          const lap = 4 * centerLum - topLum - bottomLum - leftLum - rightLum;
          laplacianValues.push(lap * lap);
        }
      }
    }
  } else {
    const yPlaneSize = width * height;
    const offsetY = Math.floor(height * 0.25);
    const endY = Math.floor(height * 0.75);
    const offsetX = Math.floor(width * 0.25);
    const endX = Math.floor(width * 0.75);

    for (let y = offsetY; y < endY; y += step) {
      for (let x = offsetX; x < endX; x += step) {
        const idx = y * width + x;
        if (idx < yPlaneSize) {
          const yVal = (data[idx] ?? 0) / 255;
          brightness += yVal;
          pixelCount++;

          if (y > offsetY && y < endY - step && x > offsetX && x < endX - step) {
            const center = (data[y * width + x] ?? 0) / 255;
            const top = (data[(y - step) * width + x] ?? 0) / 255;
            const bottom = (data[(y + step) * width + x] ?? 0) / 255;
            const left = (data[y * width + (x - step)] ?? 0) / 255;
            const right = (data[y * width + (x + step)] ?? 0) / 255;
            const lap = 4 * center - top - bottom - left - right;
            laplacianValues.push(lap * lap);
          }
        }
      }
    }
  }

  const avgBrightness = pixelCount > 0 ? brightness / pixelCount : 0;
  let sharpness = 0.5;
  if (laplacianValues.length > 0) {
    const sum = laplacianValues.reduce((a, b) => a + b, 0);
    const mean = sum / laplacianValues.length;
    const variance =
      laplacianValues.reduce((a, b) => a + (b - mean) * (b - mean), 0) / laplacianValues.length;
    sharpness = Math.min(1, Math.max(0, variance * 500));
  }

  return { sharpness, brightness: avgBrightness };
}

export function useImageQualityFrameProcessor(
  onQualityUpdate: (quality: PreCaptureQuality) => void
) {
  const onQualityUpdateWorklet = useMemo(
    () => Worklets.createRunOnJS(onQualityUpdate),
    [onQualityUpdate]
  );

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      runAtTargetFps(2, () => {
        'worklet';
        runAsync(frame, () => {
          'worklet';
          if (!frame.isValid) {
            return;
          }
          try {
            const buffer = frame.toArrayBuffer();
            const data = new Uint8Array(buffer);
            const { sharpness, brightness } = analyzeFrameBuffer(
              data,
              frame.width,
              frame.height,
              frame.bytesPerRow,
              frame.pixelFormat
            );

            const isBlurry = sharpness < BLUR_THRESHOLD;
            const isTooDark = brightness < BRIGHTNESS_THRESHOLD;
            const isValid = !isBlurry && !isTooDark;

            onQualityUpdateWorklet({
              sharpness,
              brightness,
              isBlurry,
              isTooDark,
              isValid,
            });
          } catch {
            onQualityUpdateWorklet({
              sharpness: 0.5,
              brightness: 0.5,
              isBlurry: false,
              isTooDark: false,
              isValid: true,
            });
          }
        });
      });
    },
    [onQualityUpdateWorklet]
  );

  return frameProcessor;
}
