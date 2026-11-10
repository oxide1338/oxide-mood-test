import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "mood.json");

export const THEMES = ["lagoon", "ember", "moss", "ink", "bloom"];
export const PRESENCES = {
  free: { label: "вільний", emoji: "🟢" },
  focus: { label: "у фокусі", emoji: "🟡" },
  away: { label: "відійшов", emoji: "🟠" },
  sleep: { label: "спить", emoji: "🔵" },
};

const defaultState = {
  text: "ще тихо",
  note: "напиши боту свій настрій",
  intensity: 5,
  emoji: "☁️",
  presence: "free",
  doing: "",
  listening: "",
  signal: "",
  theme: "lagoon",
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
    if (!THEMES.includes(state.theme)) state.theme = "lagoon";
    if (!PRESENCES[state.presence]) state.presence = "free";
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

function touch() {
  state.updatedAt = new Date().toISOString();
}

export function getPublicState() {
  const presence = PRESENCES[state.presence] || PRESENCES.free;
  return {
    text: state.text,
    note: state.note,
    intensity: state.intensity,
    emoji: state.emoji,
    presence: state.presence,
    presenceLabel: presence.label,
    presenceEmoji: presence.emoji,
    doing: state.doing,
    listening: state.listening,
    signal: state.signal,
    theme: state.theme,
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
  if (!cleanText) throw new Error("Mood text is empty");

  const next = {
    text: cleanText,
    note: String(note || "").trim().slice(0, 280),
    intensity: Math.min(10, Math.max(1, Number(intensity) || 5)),
    emoji: emoji || guessEmoji(cleanText),
    updatedAt: new Date().toISOString(),
  };

  state = {
    ...state,
    ...next,
    history: [next, ...state.history].slice(0, 30),
  };

  await persist();
  notify();
  return getPublicState();
}

export async function patchState(partial) {
  const next = { ...state };

  if (partial.doing !== undefined) {
    next.doing = String(partial.doing || "").trim().slice(0, 120);
  }
  if (partial.listening !== undefined) {
    next.listening = String(partial.listening || "").trim().slice(0, 120);
  }
  if (partial.signal !== undefined) {
    next.signal = String(partial.signal || "").trim().slice(0, 160);
  }
  if (partial.presence !== undefined) {
    const key = String(partial.presence || "").trim().toLowerCase();
    if (!PRESENCES[key]) throw new Error("Unknown presence");
    next.presence = key;
  }
  if (partial.theme !== undefined) {
    const theme = String(partial.theme || "").trim().toLowerCase();
    if (!THEMES.includes(theme)) throw new Error("Unknown theme");
    next.theme = theme;
  }

  state = next;
  touch();
  await persist();
  notify();
  return getPublicState();
}

export async function initStore() {
  await ensureStore();
  return getPublicState();
}
