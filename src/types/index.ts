export type QualityClassification = 'High' | 'Medium' | 'Low';

export interface SightengineQualityResponse {
  status: string;
  quality?: {
    score: number;
  };
  sharpness?: number;
  brightness?: number;
  contrast?: number;
}

export interface ImageQualityAnalysis {
  qualityScore: number;
  sharpness: number;
  brightness: number;
  classification: QualityClassification;
  isBlurry: boolean;
  isTooDark: boolean;
}
