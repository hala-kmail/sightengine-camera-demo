# Sightengine Camera Demo

A minimal Expo demo app that captures photos using the device camera and analyzes image quality using the Sightengine API.

## Setup

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Configure Sightengine API credentials**:
   - Copy `.env.example` to `.env`
   - Add your Sightengine API user and secret:
     ```
     EXPO_PUBLIC_SIGHTENGINE_API_USER=your_api_user
     EXPO_PUBLIC_SIGHTENGINE_API_SECRET=your_api_secret
     ```
   - Get credentials at [Sightengine Dashboard](https://dashboard.sightengine.com/)

## Run

```bash
npx expo start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web
- Scan QR code with Expo Go on a physical device

## Features

- Request camera permissions
- Open camera preview
- Switch between front and back camera
- Capture photo
- Preview captured photo
- Retake or confirm photo
- Send to Sightengine for quality analysis
- Display quality score, sharpness, brightness
- Quality classification: High (green) / Medium (yellow) / Low (red)
- Retake suggestion when quality is low

## Project Structure

```
src/
  screens/
    CameraScreen.tsx    # Camera UI and capture flow
  services/
    sightengineService.ts  # Sightengine API integration
  types/
    index.ts            # TypeScript types
config/
  env.ts               # Environment config
App.tsx
.env
```

## Platform Notes

- **iOS/Android**: Full camera support. Run with `npx expo run:ios` or `npx expo run:android` for development builds.
- **Web**: Camera works in browsers that support `getUserMedia`. Use HTTPS or localhost.
