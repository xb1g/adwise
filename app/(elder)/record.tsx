import { View, Text, StyleSheet } from "react-native";

export default function ElderRecord() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record your story</Text>
      <Text style={styles.subtitle}>Voice recording coming soon.</Text>
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
    fontSize: 28,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Orbit_400Regular",
    color: "#111",
    opacity: 0.5,
  },
});
