/**
 * Post-Capture Image Quality Analyzer Screen
 *
 * Self-contained component that:
 * - Captures/selects image via expo-image-picker
 * - Sends to backend API (POST /api/analyze) for analysis
 * - Displays analysis results in a test preview UI
 *
 * Replaces the previous Vision Camera + Frame Processor flow.
 * Easy to remove or integrate with main camera workflow later.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// ---------------------------------------------------------------------------
// API Configuration - Update for physical device testing
// ---------------------------------------------------------------------------
// Set to your machine's IP (e.g. 'http://192.168.1.100:3000') when testing on physical device.
// Leave undefined to use defaults: localhost (iOS sim), 10.0.2.2 (Android emulator).
const API_BASE_OVERRIDE: string | undefined = undefined;

const getApiBaseUrl = () => {
  if (API_BASE_OVERRIDE) {
    return API_BASE_OVERRIDE;
  }
  if (__DEV__ && Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
};

const API_ANALYZE_URL = `${getApiBaseUrl()}/api/analyze`;

// ---------------------------------------------------------------------------
// Types (matches backend response)
// ---------------------------------------------------------------------------
interface Evaluation {
  quality_rating: 'good' | 'acceptable' | 'poor';
  issues: string[];
  message_ar: string;
  message_en: string;
}

interface AnalysisResult {
  sharpness: {
    score: number;
    laplacian_variance: number;
    interpretation: string;
  };
  brightness: {
    score: number;
    exposure_status: string;
    interpretation: string;
  };
  contrast: {
    score: number;
    std_deviation: number;
    interpretation: string;
  };
  noise: {
    score: number;
    interpretation: string;
  };
  evaluation?: Evaluation;
}

const ISSUE_LABELS_AR: Record<string, string> = {
  blurry: 'الصورة غير واضحة (ضبابية)',
  too_dark: 'الصورة مظلمة',
  overexposed: 'الصورة فاتحة جداً',
  low_contrast: 'تباين منخفض',
  noisy: 'تشويش/ضجيج في الصورة',
};

function getQualityDisplay(analysis: AnalysisResult): {
  rating: string;
  ratingColor: string;
  message: string;
  issues: string[];
} {
  const ev = analysis.evaluation;
  if (ev) {
    const ratingAr = { good: 'جودة جيدة', acceptable: 'جودة مقبولة', poor: 'الجودة تحتاج تحسين' };
    const colors = { good: '#22c55e', acceptable: '#eab308', poor: '#ef4444' };
    const issuesAr = (ev.issues || []).map((i) => ISSUE_LABELS_AR[i] || i);
    return {
      rating: ratingAr[ev.quality_rating] || ev.quality_rating,
      ratingColor: colors[ev.quality_rating] || '#9ca3af',
      message: ev.message_ar || ev.message_en,
      issues: issuesAr,
    };
  }
  return {
    rating: '—',
    ratingColor: '#9ca3af',
    message: 'لا توجد رسالة تقييم من الخادم.',
    issues: [],
  };
}

// ---------------------------------------------------------------------------
// API: Send image to backend for analysis
// ---------------------------------------------------------------------------
async function analyzeImage(uri: string): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('image', {
    uri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as unknown as Blob);

  const response = await fetch(API_ANALYZE_URL, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type - fetch sets multipart/form-data with boundary
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Analysis failed');
  }

  return data.analysis;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ImageQualityAnalyzerScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCaptureOrSelect = useCallback(async () => {
    Alert.alert(
      'Capture / Select Image',
      'Choose how to get the image',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 1,
            });
            if (!result.canceled) {
              await processImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Gallery permission is needed to select images.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 1,
            });
            if (!result.canceled) {
              await processImage(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, []);

  const processImage = async (uri: string) => {
    setImageUri(uri);
    setAnalysis(null);
    setError(null);
    setIsLoading(true);

    try {
      const result = await analyzeImage(uri);
      setAnalysis(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      Alert.alert('Analysis Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = useCallback(() => {
    setImageUri(null);
    setAnalysis(null);
    setError(null);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Capture / Select Button */}
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          onPress={handleCaptureOrSelect}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Capture / Select Image</Text>
          )}
        </Pressable>

        {/* Image Preview */}
        {imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          </View>
        )}

        {/* Quality assessment message + issues (from backend) */}
        {analysis && (() => {
          const { rating, ratingColor, message, issues } = getQualityDisplay(analysis);
          return (
            <View style={[styles.assessmentCard, { borderColor: ratingColor }]}>
              <Text style={styles.assessmentLabel}>تقييم الجودة</Text>
              <Text style={[styles.assessmentRating, { color: ratingColor }]}>{rating}</Text>
              <Text style={styles.assessmentMessage}>{message}</Text>
              {issues.length > 0 ? (
                <>
                  <Text style={styles.assessmentIssuesLabel}>ما يحتاج تحسين:</Text>
                  <View style={styles.issuesList}>
                    {issues.map((issue, i) => (
                      <Text key={i} style={styles.issueItem}>
                        • {issue}
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          );
        })()}

        {/* Analysis Results Card */}
        {analysis && (
          <View style={styles.metricsCard}>
            <Text style={styles.metricsCardTitle}>Analysis Results</Text>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Sharpness</Text>
              <Text style={styles.metricValue}>
                {analysis.sharpness.score.toFixed(2)} (Laplacian: {analysis.sharpness.laplacian_variance.toFixed(2)})
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Brightness</Text>
              <Text style={styles.metricValue}>
                {analysis.brightness.score.toFixed(2)} (Exposure: {analysis.brightness.exposure_status.replace('_', ' ')})
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Contrast</Text>
              <Text style={styles.metricValue}>
                {analysis.contrast.score.toFixed(2)} (Std: {analysis.contrast.std_deviation.toFixed(2)})
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Noise</Text>
              <Text style={styles.metricValue}>{analysis.noise.score.toFixed(2)}</Text>
            </View>

            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
          </View>
        )}

        {/* Error display */}
        {error && !analysis && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Hint for physical device */}
        <Text style={styles.hint}>
          {Platform.OS === 'android'
            ? 'API: 10.0.2.2:3000 (emulator)'
            : 'API: localhost:3000 (simulator)'}
          {' • '}
          Physical device: set API_BASE_OVERRIDE in this file.
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  previewContainer: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    minHeight: 200,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  assessmentCard: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  assessmentLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  assessmentRating: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  assessmentMessage: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'right',
  },
  assessmentIssuesLabel: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  issuesList: {
    gap: 4,
  },
  issueItem: {
    color: '#f59e0b',
    fontSize: 14,
  },
  metricsCard: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  metricsCardTitle: {
    color: '#93c5fd',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  metricLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  metricValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  hint: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
  },
});
