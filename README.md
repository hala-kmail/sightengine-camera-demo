# Vision Camera + Frame Processors Demo

A minimal Expo demo app that uses **react-native-vision-camera** with **Frame Processors** for real-time image quality checks (sharpness, brightness) before capture. No external API—all processing runs on-device.

---

## Summary: Pre-Capture Image Quality Check

### What the project does

This app shows a **live camera preview** and runs a **real-time quality check** on the video stream **before** the user takes a photo. It reports:

- **Sharpness** (0–100%): how sharp the image is; low values indicate blur.
- **Brightness** (0–100%): how bright the scene is; low values indicate a too-dark image.

The UI shows “Ready to capture” when both are above the thresholds, or warnings like “Image is too blurry” / “Image is too dark”. The capture button can be disabled until quality is valid, so the user is guided to take a better shot.

### How the pre-capture check works

1. **Frame processor**  
   The camera feed is processed with a **Vision Camera Frame Processor**. Each camera frame is passed into a function that runs on the native side (worklet), so analysis happens on-device without sending frames to a server.

2. **Controlled rate**  
   To avoid overloading the device, analysis runs at **2 FPS** via `runAtTargetFps(2)`. Only a subset of frames is analyzed.

3. **Frame buffer analysis**  
   For each analyzed frame:
   - The raw pixel buffer is read (supports **RGB** or **Y-plane** formats).
   - A **central region** (roughly 25–75% of width and height) is sampled with a step size so the work stays light (e.g. step ≈ min(width, height) / 64).

4. **Sharpness (blur detection)**  
   Sharpness is estimated with a **Laplacian-like** operator on luminance:
   - For each sample point, a 5-point stencil is used: `4×center − top − bottom − left − right`.
   - The squared Laplacian values are collected and their **variance** is computed.
   - Higher variance means more edge detail → sharper image. The variance is scaled into a 0–1 sharpness score.  
   **Threshold:** sharpness &lt; 0.4 → “blurry”.

5. **Brightness**  
   Average luminance is computed over the same central region (RGB → `0.299R + 0.587G + 0.114B`, or Y-plane used directly).  
   **Threshold:** brightness &lt; 0.3 → “too dark”.

6. **Result**  
   Each analysis produces: `sharpness`, `brightness`, `isBlurry`, `isTooDark`, and `isValid` (true only when not blurry and not too dark). This is sent back to the React UI via a worklet bridge so the overlay and capture button state update in real time.

### Benefits of this approach

| Benefit | Description |
|--------|-------------|
| **On-device only** | No image or video is sent to any server. All processing runs on the phone. Good for privacy and offline use. |
| **Real-time feedback** | The user sees quality (sharpness, brightness, ready/warnings) while aiming the camera, so they can adjust before tapping capture. |
| **No API or backend** | No API keys, no backend, no network needed for the pre-capture check. Simple to integrate and deploy. |
| **Lightweight** | Sampling and 2 FPS keep CPU/GPU usage low. Works on typical mobile devices. |
| **Capture gating** | The app can block capture when quality is invalid (e.g. too blurry or too dark), reducing bad photos. |
| **Reusable** | The logic lives in `useImageQualityFrameProcessor`; you can plug it into any Vision Camera screen and use the same thresholds or tune them. |

---

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
