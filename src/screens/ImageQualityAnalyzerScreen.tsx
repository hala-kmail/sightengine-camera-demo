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
import * as ImageManipulator from 'expo-image-manipulator';

// ---------------------------------------------------------------------------
// API Configuration
// ---------------------------------------------------------------------------
// If you see "Network request failed" on a physical device: the phone cannot
// reach "localhost" (that's the phone itself). Set API_BASE_OVERRIDE below to
// your computer's IP on the same Wi‑Fi (e.g. 'http://192.168.1.100:3000').
// Production: use your backend URL (e.g. 'https://api.example.com').
const API_BASE_OVERRIDE: string | undefined = 'https://b08c-62-16-73-106.ngrok-free.app';
const getApiBaseUrl = () => {
  if (API_BASE_OVERRIDE) {
    return API_BASE_OVERRIDE;
  }
  if (__DEV__ && Platform.OS === 'android') {
    return 'https://b08c-62-16-73-106.ngrok-free.app';
  }
  return 'https://b08c-62-16-73-106.ngrok-free.app';
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
    interpretation?: string;
  };
  brightness: {
    score: number;
    exposure_status: string;
    interpretation?: string;
  };
  contrast: {
    score: number;
    std_deviation: number;
    interpretation?: string;
  };
  noise: {
    score: number;
    interpretation?: string;
  };
  evaluation?: Evaluation;
}

const RATING_COLORS: Record<string, string> = {
  good: '#22c55e',
  acceptable: '#eab308',
  poor: '#ef4444',
};

const RATING_LABELS_EN: Record<string, string> = {
  good: 'Good',
  acceptable: 'Acceptable',
  poor: 'Needs improvement',
};

const RATING_LABELS_AR: Record<string, string> = {
  good: 'جودة جيدة',
  acceptable: 'جودة مقبولة',
  poor: 'الجودة تحتاج تحسين',
};

const ISSUE_LABELS_EN: Record<string, string> = {
  blurry: 'Blurry',
  too_dark: 'Too dark',
  overexposed: 'Overexposed',
  low_contrast: 'Low contrast',
  noisy: 'Noisy',
};

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
  messageEn: string;
  messageAr: string | null;
  issuesEn: string[];
  issuesAr: string[];
} {
  const ev = analysis.evaluation;
  if (ev) {
    const colors = RATING_COLORS;
    const issues = ev.issues || [];
    return {
      rating: RATING_LABELS_EN[ev.quality_rating] || ev.quality_rating,
      ratingColor: colors[ev.quality_rating] || '#9ca3af',
      messageEn: ev.message_en || ev.message_ar || 'No evaluation message.',
      messageAr: ev.message_ar || null,
      issuesEn: issues.map((i) => ISSUE_LABELS_EN[i] || i),
      issuesAr: issues.map((i) => ISSUE_LABELS_AR[i] || i),
    };
  }
  return {
    rating: '—',
    ratingColor: '#9ca3af',
    messageEn: 'No evaluation from server.',
    messageAr: null,
    issuesEn: [],
    issuesAr: [],
  };
}

// ---------------------------------------------------------------------------
// Connection test — quick GET to see if the phone can reach the server
// ---------------------------------------------------------------------------
async function testConnection(): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  const baseUrl = getApiBaseUrl();
  const start = Date.now();
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000); // 10s max for test
    const res = await fetch(baseUrl, { method: 'GET', signal: controller.signal });
    const durationMs = Date.now() - start;
    console.log('[ConnectionTest] GET', baseUrl, { status: res.status, durationMs });
    return { ok: true, durationMs };
  } catch (e) {
    const durationMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    const isAbort = msg === 'Aborted' || (e instanceof Error && e.name === 'AbortError');
    const friendlyError = isAbort
      ? `No response in ${durationMs / 1000}s (server unreachable from this device)`
      : msg;
    console.error('[ConnectionTest] FAILED', { baseUrl, durationMs, error: friendlyError });
    return { ok: false, durationMs, error: friendlyError };
  }
}

// ---------------------------------------------------------------------------
// API: Send image to backend for analysis
// ---------------------------------------------------------------------------
async function analyzeImage(uri: string): Promise<AnalysisResult> {
  const startTime = Date.now();
  console.log('[Analyze] START', {
    url: API_ANALYZE_URL,
    imageUri: uri?.substring?.(0, 60) + (uri?.length > 60 ? '...' : ''),
  });

  const formData = new FormData();
  formData.append('image', {
    uri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as unknown as Blob);

  // Long timeout: upload + server analysis can take 2–3 minutes for large images
  const REQUEST_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(API_ANALYZE_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const fetchDuration = Date.now() - startTime;
    console.log('[Analyze] FETCH done', {
      status: response.status,
      statusText: response.statusText,
      durationMs: fetchDuration,
      ok: response.ok,
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const msg =
      networkErr instanceof Error ? networkErr.message : 'Network error';
    const isTimeout =
      networkErr instanceof Error && networkErr.name === 'AbortError';
    console.error('[Analyze] NETWORK ERROR', {
      durationMs,
      message: msg,
      isTimeout,
      error: networkErr,
    });
    throw new Error(
      isTimeout
        ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. The server may be slow or the image too large. Try a smaller image.`
        : `Cannot reach server (${msg}). Is the backend running at ${API_ANALYZE_URL}? On a physical device, set API_BASE_OVERRIDE in this file.`
    );
  }

  let rawText: string;
  try {
    rawText = await response.text();
  } catch (e) {
    console.error('[Analyze] Failed to read response body', e);
    throw new Error('Failed to read response from server.');
  }

  let data: { success?: boolean; error?: string; analysis?: AnalysisResult; filename?: string };
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error('[Analyze] Response is not JSON', {
      status: response.status,
      bodyPreview: rawText?.substring(0, 200),
    });
    throw new Error(
      response.ok
        ? 'Invalid response from server (not JSON).'
        : `Server error ${response.status}: ${rawText || response.statusText}`
    );
  }

  const totalDuration = Date.now() - startTime;
  console.log('[Analyze] RESPONSE', {
    success: data.success,
    filename: data.filename,
    error: data.error,
    hasAnalysis: !!data.analysis,
    totalDurationMs: totalDuration,
    fullResponse: data,
  });

  if (!response.ok) {
    console.error('[Analyze] HTTP error', response.status, data?.error);
    throw new Error(
      data?.error || `Server error ${response.status}: ${response.statusText}`
    );
  }

  if (!data.success || !data.analysis) {
    console.error('[Analyze] API returned failure', data?.error);
    throw new Error(data?.error || 'Analysis failed');
  }

  console.log('[Analyze] SUCCESS', {
    quality_rating: data.analysis?.evaluation?.quality_rating,
    message_en: data.analysis?.evaluation?.message_en,
    issues: data.analysis?.evaluation?.issues,
  });
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
    console.log('[ProcessImage] START', { uri: uri?.substring?.(0, 80) });
    setImageUri(uri);
    setAnalysis(null);
    setError(null);
    setIsLoading(true);

    try {
      // Resize & compress before upload — mobile camera images are huge (4–12 MB),
      // causing timeout. Web uses smaller images. 1280px + 0.8 compress = fast upload.
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      console.log('[ProcessImage] Resized for upload', {
        original: uri?.substring?.(0, 50),
        newUri: manipulated.uri?.substring?.(0, 50),
      });
      // Quick connection test — if GET fails, phone likely can't reach server (firewall, AP isolation)
      const conn = await testConnection();
      if (!conn.ok) {
        throw new Error(
          `Cannot reach server: ${conn.error}. Fix: Run "ngrok http 3000" on your PC, then set API_BASE_OVERRIDE to the ngrok URL (e.g. https://xxxx.ngrok-free.app).`
        );
      }
      const result = await analyzeImage(manipulated.uri);
      console.log('[ProcessImage] SUCCESS', { hasResult: !!result });
      setAnalysis(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ProcessImage] ERROR', { message, err });
      setError(message);
      Alert.alert('Analysis Error', message);
    } finally {
      setIsLoading(false);
      console.log('[ProcessImage] DONE (loading off)');
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

        {/* Quality assessment: primary English message + optional Arabic */}
        {analysis && (() => {
          const { rating, ratingColor, messageEn, messageAr, issuesEn } = getQualityDisplay(analysis);
          return (
            <View style={[styles.assessmentCard, { borderColor: ratingColor }]}>
              <Text style={styles.assessmentLabel}>Quality</Text>
              <Text style={[styles.assessmentRating, { color: ratingColor }]}>{rating}</Text>
              <Text style={styles.assessmentMessage}>{messageEn}</Text>
              {messageAr ? (
                <Text style={styles.assessmentMessageAr}>{messageAr}</Text>
              ) : null}
              {issuesEn.length > 0 ? (
                <>
                  <Text style={styles.assessmentIssuesLabel}>Issues:</Text>
                  <View style={styles.issuesList}>
                    {issuesEn.map((issue, i) => (
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
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  assessmentMessageAr: {
    color: '#9ca3af',
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
