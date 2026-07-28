/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_CONTROL_ORIGIN?: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly VEYOCAST_CONTROL_VERSION_CODE?: string;
    readonly VEYOCAST_CONTROL_VERSION_NAME?: string;
  }
}
