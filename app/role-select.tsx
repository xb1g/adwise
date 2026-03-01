import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function RoleSelect() {
  const { user } = useAuth();

  async function selectRole(role: "elder" | "seeker") {
    if (!user) return;

    await supabase.from("wisdom_users").upsert({
      user_id: user.id,
      name: user.user_metadata?.full_name ?? "",
      role,
    });

    if (role === "elder") {
      router.replace("/(elder)/setup");
    } else {
      router.replace("/(seeker)/problem");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>adwise</Text>
      <Text style={styles.subtitle}>What brings you here?</Text>

      <Pressable style={styles.card} onPress={() => selectRole("elder")}>
        <Text style={styles.cardTitle}>I have wisdom</Text>
        <Text style={styles.cardDesc}>
          Share your life story. Help someone who is exactly where you were.
        </Text>
      </Pressable>

      <Pressable style={[styles.card, styles.cardAccent]} onPress={() => selectRole("seeker")}>
        <Text style={styles.cardTitle}>I need wisdom</Text>
        <Text style={styles.cardDesc}>
          Describe your challenge. Meet elders who have lived through it.
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFFF5",
    paddingTop: 100,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    marginBottom: 48,
    opacity: 0.6,
  },
  card: {
    borderWidth: 2,
    borderColor: "#111",
    padding: 24,
    marginBottom: 16,
  },
  cardAccent: {
    backgroundColor: "#BFFF00",
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Orbit_400Regular",
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    lineHeight: 22,
  },
});
