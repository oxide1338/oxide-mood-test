import "./setup-env.js";
import TelegramBot from "node-telegram-bot-api";
import { getPublicState, setMood } from "./store.js";

function formatMood(mood) {
  const when = mood.updatedAt
    ? new Date(mood.updatedAt).toLocaleString("uk-UA", { hour12: false })
    : "ще не оновлювалось";

  return [
    `${mood.emoji} *${mood.text}*`,
    mood.note ? `_${mood.note}_` : null,
    `інтенсивність: ${mood.intensity}/10`,
    `оновлено: ${when}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseMoodMessage(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  // Examples:
  // спокій
  // радість | після кави
  // сумно | дощ за вікном | 3
  // ✨ натхнення | код іде | 8
  const parts = text.split("|").map((part) => part.trim()).filter(Boolean);
  let emoji;
  let moodText = parts[0] || "";
  let note = parts[1] || "";
  let intensity = parts[2];

  const emojiMatch = moodText.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u);
  if (emojiMatch) {
    emoji = emojiMatch[1];
    moodText = emojiMatch[2].trim() || moodText;
  }

  if (parts.length === 2 && /^\d{1,2}$/.test(parts[1])) {
    intensity = parts[1];
    note = "";
  }

  return {
    text: moodText,
    note,
    intensity: intensity ? Number(intensity) : 5,
    emoji,
  };
}

export function startBot({ token, allowedUserId }) {
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }

  const bot = new TelegramBot(token, { polling: true });
  const allowed = allowedUserId ? String(allowedUserId) : null;

  function isAllowed(msg) {
    if (!allowed) return true;
    return String(msg.from?.id) === allowed;
  }

  bot.onText(/\/start/, async (msg) => {
    if (!isAllowed(msg)) {
      await bot.sendMessage(msg.chat.id, "Цей бот приватний.");
      return;
    }

    await bot.sendMessage(
      msg.chat.id,
      [
        "Привіт! Пиши свій настрій — і він зʼявиться на сайті.",
        "",
        "Формати:",
        "• спокій",
        "• радість | після кави",
        "• 🌧️ сумно | дощ | 3",
        "",
        "Команди: /now /help",
      ].join("\n")
    );
  });

  bot.onText(/\/help/, async (msg) => {
    if (!isAllowed(msg)) return;
    await bot.sendMessage(
      msg.chat.id,
      "Надішли текст настрою. Можна додати нотатку та інтенсивність через | :\n`настрій | нотатка | 1-10`",
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/now/, async (msg) => {
    if (!isAllowed(msg)) return;
    const mood = getPublicState();
    await bot.sendMessage(msg.chat.id, formatMood(mood), { parse_mode: "Markdown" });
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    if (!isAllowed(msg)) {
      await bot.sendMessage(msg.chat.id, "Цей бот приватний.");
      return;
    }

    try {
      const parsed = parseMoodMessage(msg.text);
      if (!parsed?.text) {
        await bot.sendMessage(msg.chat.id, "Напиши хоча б сам настрій.");
        return;
      }

      const mood = await setMood(parsed);
      await bot.sendMessage(msg.chat.id, `Оновлено на сайті:\n\n${formatMood(mood)}`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Failed to set mood from Telegram:", error);
      await bot.sendMessage(msg.chat.id, "Не вийшло оновити настрій. Спробуй ще раз.");
    }
  });

  bot.on("polling_error", (error) => {
    console.error("Telegram polling error:", error.message);
  });

  console.log("Telegram bot started");
  return bot;
}
