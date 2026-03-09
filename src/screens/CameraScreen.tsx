import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
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
import { analyzeImageQuality } from '../services/sightengineService';
import type { CameraCapturedPicture } from 'expo-camera';
import type { ImageQualityAnalysis } from '../types';

type CameraFacing = 'front' | 'back';

function getClassificationColor(classification: ImageQualityAnalysis['classification']): string {
  switch (classification) {
    case 'High':
      return '#22c55e';
    case 'Medium':
      return '#eab308';
    case 'Low':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImageQualityAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>Camera permission is required to capture photos.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }
    setIsCapturing(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
      });
      if (photo) {
        setCapturedPhoto(photo);
        setAnalysis(null);
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
    setAnalysis(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!capturedPhoto?.uri) {
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeImageQuality(capturedPhoto.uri);
      setAnalysis(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze image';
      setError(message);
      Alert.alert('Analysis Error', message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSwitchCamera = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const isCameraAvailable = Platform.OS === 'web' ? true : true;

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
          <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
        </View>

        {isAnalyzing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>Analyzing image quality...</Text>
          </View>
        )}

        {analysis && !isAnalyzing && (
          <View style={[styles.resultsCard, { borderColor: getClassificationColor(analysis.classification) }]}>
            <Text style={[styles.classificationText, { color: getClassificationColor(analysis.classification) }]}>
              Quality: {analysis.classification}
            </Text>
            <Text style={styles.metricText}>Score: {(analysis.qualityScore * 100).toFixed(0)}%</Text>
            <Text style={styles.metricText}>Sharpness: {(analysis.sharpness * 100).toFixed(0)}%</Text>
            <Text style={styles.metricText}>Brightness: {(analysis.brightness * 100).toFixed(0)}%</Text>
            {analysis.isBlurry && <Text style={styles.warningText}>Image is blurry</Text>}
            {analysis.isTooDark && <Text style={styles.warningText}>Image is too dark</Text>}
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={handleRetake} disabled={isAnalyzing}>
            <Text style={styles.actionButtonText}>Retake</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.confirmButton]}
            onPress={handleConfirm}
            disabled={isAnalyzing}
          >
            <Text style={styles.actionButtonText}>
              {analysis ? 'Analyze Again' : 'Analyze Quality'}
            </Text>
          </Pressable>
        </View>

        {analysis?.classification === 'Low' && (
          <Pressable style={styles.retakeSuggestion} onPress={handleRetake}>
            <Text style={styles.retakeSuggestionText}>Quality is low - consider retaking the photo</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.cameraOverlay}>
          <Pressable style={styles.switchButton} onPress={handleSwitchCamera}>
            <Text style={styles.switchButtonText}>Switch</Text>
          </Pressable>
        </View>
      </CameraView>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.captureRow}>
        <Pressable
          style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          onPress={handleCapture}
          disabled={isCapturing}
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
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  resultsCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 2,
  },
  classificationText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  metricText: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 4,
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
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
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retakeSuggestion: {
    padding: 16,
    alignItems: 'center',
  },
  retakeSuggestionText: {
    color: '#f59e0b',
    fontSize: 14,
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
