import { View, Text, Pressable, StyleSheet, SafeAreaView } from "react-native";
import { router } from "expo-router";

export default function MySessions() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>My{"\n"}Sessions</Text>
        <Text style={styles.subtitle}>Coming soon — your active conversations will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FDFFF5" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  back: { marginBottom: 36 },
  backText: { fontFamily: "Orbit_400Regular", fontSize: 20, color: "#111", fontWeight: "900" },
  title: { fontFamily: "Orbit_400Regular", fontSize: 44, color: "#111", fontWeight: "900", lineHeight: 52, marginBottom: 20 },
  subtitle: { fontFamily: "Orbit_400Regular", fontSize: 22, color: "#111", fontWeight: "900", lineHeight: 34 },
});
