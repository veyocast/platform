import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

import { secureAuthStorage } from "./secure-storage";
import { readMobileRuntimeConfig } from "../config/runtime";

const runtime = readMobileRuntimeConfig();

export const mobileSupabase = runtime.config
  ? createClient(runtime.config.supabaseUrl, runtime.config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: secureAuthStorage
      },
      global: {
        headers: {
          "X-Client-Info": "veyocast-control-mobile/1"
        }
      }
    })
  : null;

export const mobileRuntimeError = runtime.error;
