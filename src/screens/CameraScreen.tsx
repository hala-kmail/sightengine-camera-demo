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
      <View style={styles.center}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <Pressable style={styles.button} onPress={requestCameraPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>No camera device</Text>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: `file://${capturedPhoto.path}` }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
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
      {/* Pre-capture quality overlay */}
      {preCaptureQuality && (
        <View style={styles.qualityOverlay}>
          <Text style={styles.qualityText}>
            Sharpness: {(preCaptureQuality.sharpness * 100).toFixed(0)}%
          </Text>
          <Text style={styles.qualityText}>
            Brightness: {(preCaptureQuality.brightness * 100).toFixed(0)}%
          </Text>
          {preCaptureQuality.isBlurry && (
            <Text style={[styles.qualityText, styles.warning]}>Image is blurry</Text>
          )}
          {preCaptureQuality.isTooDark && (
            <Text style={[styles.qualityText, styles.warning]}>Image is too dark</Text>
          )}
          {preCaptureQuality.isValid && (
            <Text style={[styles.qualityText, styles.ok]}>Ready to capture</Text>
          )}
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <View style={styles.controls}>
        <Pressable
          style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          onPress={takePhoto}
          disabled={isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </Pressable>
        <Pressable
          style={styles.flipButton}
          onPress={() => {
            setFacing((f) => (f === 'back' ? 'front' : 'back'));
          }}
        >
          <Text style={styles.flipButtonText}>Flip camera</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 24,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
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
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 24,
  },
  qualityOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
  },
  qualityText: {
    color: '#fff',
    fontSize: 14,
  },
  warning: {
    color: '#fbbf24',
  },
  ok: {
    color: '#22c55e',
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(239,68,68,0.9)',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  flipButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});
