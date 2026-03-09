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

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>Camera permission is required to capture photos.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>No camera device available</Text>
      </View>
    );
  }

  const handleCapture = async () => {
    if (isCapturing) {
      return;
    }
    if (preCaptureQuality && !preCaptureQuality.isValid) {
      return;
    }
    setIsCapturing(true);
    setError(null);
    try {
      const photo = await cameraRef.current?.takePhoto({
        flash: 'off',
      });
      if (photo) {
        setCapturedPhoto(photo);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to capture photo';
      setError(message);
      Alert.alert('Capture Error', message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setError(null);
  };

  const handleSwitchCamera = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const isCameraAvailable = Platform.OS !== 'web';

  if (!isCameraAvailable && Platform.OS === 'web') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>
          Camera is not available in this browser. Please use a device with a camera or try a
          different browser.
        </Text>
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

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={handleRetake}>
            <Text style={styles.actionButtonText}>Retake</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canCapture = preCaptureQuality?.isValid ?? true;
  const warningMessages: string[] = [];
  if (preCaptureQuality?.isBlurry) {
    warningMessages.push('Image is too blurry');
  }
  if (preCaptureQuality?.isTooDark) {
    warningMessages.push('Image is too dark');
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        format={format}
        pixelFormat="rgb"
        photo={true}
        frameProcessor={frameProcessor}
        ref={cameraRef}
      />
      <View style={styles.cameraOverlay}>
        <Pressable style={styles.switchButton} onPress={handleSwitchCamera}>
          <Text style={styles.switchButtonText}>Switch</Text>
        </Pressable>
      </View>

      {/* مؤشر أن الفحص يعمل بمكتبة Vision Camera (بدون API) */}
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
          onPress={handleCapture}
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
  actionsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    justifyContent: 'center',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
});
