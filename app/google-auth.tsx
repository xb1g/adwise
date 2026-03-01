import { View, ActivityIndicator } from "react-native";

// Catch-all for the OAuth redirect (com.bunyasit.adwise://google-auth#...).
// _layout.tsx handles navigation once auth state resolves.
export default function GoogleAuthRedirect() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FDFFF5" }}>
      <ActivityIndicator size="large" color="#9FE800" />
    </View>
  );
}
