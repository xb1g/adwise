import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

export type WisdomRole = "elder" | "seeker" | null;

export type UserProfile = {
  onboarding_done: boolean;
  life_areas: string[];
  direction: string;
  values: string;
  blockers: string;
  weekly_hours: number;
};

const ROLE_CACHE_KEY = "adwise_cached_role";
const PENDING_ROLE_KEY = "adwise_pending_role";

type AuthContext = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  role: WisdomRole;
  roleLoading: boolean;
  seekerOnboardingDone: boolean | null;
  refreshProfile: () => Promise<void>;
  refreshRole: (userId?: string) => Promise<void>;
  refreshSeekerOnboarding: (userId?: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithGoogle: (role?: "elder" | "seeker") => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContext>({
  session: null,
  user: null,
  loading: true,
  profile: null,
  profileLoading: false,
  role: null,
  roleLoading: false,
  seekerOnboardingDone: null,
  refreshProfile: async () => {},
  refreshRole: async () => {},
  refreshSeekerOnboarding: async () => {},
  signInAnonymously: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [role, setRole] = useState<WisdomRole>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [seekerOnboardingDone, setSeekerOnboardingDone] = useState<boolean | null>(null);

  const fetchSeekerOnboarding = async (userId: string) => {
    const { data } = await supabase
      .from("seeker_profiles")
      .select("onboarding_done")
      .eq("user_id", userId)
      .maybeSingle();
    setSeekerOnboardingDone(data?.onboarding_done ?? false);
  };

  const refreshSeekerOnboarding = async (userId?: string) => {
    const id = userId ?? session?.user.id;
    if (id) await fetchSeekerOnboarding(id);
  };

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select(
        "onboarding_done, life_areas, direction, values, blockers, weekly_hours",
      )
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(data ?? null);
    setProfileLoading(false);
  };

  const fetchRole = async (userId: string) => {
    setRoleLoading(true);
    // Seed from local cache first for instant UI
    try {
      const cached = await AsyncStorage.getItem(ROLE_CACHE_KEY);
      if (cached) setRole(cached as WisdomRole);
    } catch {}

    const { data } = await supabase
      .from("wisdom_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const fetched = (data?.role as WisdomRole) ?? null;
    setRole(fetched);
    try {
      if (fetched) await AsyncStorage.setItem(ROLE_CACHE_KEY, fetched);
      else await AsyncStorage.removeItem(ROLE_CACHE_KEY);
    } catch {}
    setRoleLoading(false);
  };

  const refreshProfile = async () => {
    if (session?.user.id) await fetchProfile(session.user.id);
  };

  const refreshRole = async (userId?: string) => {
    const id = userId ?? session?.user.id;
    if (id) await fetchRole(id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user.id) {
        fetchProfile(session.user.id);
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user.id) {
        fetchProfile(session.user.id);
        // Check for a pending role from sign-in flow
        try {
          const pendingRole = await AsyncStorage.getItem(PENDING_ROLE_KEY);
          if (pendingRole) {
            await AsyncStorage.removeItem(PENDING_ROLE_KEY);
            console.log("[auth] applying pending role:", pendingRole);
            await supabase
              .from("wisdom_users")
              .upsert({ user_id: session.user.id, role: pendingRole }, { onConflict: "user_id" });
          }
        } catch {}
        fetchRole(session.user.id);
      } else {
        setProfile(null);
        setRole(null);
        try {
          AsyncStorage.removeItem(ROLE_CACHE_KEY);
        } catch {}
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Deep link listener: catches OAuth callback URLs when openAuthSessionAsync
  // doesn't resolve (e.g. Android app restart on deep link).
  useEffect(() => {
    const processAuthUrl = async (url: string) => {
      if (!url.includes("#access_token=")) return;
      const fragment = url.split("#")[1] ?? "";
      const params = new URLSearchParams(fragment);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        console.log("[auth] deep link: setting session from URL tokens");
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) processAuthUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => processAuthUrl(url));
    return () => sub.remove();
  }, []);

  // Fetch seeker onboarding status whenever role becomes "seeker"
  useEffect(() => {
    if (role === "seeker" && session?.user?.id) {
      setSeekerOnboardingDone(null);
      fetchSeekerOnboarding(session.user.id);
    } else if (role !== "seeker") {
      setSeekerOnboardingDone(null);
    }
  }, [role, session?.user?.id]);

  const setPendingRole = async (r: "elder" | "seeker") => {
    await AsyncStorage.setItem(PENDING_ROLE_KEY, r);
  };

  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (data.session) setSession(data.session);
  };

  const signInWithGoogle = async () => {
    const redirectUrl = AuthSession.makeRedirectUri({ scheme: "com.bunyasit.adwise" });
    console.log("[auth] redirectUrl:", redirectUrl);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) { console.log("[auth] no OAuth URL returned"); return; }
    console.log("[auth] opening browser:", data.url);
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    console.log("[auth] browser result type:", result.type);
    if (result.type === "success") {
      console.log("[auth] result url:", result.url);
      const fragment = result.url.split("#")[1] ?? "";
      const params = new URLSearchParams(fragment);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      console.log("[auth] access_token present:", !!access_token, "refresh_token present:", !!refresh_token);
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionError) { console.log("[auth] setSession error:", sessionError); throw sessionError; }
        console.log("[auth] session set successfully");
      } else if (result.url.includes("code=")) {
        // PKCE flow fallback
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (exchangeError) { console.log("[auth] exchangeCodeForSession error:", exchangeError); throw exchangeError; }
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRole(null);
    setSeekerOnboardingDone(null);
    try {
      await AsyncStorage.multiRemove([ROLE_CACHE_KEY, PENDING_ROLE_KEY]);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profile,
        profileLoading,
        role,
        roleLoading,
        seekerOnboardingDone,
        refreshProfile,
        refreshRole,
        refreshSeekerOnboarding,
        setPendingRole,
        signInAnonymously,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
