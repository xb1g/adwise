import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";

const BOOKING_PRICE = 10;
const PLATFORM_FEE_PERCENT = 10;
const ELDER_PAYOUT_PERCENT = 100 - PLATFORM_FEE_PERCENT;
const ELDER_PAYOUT = BOOKING_PRICE * (ELDER_PAYOUT_PERCENT / 100);

export default function ElderDetail() {
  const { id, matchReason, bio, ageRange, lifeAreas, previewText, problemText } =
    useLocalSearchParams<{
      id: string;
      storyId: string;
      matchReason: string;
      bio: string;
      ageRange: string;
      lifeAreas: string;
      previewText: string;
      problemText: string;
    }>();

  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [booking, setBooking] = useState(false);
  const areas: string[] = JSON.parse(lifeAreas ?? "[]");

  function handleUnlock() {
    // Demo: show unlock animation, in prod this would be a paywall
    setUnlocked(true);
  }

  async function handleBook() {
    if (!user) return;
    setBooking(true);
    try {
      const { error } = await supabase.from("bookings").insert({
        elder_id: id,
        seeker_id: user.id,
        problem_text: problemText ?? "",
        match_reason: matchReason ?? "",
        status: "pending",
      });
      if (error) throw error;
      Alert.alert(
        "Booking requested!",
        "The elder will be notified. They'll reach out to schedule your conversation.",
        [{ text: "Done" }]
      );
    } catch (err) {
      Alert.alert("Error", "Couldn't complete booking. Try again.");
    } finally {
      setBooking(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back to matches</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>◎</Text>
        </View>
        <View>
          <Text style={styles.ageRange}>{ageRange}</Text>
          <View style={styles.chipRow}>
            {areas.map((a) => (
              <View key={a} style={styles.chip}>
                <Text style={styles.chipText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Match reason */}
      <View style={styles.matchBox}>
        <Text style={styles.matchLabel}>Why you matched</Text>
        <Text style={styles.matchReason}>{matchReason}</Text>
      </View>

      {/* Bio */}
      <Text style={styles.bio}>{bio}</Text>

      {/* Story section */}
      <Text style={styles.sectionLabel}>Their story</Text>

      {!unlocked ? (
        <View>
          <Text style={styles.preview}>{previewText}</Text>
          <View style={styles.blurOverlay}>
            <Text style={styles.blurText}>
              Unlock to read the full story — the struggles, the turning points, the lessons.
            </Text>
            <Pressable style={styles.unlockBtn} onPress={handleUnlock}>
              <Text style={styles.unlockBtnText}>Unlock full story — $2</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.unlockedStory}>
          <Text style={styles.unlockedText}>
            {/* In prod: fetch full story transcript/snippets from DB */}
            {bio}{"\n\n"}
            The full story is available in the complete app. During this demo, imagine 10 minutes of
            this elder speaking directly to your situation — the exact moment they faced what you're
            facing, and what happened next.
          </Text>
        </View>
      )}

      {/* Book CTA */}
      <Pressable style={[styles.bookBtn, booking && styles.bookBtnDisabled]} onPress={handleBook} disabled={booking}>
        {booking ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={styles.bookBtnText}>Book a 30-min conversation — ${BOOKING_PRICE}</Text>
        )}
      </Pressable>

      <Text style={styles.bookNote}>
        Elders earn ${ELDER_PAYOUT} ({ELDER_PAYOUT_PERCENT}%) on each ${BOOKING_PRICE} booking; platform keeps{" "}
        {PLATFORM_FEE_PERCENT}%.
      </Text>
      <Text style={styles.bookNote}>
        Real conversations with real people who have lived your exact problem.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 64 },
  back: { marginBottom: 32 },
  backText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.5 },
  header: { flexDirection: "row", gap: 16, alignItems: "flex-start", marginBottom: 24 },
  avatar: { width: 56, height: 56, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#BFFF00", fontSize: 24 },
  ageRange: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", opacity: 0.6, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#111", paddingVertical: 2, paddingHorizontal: 8 },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111" },
  matchBox: { backgroundColor: "#F0FFD4", padding: 16, marginBottom: 24, gap: 8 },
  matchLabel: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111", opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5 },
  matchReason: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 22 },
  bio: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 26, marginBottom: 32 },
  sectionLabel: { fontFamily: "Orbit_400Regular", fontSize: 11, color: "#111", opacity: 0.5, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 },
  preview: { fontFamily: "Orbit_400Regular", fontSize: 15, color: "#111", lineHeight: 26, marginBottom: 16, fontStyle: "italic" },
  blurOverlay: { backgroundColor: "#F5F5F0", padding: 24, alignItems: "center", gap: 20, borderWidth: 1, borderColor: "#DDD" },
  blurText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111", textAlign: "center", lineHeight: 22, opacity: 0.7 },
  unlockBtn: { backgroundColor: "#111", paddingVertical: 14, paddingHorizontal: 32 },
  unlockBtnText: { fontFamily: "Orbit_400Regular", fontSize: 15, fontWeight: "700", color: "#BFFF00" },
  unlockedStory: { backgroundColor: "#F8FFE8", padding: 20, borderLeftWidth: 3, borderLeftColor: "#BFFF00" },
  unlockedText: { fontFamily: "Orbit_400Regular", fontSize: 14, color: "#111", lineHeight: 24 },
  bookBtn: { backgroundColor: "#BFFF00", paddingVertical: 16, alignItems: "center", marginTop: 40 },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText: { fontFamily: "Orbit_400Regular", fontSize: 15, fontWeight: "700", color: "#111" },
  bookNote: { fontFamily: "Orbit_400Regular", fontSize: 12, color: "#111", opacity: 0.5, textAlign: "center", marginTop: 12, lineHeight: 18 },
});
