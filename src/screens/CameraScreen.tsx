/**
 * CameraScreen - Vision Camera + Frame Processor
 *
 * - react-native-vision-camera for live camera preview
 * - useImageQualityFrameProcessor for real-time sharpness/brightness checks (on-device, no API)
 */

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

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || !device) {
      return;
    }
    try {
      setIsCapturing(true);
      setError(null);
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: Platform.OS === 'android',
      });
      setCapturedPhoto(photo);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      Alert.alert('Capture Error', msg);
    } finally {
      setIsCapturing(false);
    }
  }, [device]);

  const requestCameraPermission = useCallback(async () => {
    const result = await requestPermission();
    if (!result) {
      Alert.alert(
        'Camera Permission',
        'Camera permission is required to use the app.'
      );
    }
  }, [requestPermission]);

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>Camera permission is required to capture photos.</Text>
        <Pressable style={styles.button} onPress={requestCameraPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>No camera device available</Text>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: `file://${capturedPhoto.path}` }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.overlay}>
          <Pressable
            style={styles.button}
            onPress={() => {
              setCapturedPhoto(null);
            }}
          >
            <Text style={styles.buttonText}>Take another photo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const warningMessages: string[] = [];
  if (preCaptureQuality?.isBlurry) {
    warningMessages.push('Image is too blurry');
  }
  if (preCaptureQuality?.isTooDark) {
    warningMessages.push('Image is too dark');
  }
  const canCapture = preCaptureQuality?.isValid ?? true;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={true}
        photo={true}
        frameProcessor={frameProcessor}
      />
      <View style={styles.cameraOverlay}>
        <Pressable
          style={styles.switchButton}
          onPress={() => {
            setFacing((f) => (f === 'back' ? 'front' : 'back'));
          }}
        >
          <Text style={styles.switchButtonText}>Switch</Text>
        </Pressable>
      </View>

      <View style={styles.frameProcessorBadge}>
        <Text style={styles.frameProcessorBadgeTitle}>Real-time check (Vision Camera)</Text>
        {preCaptureQuality != null ? (
          <>
            <Text style={styles.frameProcessorBadgeStatus}>
              {preCaptureQuality.isValid ? '✓ Ready to capture' : warningMessages.join(' • ')}
            </Text>
            <Text style={styles.frameProcessorBadgeValues}>
              Sharpness: {(preCaptureQuality.sharpness * 100).toFixed(0)}% • Brightness: {(preCaptureQuality.brightness * 100).toFixed(0)}%
            </Text>
          </>
        ) : (
          <Text style={styles.frameProcessorBadgeStatus}>Analyzing...</Text>
        )}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.captureRow}>
        <Pressable
          style={[
            styles.captureButton,
            (isCapturing || !canCapture) && styles.captureButtonDisabled,
          ]}
          onPress={takePhoto}
          disabled={isCapturing || !canCapture}
        >
          {isCapturing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 20,
  },
  switchButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  frameProcessorBadge: {
    position: 'absolute',
    top: 46,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
  },
  frameProcessorBadgeTitle: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  frameProcessorBadgeStatus: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  frameProcessorBadgeValues: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  captureRow: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    padding: 24,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
});
