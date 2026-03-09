# Vision Camera + Frame Processors Demo

A minimal Expo demo app that uses **react-native-vision-camera** with **Frame Processors** for real-time image quality checks (sharpness, brightness) before capture. No external API—all processing runs on-device.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **No API keys required**—this branch uses only Vision Camera and on-device frame processors.

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
- **Real-time quality check** (Vision Camera Frame Processor): sharpness and brightness analysis on each frame
- Capture only when quality is valid (not too blurry, not too dark)
- Preview captured photo and retake

## Project Structure

```
src/
  screens/
    CameraScreen.tsx           # Camera UI and capture flow
  hooks/
    useImageQualityFrameProcessor.ts  # Frame processor for quality (sharpness/brightness)
  types/
    index.ts                   # TypeScript types
config/
  env.ts                       # Environment config (empty in this branch)
App.tsx
```

## Platform Notes

- **iOS/Android**: Full camera and frame processor support. Run with `npx expo run:ios` or `npx expo run:android` for development builds.
- **Web**: Camera works in browsers that support `getUserMedia`. Use HTTPS or localhost.
