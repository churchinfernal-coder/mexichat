/**
 * Type declarations for capacitor-native-biometric
 * Auto-generated — this module is dynamically imported at runtime
 */
declare module 'capacitor-native-biometric' {
  export interface BiometricOptions {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    negativeButtonText?: string;
    maxAttempts?: number;
    useFallback?: boolean;
  }

  export interface IsAvailableResult {
    isAvailable: boolean;
    biometryType: number;
    errorCode?: number;
  }

  export interface Credentials {
    username: string;
    password: string;
  }

  export const NativeBiometric: {
    isAvailable(): Promise<IsAvailableResult>;
    verifyIdentity(options?: BiometricOptions): Promise<void>;
    getCredentials(options: { server: string }): Promise<Credentials>;
    setCredentials(options: { server: string; username: string; password: string }): Promise<void>;
    deleteCredentials(options: { server: string }): Promise<void>;
  };
}
