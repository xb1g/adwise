import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import "expo-sqlite/localStorage/install";
import * as WebBrowser from "expo-web-browser";

// Required for OAuth redirect on mobile
WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
