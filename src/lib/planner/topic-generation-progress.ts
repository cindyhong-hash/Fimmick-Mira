export type TopicGenerationPhase = "preparing" | "generating" | null;

export async function runTopicGeneration<T>({
  saveStrategy,
  generateTopics,
  onPhase,
}: {
  saveStrategy: () => Promise<void>;
  generateTopics: () => Promise<T>;
  onPhase: (phase: TopicGenerationPhase) => void;
}): Promise<T> {
  onPhase("preparing");
  try {
    await saveStrategy();
    onPhase("generating");
    return await generateTopics();
  } finally {
    onPhase(null);
  }
}
