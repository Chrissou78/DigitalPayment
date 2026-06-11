import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "PayDuka",
  slug: "payduka",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "payduka",
  userInterfaceStyle: "dark",
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0A08",
    },
    package: "xyz.payduka.customer",
    permissions: [
      "USE_BIOMETRIC",
      "USE_FINGERPRINT",
      "CAMERA",
      "VIBRATE",
    ],
  },
  ios: {
    bundleIdentifier: "xyz.payduka.customer",
    infoPlist: {
      NSFaceIDUsageDescription: "PayDuka uses Face ID for fast, secure login.",
      NSCameraUsageDescription: "PayDuka uses the camera to scan merchant QR codes.",
    },
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0A0A0F",
        image: "./assets/splash.png",
        imageWidth: 200,
      },
    ],
    "expo-router",
    "expo-local-authentication",
    "expo-secure-store",
    "expo-camera",
    "expo-notifications",
  ],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3000/api/v1",
    wsBaseUrl: process.env.WS_BASE_URL ?? "ws://localhost:3000/ws",
  },
});
