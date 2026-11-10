import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "mood.json");

const defaultState = {
  text: "ще тихо",
  note: "напиши боту свій настрій",
  intensity: 5,
  emoji: "☁️",
  updatedAt: null,
  history: [],
};

let state = structuredClone(defaultState);
const listeners = new Set();

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    state = { ...defaultState, ...JSON.parse(raw) };
  } catch {
    await persist();
  }
}

async function persist() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
}

function notify() {
  for (const listener of listeners) {
    listener(getPublicState());
  }
}

export function getPublicState() {
  return {
    text: state.text,
    note: state.note,
    intensity: state.intensity,
    emoji: state.emoji,
    updatedAt: state.updatedAt,
    history: state.history.slice(0, 12),
  };
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function guessEmoji(text) {
  const value = text.toLowerCase();
  if (/радіс|щасл|happy|good|😊|😄|🔥|✨/.test(value)) return "✨";
  if (/спокі|calm|peace|😌|🌊/.test(value)) return "🌊";
  if (/сумн|sad|down|😢|💙/.test(value)) return "🌧️";
  if (/зл|angry|mad|😤/.test(value)) return "⚡";
  if (/втом|tired|sleep|😴/.test(value)) return "🌙";
  if (/триво|anxious|nerv|😟/.test(value)) return "🌫️";
  if (/любов|love|❤️|💕/.test(value)) return "💗";
  return "☁️";
}

export async function setMood({ text, note = "", intensity = 5, emoji }) {
  const cleanText = String(text || "").trim().slice(0, 120);
  if (!cleanText) {
    throw new Error("Mood text is empty");
  }

  const next = {
    text: cleanText,
    note: String(note || "").trim().slice(0, 280),
    intensity: Math.min(10, Math.max(1, Number(intensity) || 5)),
    emoji: emoji || guessEmoji(cleanText),
    updatedAt: new Date().toISOString(),
  };

  state = {
    ...next,
    history: [
      next,
      ...state.history.filter((item) => item.text !== next.text || item.updatedAt !== next.updatedAt),
    ].slice(0, 30),
  };

  await persist();
  notify();
  return getPublicState();
}

export async function initStore() {
  await ensureStore();
  return getPublicState();
}
