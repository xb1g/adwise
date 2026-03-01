import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";

type Situation = {
  id: string;
  problem_text: string;
  created_at: string;
  match_count: number;
  elder_names: string[];
};

export default function SeekerMatchesTab() {
  const { user } = useAuth();
  const [situations, setSituations] = useState<Situation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user])
  );

  async function loadData() {
    setLoading(true);

    const { data: allMatches } = await supabase
      .from("matches")
      .select("id, problem_text, result, created_at")
      .eq("seeker_id", user!.id)
      .order("created_at", { ascending: false });

    if (!allMatches || allMatches.length === 0) {
      setSituations([]);
      setLoading(false);
      return;
    }

    // Collect all elder ids across all matches
    const allElderIds = new Set<string>();
    for (const m of allMatches) {
      const results = (m.result ?? []) as Array<{ elder_id: string }>;
      results.forEach((r) => allElderIds.add(r.elder_id));
    }

    const elderIdArr = Array.from(allElderIds);
    const { data: profiles } = elderIdArr.length > 0
      ? await supabase
          .from("elder_profiles")
          .select("id, name")
          .in("id", elderIdArr)
      : { data: [] };

    const built: Situation[] = allMatches.map((m) => {
      const results = (m.result ?? []) as Array<{ elder_id: string }>;
      const names = results
        .map((r) => profiles?.find((p) => p.id === r.elder_id)?.name ?? "")
        .filter(Boolean);

      return {
        id: m.id,
        problem_text: m.problem_text ?? "",
        created_at: m.created_at,
        match_count: results.length,
        elder_names: names,
      };
    });

    setSituations(built);
    setLoading(false);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your situations</Text>
      <Text style={styles.subtitle}>
        Each situation has elders matched to help you.
      </Text>

      {situations.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>◇</Text>
          <Text style={styles.emptyTitle}>No situations yet</Text>
          <Text style={styles.emptyText}>
            Describe what you're going through to find elders who've been there.
          </Text>
        </View>
      ) : (
        situations.map((s) => {
          const shortProblem =
            s.problem_text.length > 100
              ? s.problem_text.slice(0, 100) + "..."
              : s.problem_text;

          return (
            <Pressable
              key={s.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/(seeker)/matches/[id]",
                  params: { id: s.id },
                })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>{formatDate(s.created_at)}</Text>
                <View style={styles.matchCountBadge}>
                  <Text style={styles.matchCountText}>
                    {s.match_count} {s.match_count === 1 ? "match" : "matches"}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardProblem}>{shortProblem}</Text>

              {s.elder_names.length > 0 ? (
                <Text style={styles.cardElders}>
                  {s.elder_names.join(", ")}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <Text style={styles.cardCta}>View matches →</Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Pressable
        style={styles.addBtn}
        onPress={() => router.push("/(seeker)/problem")}
      >
        <Text style={styles.addBtnText}>+ New situation</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FDFFF5" },
  container: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDFFF5",
  },
  title: {
    fontSize: 28,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    opacity: 0.5,
    marginBottom: 28,
    lineHeight: 20,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
    color: "#CCC",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: "Orbit_400Regular",
    fontSize: 20,
    color: "#111",
  },
  emptyText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0D8",
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDate: {
    fontFamily: "Orbit_400Regular",
    fontSize: 12,
    color: "#111",
    opacity: 0.4,
  },
  matchCountBadge: {
    backgroundColor: "#F0FFD4",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  matchCountText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
  },
  cardProblem: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#111",
    lineHeight: 24,
  },
  cardElders: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    color: "#111",
    opacity: 0.7,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  cardCta: {
    fontFamily: "Orbit_400Regular",
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },
  addBtn: {
    backgroundColor: "#BFFF00",
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#111",
  },
  addBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 15,
    color: "#111",
    fontWeight: "700",
  },
});
