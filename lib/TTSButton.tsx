import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { textToSpeechUri } from "./tts";

function TTSPlayer({
  audioUri,
  onStop,
}: {
  audioUri: string;
  onStop: () => void;
}) {
  const player = useAudioPlayer(audioUri);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.play();
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <View style={styles.player}>
      <Pressable
        style={styles.playBtn}
        onPress={() => (player.playing ? player.pause() : player.play())}
      >
        <Text style={styles.playBtnText}>
          {status.playing ? "⏸" : "▶"}
        </Text>
      </Pressable>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${progress * 100}%` }]}
        />
      </View>
      <Pressable onPress={onStop} hitSlop={8}>
        <Text style={styles.stopText}>✕</Text>
      </Pressable>
    </View>
  );
}

export function TTSButton({
  text,
  label = "Listen",
}: {
  text: string;
  label?: string;
}) {
  const [ttsUri, setTtsUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleListen() {
    if (loading) return;
    setLoading(true);
    try {
      const uri = await textToSpeechUri(text);
      setTtsUri(uri);
    } catch (e) {
      console.error("[tts]", e);
    } finally {
      setLoading(false);
    }
  }

  if (ttsUri) {
    return <TTSPlayer audioUri={ttsUri} onStop={() => setTtsUri(null)} />;
  }

  return (
    <Pressable
      style={styles.listenBtn}
      onPress={handleListen}
      disabled={loading}
    >
      {loading ? (
        <>
          <ActivityIndicator color="#BFFF00" size="small" />
          <Text style={styles.listenBtnText}>generating...</Text>
        </>
      ) : (
        <Text style={styles.listenBtnText}>🔊 {label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listenBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  listenBtnText: {
    fontFamily: "Orbit_400Regular",
    fontSize: 14,
    fontWeight: "700",
    color: "#BFFF00",
  },
  player: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#BFFF00",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnText: {
    fontSize: 16,
    color: "#111",
    marginLeft: 1,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#BFFF00",
    borderRadius: 2,
  },
  stopText: {
    fontSize: 16,
    color: "#666",
  },
});
