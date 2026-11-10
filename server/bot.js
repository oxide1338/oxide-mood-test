import "./setup-env.js";
import TelegramBot from "node-telegram-bot-api";
import {
  getPublicState,
  patchState,
  PRESENCES,
  setMood,
  THEMES,
} from "./store.js";

function formatState(mood) {
  const when = mood.updatedAt
    ? new Date(mood.updatedAt).toLocaleString("uk-UA", { hour12: false })
    : "ще не оновлювалось";

  return [
    `${mood.emoji} *${mood.text}*`,
    mood.note ? `_${mood.note}_` : null,
    `інтенсивність: ${mood.intensity}/10`,
    `${mood.presenceEmoji} статус: ${mood.presenceLabel}`,
    mood.doing ? `зараз: ${mood.doing}` : null,
    mood.listening ? `слухаю: ${mood.listening}` : null,
    mood.signal ? `сигнал: ${mood.signal}` : null,
    `тема: ${mood.theme}`,
    `оновлено: ${when}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseMoodMessage(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

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

function argAfterCommand(text, command) {
  return text.replace(new RegExp(`^/${command}(@\\w+)?\\s*`, "i"), "").trim();
}

export function startBot({ token, allowedUserId }) {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");

  const bot = new TelegramBot(token, { polling: true });
  const allowed = allowedUserId ? String(allowedUserId) : null;

  function isAllowed(msg) {
    if (!allowed) return true;
    return String(msg.from?.id) === allowed;
  }

  async function deny(msg) {
    await bot.sendMessage(msg.chat.id, "Цей бот приватний.");
  }

  async function replyState(chatId, prefix = "Оновлено на сайті") {
    const mood = getPublicState();
    await bot.sendMessage(chatId, `${prefix}:\n\n${formatState(mood)}`, {
      parse_mode: "Markdown",
    });
  }

  bot.onText(/\/start/, async (msg) => {
    if (!isAllowed(msg)) return deny(msg);
    await bot.sendMessage(
      msg.chat.id,
      [
        "Керування live-сторінкою настрою.",
        "",
        "Настрій (звичайне повідомлення):",
        "• спокій",
        "• радість | після кави",
        "• 🌧️ сумно | дощ | 3",
        "",
        "Інше:",
        "• /doing коджу",
        "• /listen Radiohead — Weird Fishes",
        "• /status focus",
        "• /signal сьогодні тихо",
        "• /theme ember",
        "• /now",
      ].join("\n")
    );
  });

  bot.onText(/\/help/, async (msg) => {
    if (!isAllowed(msg)) return;
    await bot.sendMessage(
      msg.chat.id,
      [
        "`настрій | нотатка | 1-10`",
        "`/doing текст` — що зараз робиш",
        "`/listen трек` — що слухаєш",
        "`/status free|focus|away|sleep`",
        "`/signal текст` — короткий сигнал на сайт",
        "`/theme " + THEMES.join("|") + "`",
        "`/clear doing|listening|signal|all`",
        "`/now` — поточний стан",
      ].join("\n"),
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/now/, async (msg) => {
    if (!isAllowed(msg)) return;
    await replyState(msg.chat.id, "Зараз на сайті");
  });

  bot.onText(/\/doing(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    if (!isAllowed(msg)) return deny(msg);
    const value = (match?.[1] || argAfterCommand(msg.text, "doing")).trim();
    if (!value) {
      await bot.sendMessage(msg.chat.id, "Приклад: /doing коджу pet-проєкт");
      return;
    }
    await patchState({ doing: value });
    await replyState(msg.chat.id);
  });

  bot.onText(/\/listen(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    if (!isAllowed(msg)) return deny(msg);
    const value = (match?.[1] || argAfterCommand(msg.text, "listen")).trim();
    if (!value) {
      await bot.sendMessage(msg.chat.id, "Приклад: /listen Aphex Twin — Xtal");
      return;
    }
    await patchState({ listening: value });
    await replyState(msg.chat.id);
  });

  bot.onText(/\/signal(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    if (!isAllowed(msg)) return deny(msg);
    const value = (match?.[1] || argAfterCommand(msg.text, "signal")).trim();
    if (!value) {
      await bot.sendMessage(msg.chat.id, "Приклад: /signal назад через годину");
      return;
    }
    await patchState({ signal: value });
    await replyState(msg.chat.id);
  });

  bot.onText(/\/status(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    if (!isAllowed(msg)) return deny(msg);
    const value = (match?.[1] || argAfterCommand(msg.text, "status")).trim().toLowerCase();
    if (!PRESENCES[value]) {
      await bot.sendMessage(
        msg.chat.id,
        `Варіанти: ${Object.keys(PRESENCES).join(", ")}`
      );
      return;
    }
    await patchState({ presence: value });
    await replyState(msg.chat.id);
  });

  bot.onText(/\/theme(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    if (!isAllowed(msg)) return deny(msg);
    const value = (match?.[1] || argAfterCommand(msg.text, "theme")).trim().toLowerCase();
    if (!THEMES.includes(value)) {
      await bot.sendMessage(msg.chat.id, `Варіанти: ${THEMES.join(", ")}`);
      return;
    }
    await patchState({ theme: value });
    await replyState(msg.chat.id);
  });

  bot.onText(/\/clear(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
    if (!isAllowed(msg)) return deny(msg);
    const target = (match?.[1] || argAfterCommand(msg.text, "clear") || "all")
      .trim()
      .toLowerCase();

    if (target === "doing") await patchState({ doing: "" });
    else if (target === "listening") await patchState({ listening: "" });
    else if (target === "signal") await patchState({ signal: "" });
    else if (target === "all") await patchState({ doing: "", listening: "", signal: "" });
    else {
      await bot.sendMessage(msg.chat.id, "Варіанти: doing, listening, signal, all");
      return;
    }

    await replyState(msg.chat.id, "Очищено");
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    if (!isAllowed(msg)) return deny(msg);

    try {
      const parsed = parseMoodMessage(msg.text);
      if (!parsed?.text) {
        await bot.sendMessage(msg.chat.id, "Напиши хоча б сам настрій.");
        return;
      }
      await setMood(parsed);
      await replyState(msg.chat.id);
    } catch (error) {
      console.error("Failed to set mood from Telegram:", error);
      await bot.sendMessage(msg.chat.id, "Не вийшло оновити. Спробуй ще раз.");
    }
  });

  bot.on("polling_error", (error) => {
    console.error("Telegram polling error:", error.message);
  });

  console.log("Telegram bot started");
  return bot;
}
