import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startBot } from "./bot.js";
import { getPublicState, initStore, subscribe } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/mood", (_req, res) => {
  res.json(getPublicState());
});

app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send(getPublicState());
  const unsubscribe = subscribe(send);

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

await initStore();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

const allowedUserId = String(process.env.TELEGRAM_ALLOWED_USER_ID || "").trim();

if (!/^\d+$/.test(allowedUserId)) {
  console.error(
    "TELEGRAM_ALLOWED_USER_ID must be your numeric Telegram user id (from @userinfobot), not a @username."
  );
  process.exit(1);
}

startBot({
  token: process.env.TELEGRAM_BOT_TOKEN,
  allowedUserId,
});

app.listen(port, host, () => {
  console.log(`Mood site: http://localhost:${port}`);
});
