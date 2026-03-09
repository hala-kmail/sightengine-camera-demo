import { env } from '../../config/env';
import type { ImageQualityAnalysis, QualityClassification, SightengineQualityResponse } from '../types';

const SIGHTENGINE_API_URL = 'https://api.sightengine.com/1.0/check.json';

function getClassification(qualityScore: number): QualityClassification {
  if (qualityScore < 0.4) {
    return 'Low';
  }
  if (qualityScore < 0.7) {
    return 'Medium';
  }
  return 'High';
}

function parseResponse(data: SightengineQualityResponse): ImageQualityAnalysis {
  const qualityScore = data.quality?.score ?? 0;
  const sharpness = data.sharpness ?? 0;
  const brightness = data.brightness ?? 0;

  return {
    qualityScore,
    sharpness,
    brightness,
    classification: getClassification(qualityScore),
    isBlurry: sharpness < 0.4,
    isTooDark: brightness < 0.3,
  };
}

async function getMediaForUpload(uri: string): Promise<{ blob: Blob; filename: string } | { uri: string; type: string; name: string }> {
  if (uri.startsWith('data:')) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return { blob, filename: 'photo.jpg' };
  }
  return {
    uri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as { uri: string; type: string; name: string };
}

export async function analyzeImageQuality(uri: string): Promise<ImageQualityAnalysis> {
  const apiUser = env.sightengineApiUser;
  const apiSecret = env.sightengineApiSecret;

  if (!apiUser || !apiSecret) {
    throw new Error('Sightengine API credentials are not configured. Set EXPO_PUBLIC_SIGHTENGINE_API_USER and EXPO_PUBLIC_SIGHTENGINE_API_SECRET in .env');
  }

  const media = await getMediaForUpload(uri);

  const formData = new FormData();
  if ('blob' in media) {
    formData.append('media', media.blob, media.filename);
  } else {
    formData.append('media', media as unknown as Blob);
  }
  formData.append('models', 'quality,properties');
  formData.append('api_user', apiUser);
  formData.append('api_secret', apiSecret);

  const response = await fetch(SIGHTENGINE_API_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sightengine API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as SightengineQualityResponse;

  if (data.status !== 'success') {
    throw new Error('Sightengine API returned an error');
  }

  return parseResponse(data);
}
