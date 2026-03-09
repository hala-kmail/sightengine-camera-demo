/**
 * CameraScreen - PREVIOUS IMPLEMENTATION (commented out)
 *
 * This file previously used:
 * - react-native-vision-camera for live camera preview
 * - useImageQualityFrameProcessor for real-time sharpness/brightness checks (on-device, no API)
 *
 * REPLACED BY: ImageQualityAnalyzerScreen
 * - Uses expo-image-picker for capture/select
 * - Sends to backend API (POST /api/analyze) for post-capture analysis
 * - Displays sharpness, brightness, contrast, noise in test UI
 *
 * To restore the Vision Camera flow, swap the import in App.tsx back to CameraScreen.
 */

/*
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from 'react-native-vision-camera';
import { useImageQualityFrameProcessor } from '../hooks/useImageQualityFrameProcessor';
import type { PreCaptureQuality } from '../hooks/useImageQualityFrameProcessor';
import type { PhotoFile } from 'react-native-vision-camera';

type CameraFacing = 'front' | 'back';

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [capturedPhoto, setCapturedPhoto] = useState<PhotoFile | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preCaptureQuality, setPreCaptureQuality] = useState<PreCaptureQuality | null>(null);

  const device = useCameraDevice(facing);
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    { fps: 30 },
  ]);

  const onQualityUpdate = useCallback((quality: PreCaptureQuality) => {
    setPreCaptureQuality(quality);
  }, []);

  const frameProcessor = useImageQualityFrameProcessor(onQualityUpdate);
  const cameraRef = useRef<Camera>(null);

  // ... rest of component (permission UI, capture, preview, etc.)
}
*/

// Placeholder export - use ImageQualityAnalyzerScreen in App.tsx instead
export { default } from './ImageQualityAnalyzerScreen';
