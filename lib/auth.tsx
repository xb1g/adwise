import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
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

type AuthContext = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  role: WisdomRole;
  roleLoading: boolean;
  refreshProfile: () => Promise<void>;
  refreshRole: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
};

const AuthContext = createContext<AuthContext>({
  session: null,
  user: null,
  loading: true,
  profile: null,
  profileLoading: false,
  role: null,
  roleLoading: false,
  refreshProfile: async () => {},
  refreshRole: async () => {},
  signInAnonymously: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [role, setRole] = useState<WisdomRole>(null);
  const [roleLoading, setRoleLoading] = useState(false);

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
    setRoleLoading(true);
    // Seed from local cache first for instant UI
    try {
      const cached = localStorage.getItem(ROLE_CACHE_KEY);
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
      if (fetched) localStorage.setItem(ROLE_CACHE_KEY, fetched);
      else localStorage.removeItem(ROLE_CACHE_KEY);
    } catch {}
    setRoleLoading(false);
  };

  const refreshProfile = async () => {
    if (session?.user.id) await fetchProfile(session.user.id);
  };

  const refreshRole = async () => {
    if (session?.user.id) await fetchRole(session.user.id);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user.id) {
          fetchProfile(session.user.id);
          fetchRole(session.user.id);
        } else {
          setProfile(null);
          setRole(null);
          try { localStorage.removeItem(ROLE_CACHE_KEY); } catch {}
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (data.session) setSession(data.session);
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
        refreshProfile,
        refreshRole,
        signInAnonymously,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
