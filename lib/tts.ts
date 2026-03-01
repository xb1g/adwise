import { File, Paths } from "expo-file-system";

const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? "";
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function textToSpeechUri(text: string): Promise<string> {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
      }),
    }
  );

  if (!resp.ok) throw new Error(`TTS error ${resp.status}`);

  const blob = await resp.blob();
  const base64 = await blobToBase64(blob);

  const file = new File(Paths.cache, `tts_${Date.now()}.mp3`);
  file.create();
  file.write(base64, { encoding: "base64" });

  return file.uri;
}
