import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type ElderProfile = {
  id: string;
  name: string;
  age_range: string | null;
  life_areas: string[];
  bio: string;
};

export default function ElderHome() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("elder_profiles").select("id, name, age_range, life_areas, bio").eq("user_id", user.id).maybeSingle()
      .then(({ data: ep }) => {
        setProfile(ep);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  const firstName = profile?.name?.split(" ")[0] || "Elder";

  async function handleLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingSub}>Welcome back,</Text>
          <Text style={styles.greetingName}>{firstName}.</Text>
          <Text style={styles.greetingTagline}>Your wisdom matters here.</Text>
        </View>

        {/* Feature cards */}
        <View style={styles.cards}>

          <Pressable style={[styles.card, styles.cardPrimary]} onPress={() => router.push("/(elder)/requests")}>
            <Text style={styles.cardIcon}>📬</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitlePrimary}>Wisdom Requests</Text>
              <Text style={styles.cardDescPrimary}>Seekers asking for your guidance</Text>
            </View>
            <Text style={styles.cardArrowPrimary}>→</Text>
          </Pressable>

          <Pressable style={[styles.card, styles.cardDark]} onPress={() => router.push("/(elder)/sessions")}>
            <Text style={styles.cardIcon}>💬</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitleDark}>My Sessions</Text>
              <Text style={styles.cardDescDark}>Active conversations with seekers</Text>
            </View>
            <Text style={styles.cardArrowDark}>→</Text>
          </Pressable>

          <Pressable style={[styles.card, styles.cardLight]} onPress={() => router.push("/(elder)/stories")}>
            <Text style={styles.cardIcon}>✨</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitleLight}>My Stories</Text>
              <Text style={styles.cardDescLight}>Your wisdom, experiences, and insights</Text>
            </View>
            <Text style={styles.cardArrowLight}>→</Text>
          </Pressable>

          <Pressable style={[styles.card, styles.cardLight]} onPress={() => router.push("/(elder)/profile")}>
            <Text style={styles.cardIcon}>👤</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitleLight}>My Profile</Text>
              <Text style={styles.cardDescLight}>View and update your elder profile</Text>
            </View>
            <Text style={styles.cardArrowLight}>→</Text>
          </Pressable>

          {/* Logout block */}
          <Pressable style={[styles.card, styles.cardLogout]} onPress={handleLogout}>
            <Text style={styles.cardIcon}>🚪</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitleLogout}>Log Out</Text>
              <Text style={styles.cardDescLogout}>Sign out of your account</Text>
            </View>
          </Pressable>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FDFFF5" },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FDFFF5" },

  greeting: {
    marginBottom: 48,
    gap: 4,
  },
  greetingSub: {
    fontFamily: "Orbit_400Regular",
    fontSize: 24,
    color: "#111",
    fontWeight: "900",
  },
  greetingName: {
    fontFamily: "Orbit_400Regular",
    fontSize: 64,
    color: "#111",
    fontWeight: "900",
    lineHeight: 70,
  },
  greetingTagline: {
    fontFamily: "Orbit_400Regular",
    fontSize: 22,
    color: "#111",
    fontWeight: "900",
    marginTop: 8,
  },

  cards: { gap: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    gap: 20,
    minHeight: 120,
  },
  cardBody: { flex: 1, gap: 8 },
  cardIcon: { fontSize: 40 },

  cardPrimary: { backgroundColor: "#BFFF00" },
  cardTitlePrimary: { fontFamily: "Orbit_400Regular", fontSize: 26, color: "#000", fontWeight: "900" },
  cardDescPrimary: { fontFamily: "Orbit_400Regular", fontSize: 18, color: "#111", fontWeight: "900", lineHeight: 26 },
  cardArrowPrimary: { fontFamily: "Orbit_400Regular", fontSize: 34, color: "#000", fontWeight: "900" },

  cardDark: { backgroundColor: "#111" },
  cardTitleDark: { fontFamily: "Orbit_400Regular", fontSize: 26, color: "#FDFFF5", fontWeight: "900" },
  cardDescDark: { fontFamily: "Orbit_400Regular", fontSize: 18, color: "#BFFF00", fontWeight: "900", lineHeight: 26 },
  cardArrowDark: { fontFamily: "Orbit_400Regular", fontSize: 34, color: "#BFFF00", fontWeight: "900" },

  cardLight: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#111" },
  cardTitleLight: { fontFamily: "Orbit_400Regular", fontSize: 26, color: "#111", fontWeight: "900" },
  cardDescLight: { fontFamily: "Orbit_400Regular", fontSize: 18, color: "#111", fontWeight: "900", lineHeight: 26 },
  cardArrowLight: { fontFamily: "Orbit_400Regular", fontSize: 34, color: "#111", fontWeight: "900" },

  cardLogout: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#111", marginTop: 8 },
  cardTitleLogout: { fontFamily: "Orbit_400Regular", fontSize: 26, color: "#111", fontWeight: "900" },
  cardDescLogout: { fontFamily: "Orbit_400Regular", fontSize: 18, color: "#111", fontWeight: "900", lineHeight: 26 },
});
