import assert from "node:assert/strict";
import test from "node:test";

import { runTopicGeneration, type TopicGenerationPhase } from "./topic-generation-progress.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("keeps topic generation progress active until topics finish", async () => {
  const strategy = deferred<void>();
  const topics = deferred<string[]>();
  const phases: Array<TopicGenerationPhase> = [];

  const running = runTopicGeneration({
    saveStrategy: () => strategy.promise,
    generateTopics: () => topics.promise,
    onPhase: (phase) => phases.push(phase),
  });

  assert.deepEqual(phases, ["preparing"]);

  strategy.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(phases, ["preparing", "generating"]);

  topics.resolve(["topic 1", "topic 2"]);
  assert.deepEqual(await running, ["topic 1", "topic 2"]);
  assert.deepEqual(phases, ["preparing", "generating", null]);
});

test("clears topic generation progress when a request fails", async () => {
  const phases: Array<TopicGenerationPhase> = [];

  await assert.rejects(() => runTopicGeneration({
    saveStrategy: async () => undefined,
    generateTopics: async () => { throw new Error("request failed"); },
    onPhase: (phase) => phases.push(phase),
  }), /request failed/);

  assert.deepEqual(phases, ["preparing", "generating", null]);
});
