import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

const AGE_RANGES = ["50s", "60s", "70s", "80s+"] as const;

const LIFE_AREA_OPTIONS = [
  "career", "immigration", "startup", "marriage", "divorce",
  "grief", "financial-recovery", "creativity", "identity",
  "family", "health", "education", "reinvention",
];

export default function ElderSetup() {
  const { user } = useAuth();
  const [ageRange, setAgeRange] = useState<string>("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleArea(area: string) {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  async function handleContinue() {
    if (!ageRange || selectedAreas.length === 0 || !user) return;
    setSaving(true);

    const { error } = await supabase.from("elder_profiles").insert({
      user_id: user.id,
      age_range: ageRange,
      life_areas: selectedAreas,
      bio: "",
      is_seeded: false,
    });

    setSaving(false);
    if (!error) router.replace("/(elder)/record");
  }

  const canContinue = ageRange !== "" && selectedAreas.length > 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your story starts here</Text>

      <Text style={styles.label}>How old are you?</Text>
      <View style={styles.row}>
        {AGE_RANGES.map((r) => (
          <Pressable
            key={r}
            style={[styles.chip, ageRange === r && styles.chipSelected]}
            onPress={() => setAgeRange(r)}
          >
            <Text style={[styles.chipText, ageRange === r && styles.chipTextSelected]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>What have you lived through? (pick all that apply)</Text>
      <View style={styles.row}>
        {LIFE_AREA_OPTIONS.map((area) => (
          <Pressable
            key={area}
            style={[styles.chip, selectedAreas.includes(area) && styles.chipSelected]}
            onPress={() => toggleArea(area)}
          >
            <Text style={[styles.chipText, selectedAreas.includes(area) && styles.chipTextSelected]}>
              {area}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.btn, !canContinue && styles.btnDisabled]}
        onPress={handleContinue}
        disabled={!canContinue || saving}
      >
        {saving ? (
          <ActivityIndicator color="#FDFFF5" />
        ) : (
          <Text style={styles.btnText}>Record my story →</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 40 },
  label: { fontSize: 14, fontFamily: "Orbit_400Regular", color: "#111", marginBottom: 12, marginTop: 24, opacity: 0.7 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1.5, borderColor: "#111", paddingVertical: 6, paddingHorizontal: 14 },
  chipSelected: { backgroundColor: "#BFFF00", borderColor: "#BFFF00" },
  chipText: { fontFamily: "Orbit_400Regular", fontSize: 13, color: "#111" },
  chipTextSelected: { fontWeight: "700" },
  btn: { backgroundColor: "#111", paddingVertical: 16, alignItems: "center", marginTop: 48 },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: "#FDFFF5", fontFamily: "Orbit_400Regular", fontSize: 16, fontWeight: "700" },
});
