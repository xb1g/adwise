import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
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

type AuthContext = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  role: WisdomRole;
  roleLoading: boolean;
  seekerOnboardingDone: boolean | null;
  elderOnboardingDone: boolean | null;
  refreshProfile: () => Promise<void>;
  refreshRole: (userId?: string) => Promise<void>;
  refreshSeekerOnboarding: (userId?: string) => Promise<void>;
  refreshElderOnboarding: (userId?: string) => Promise<void>;
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
  elderOnboardingDone: null,
  refreshProfile: async () => {},
  refreshRole: async () => {},
  refreshSeekerOnboarding: async () => {},
  refreshElderOnboarding: async () => {},
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
  const [roleLoading, setRoleLoading] = useState(true);
  const [seekerOnboardingDone, setSeekerOnboardingDone] = useState<boolean | null>(null);
  const [elderOnboardingDone, setElderOnboardingDone] = useState<boolean | null>(null);

  // Version counter: only the latest fetchRole call updates state
  const roleVersionRef = useRef(0);

  const fetchSeekerOnboarding = async (userId: string) => {
    const { data } = await supabase
      .from("seeker_profiles")
      .select("onboarding_done")
      .eq("user_id", userId)
      .maybeSingle();
    setSeekerOnboardingDone(data?.onboarding_done ?? false);
  };

  const fetchElderOnboarding = async (userId: string) => {
    const { data } = await supabase
      .from("elder_profiles")
      .select("onboarding_done")
      .eq("user_id", userId)
      .maybeSingle();
    setElderOnboardingDone(data?.onboarding_done ?? false);
  };

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("onboarding_done, life_areas, direction, values, blockers, weekly_hours")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(data ?? null);
    setProfileLoading(false);
  };

  const fetchRole = async (userId: string) => {
    const version = ++roleVersionRef.current;
    setRoleLoading(true);
    const { data } = await supabase
      .from("wisdom_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (version !== roleVersionRef.current) return; // stale call, skip
    const fetched = (data?.role as WisdomRole) ?? null;
    setRole(fetched);
    setRoleLoading(false);
  };

  const refreshProfile = async () => {
    if (session?.user.id) await fetchProfile(session.user.id);
  };
  const refreshRole = async (userId?: string) => {
    const id = userId ?? session?.user.id;
    if (id) await fetchRole(id);
  };
  const refreshSeekerOnboarding = async (userId?: string) => {
    const id = userId ?? session?.user.id;
    if (id) await fetchSeekerOnboarding(id);
  };
  const refreshElderOnboarding = async (userId?: string) => {
    const id = userId ?? session?.user.id;
    if (id) await fetchElderOnboarding(id);
  };

  // ── Session management ──────────────────────────────────────────────────
  // onAuthStateChange ONLY updates session. All data fetching is driven
  // by useEffects reacting to session/role changes — no races.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch profile + role whenever user changes ──────────────────────────
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const userId = session?.user?.id;
    if (userId && userId !== prevUserIdRef.current) {
      prevUserIdRef.current = userId;
      // Reset everything for the new user
      setRole(null);
      setRoleLoading(true);
      setSeekerOnboardingDone(null);
      setElderOnboardingDone(null);
      fetchProfile(userId);
      fetchRole(userId);
    } else if (!userId && prevUserIdRef.current) {
      prevUserIdRef.current = undefined;
      setProfile(null);
      setRole(null);
      setRoleLoading(false);
      setSeekerOnboardingDone(null);
      setElderOnboardingDone(null);
    }
  }, [session?.user?.id]);

  // ── Fetch onboarding status whenever role changes ───────────────────────
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !role) return;
    if (role === "seeker") {
      setSeekerOnboardingDone(null);
      setElderOnboardingDone(null);
      fetchSeekerOnboarding(userId);
    } else if (role === "elder") {
      setElderOnboardingDone(null);
      setSeekerOnboardingDone(null);
      fetchElderOnboarding(userId);
    }
  }, [role, session?.user?.id]);

  // ── Deep link listener (Android fallback) ───────────────────────────────
  useEffect(() => {
    const processAuthUrl = async (url: string) => {
      if (!url.includes("#access_token=")) return;
      const fragment = url.split("#")[1] ?? "";
      const fragParams = new URLSearchParams(fragment);
      const access_token = fragParams.get("access_token");
      const refresh_token = fragParams.get("refresh_token");
      if (!access_token || !refresh_token) return;

      const urlParts = url.split("#")[0];
      const qIdx = urlParts.indexOf("?");
      const queryRole = qIdx >= 0
        ? new URLSearchParams(urlParts.slice(qIdx + 1)).get("role")
        : null;

      console.log("[auth] deep link: tokens found, role from URL:", queryRole);
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) { console.log("[auth] deep link setSession error:", error); return; }

      if (queryRole && (queryRole === "elder" || queryRole === "seeker")) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await supabase
            .from("wisdom_users")
            .upsert({ user_id: session.user.id, role: queryRole }, { onConflict: "user_id" });
          await fetchRole(session.user.id);
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) processAuthUrl(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => processAuthUrl(url));
    return () => sub.remove();
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────
  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (data.session) setSession(data.session);
  };

  const signInWithGoogle = async (signInRole?: "elder" | "seeker") => {
    const base = AuthSession.makeRedirectUri({ scheme: "com.bunyasit.adwise" });
    const redirectUrl = signInRole ? `${base}google-auth?role=${signInRole}` : base;
    console.log("[auth] redirectUrl:", redirectUrl);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === "success") {
      const fragment = result.url.split("#")[1] ?? "";
      const params = new URLSearchParams(fragment);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionError) throw sessionError;
        console.log("[auth] session set successfully");
        if (signInRole) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            await supabase
              .from("wisdom_users")
              .upsert({ user_id: session.user.id, role: signInRole }, { onConflict: "user_id" });
            await fetchRole(session.user.id);
          }
        }
      } else if (result.url.includes("code=")) {
        await supabase.auth.exchangeCodeForSession(result.url);
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRole(null);
    setRoleLoading(false);
    setSeekerOnboardingDone(null);
    setElderOnboardingDone(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session, user: session?.user ?? null, loading,
        profile, profileLoading,
        role, roleLoading,
        seekerOnboardingDone, elderOnboardingDone,
        refreshProfile, refreshRole, refreshSeekerOnboarding, refreshElderOnboarding,
        signInAnonymously, signInWithGoogle, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);