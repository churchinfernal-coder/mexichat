import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mx.mexichat.app',
  appName: 'MexiChat',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // In production, remove this. Only for local dev:
    // url: 'http://192.168.1.X:5173',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#10b981',
      sound: 'notification.wav',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#030712',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#030712',
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    allowMixedContent: false,
    backgroundColor: '#030712',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#030712',
    scheme: 'MexiChat',
  },
};

export default config;
