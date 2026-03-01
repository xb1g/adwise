import { supabase } from "./supabase";
import { UserProfile } from "./auth";

export type SmartGradeResult = {
  score: number;
  scores: {
    specific: number;
    measurable: number;
    achievable: number;
    relevant: number;
    time_bound: number;
  };
  tips: {
    specific: string | null;
    measurable: string | null;
    achievable: string | null;
    relevant: string | null;
    time_bound: string | null;
  };
};

export type GoalParseResult = {
  frequencyCount: number | null;
  frequencyUnit: "day" | "week" | "month" | null;
  durationValue: string | null;
  humanReadable: string | null;
};

export type RealityCheckResult = {
  likelihood: number;
  pitfalls: string[];
  suggestions: string[];
};

export type OnboardingMessage = {
  topic: string;
  answer: string;
  followUpAnswer: string;
};

export type ExtractedProfile = {
  lifeAreas: string[];
  direction: string;
  values: string;
  blockers: string;
  weeklyHours: number;
};

export type OnboardingChatHistoryItem = {
  role: "user" | "model";
  text: string;
};

export type OnboardingChatResponse =
  | { type: "message"; text: string }
  | { type: "done"; text: string; profile: ExtractedProfile };

export async function onboardingChat(
  history: OnboardingChatHistoryItem[],
  message: string
): Promise<OnboardingChatResponse> {
  const { data, error } = await supabase.functions.invoke("onboarding-chat", {
    body: { history, message },
  });
  if (error) throw error;
  return data as OnboardingChatResponse;
}

export async function gradeGoal(params: {
  goalText: string;
  proofTypes?: string[];
  proofDescription?: string;
  userProfile?: Pick<UserProfile, "life_areas" | "direction" | "values"> | null;
  parsedFrequency?: string | null;
}): Promise<SmartGradeResult> {
  const { data, error } = await supabase.functions.invoke("smart-grade", {
    body: {
      goalText: params.goalText,
      proofTypes: params.proofTypes ?? [],
      proofDescription: params.proofDescription ?? "",
      userProfile: params.userProfile
        ? {
            lifeAreas: params.userProfile.life_areas,
            direction: params.userProfile.direction,
            values: params.userProfile.values,
          }
        : null,
      parsedFrequency: params.parsedFrequency ?? null,
    },
  });
  if (error) throw error;
  return data as SmartGradeResult;
}

export async function parseGoal(goalText: string): Promise<GoalParseResult> {
  const { data, error } = await supabase.functions.invoke("goal-parse", {
    body: { goalText },
  });
  if (error) throw error;
  return data as GoalParseResult;
}

export async function realityCheck(params: {
  goalText: string;
  proofTypes: string[];
  parsedFrequency: string | null;
}): Promise<RealityCheckResult> {
  const { data, error } = await supabase.functions.invoke("reality-check", {
    body: params,
  });
  if (error) throw error;
  return data as RealityCheckResult;
}

export async function onboardingFollowUp(
  topic: string,
  answer: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("onboarding-followup", {
    body: { topic, answer },
  });
  if (error) throw error;
  return (data as { followUp: string }).followUp;
}

export async function onboardingExtract(
  messages: OnboardingMessage[]
): Promise<ExtractedProfile> {
  const { data, error } = await supabase.functions.invoke("onboarding-extract", {
    body: { messages },
  });
  if (error) throw error;
  return data as ExtractedProfile;
}

// --- Wisdom Marketplace ---

export type StoryStructure = {
  life_areas: string[];
  key_topics: string[];
  wisdom_snippets: string[];
  preview_text: string;
  bio: string;
  tags: string[];
};

export type MatchResult = {
  elder_id: string;
  story_id: string;
  rank: number;
  match_reason: string;
};

export async function transcribeAudio(audioBase64: string, mimeType = "audio/m4a"): Promise<string> {
  const { data, error } = await supabase.functions.invoke("transcribe", {
    body: { audioBase64, mimeType },
  });
  if (error) throw error;
  return (data as { transcript: string }).transcript;
}

export async function structureStory(transcript: string): Promise<StoryStructure> {
  const { data, error } = await supabase.functions.invoke("structure-story", {
    body: { transcript },
  });
  if (error) throw error;
  return data as StoryStructure;
}

export async function matchElders(problemText: string, seekerId?: string): Promise<MatchResult[]> {
  const { data, error } = await supabase.functions.invoke("match", {
    body: { problemText, seekerId },
  });
  if (error) throw error;
  return (data as { matches: MatchResult[] }).matches;
}

// --- Brainstorm ---

export type BrainstormSummary = {
  problem_text: string;
  categories: string[];
};

export async function summarizeBrainstorm(
  messages: { role: string; text: string }[]
): Promise<BrainstormSummary> {
  const { data, error } = await supabase.functions.invoke("summarize-brainstorm", {
    body: { messages },
  });
  if (error) throw error;
  return data as BrainstormSummary;
}
