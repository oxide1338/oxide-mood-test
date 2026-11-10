# moodtracker

Мінімалістична сторінка настрою, яку ти оновлюєш через Telegram-бота.

## Що всередині

- `public/` — сайт (градієнтні теми, live-оновлення)
- `server/` — Express API + Telegram bot
- `data/mood.json` — збережений стан настрою (створюється автоматично)

## Швидкий старт локально

1. Встанови [Node.js 18+](https://nodejs.org/)
2. У корені проєкту:

```bash
npm install
```

3. Скопіюй `.env.example` → `.env` і заповни:

```env
TELEGRAM_BOT_TOKEN=твій_токен
TELEGRAM_ALLOWED_USER_ID=твій_telegram_id
PORT=3000
```

Свій numeric Telegram ID можна дізнатись у [@userinfobot](https://t.me/userinfobot).

4. Запуск:

```bash
npm run dev
```

Відкрий [http://localhost:3000](http://localhost:3000).

## Як писати настрій боту

Просто надішли повідомлення:

- `спокій`
- `радість | після кави`
- `🌧️ сумно | дощ за вікном | 3`

Формат: `настрій | нотатка | інтенсивність(1-10)`

Команди:

- `/start` — підказка
- `/now` — поточний настрій
- `/help` — допомога

## Як це працює

1. Ти пишеш боту в Telegram
2. Бот зберігає настрій у `data/mood.json`
3. Сайт отримує оновлення через Server-Sent Events (`/api/stream`)
4. Сторінка миттєво показує новий настрій без перезавантаження

Сайт і бот працюють **в одному Node-процесі**. Тому потрібен хостинг, де може крутитись довгоживучий Node.js сервер (не чистий статичний GitHub Pages).

## Хостинг (рекомендовано: Render)

### Варіант A — Render (найпростіше)

1. Залий репозиторій на GitHub
2. На [render.com](https://render.com) створи **Web Service**
3. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. У Environment додай:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_USER_ID`
   - `PORT` (Render підставить сам, можна не задавати)
5. Deploy

Після деплою сайт буде на кшталт `https://moodtracker-xxxx.onrender.com`.

> На безкоштовному плані Render сервіс може “засинати”. Бот тоді теж спить, поки хтось не відкриє сайт. Для постійної роботи краще платний інстанс або інший хостинг.

### Варіант B — Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Додай ті самі env змінні
3. Start command: `npm start`

### Варіант C — VPS (Hetzner / DigitalOcean)

```bash
git clone <repo>
cd moodtracker
npm install
# створи .env
npm start
```

Для постійної роботи зручно через `pm2`:

```bash
npm i -g pm2
pm2 start server/index.js --name moodtracker
pm2 save
```

Перед сервісом постав Nginx/Caddy як reverse proxy + HTTPS.

## Безпека

- **Ніколи не коміть `.env`**
- Якщо токен бота світився в чаті/скріні — відразу зроби `/revoke` або новий токен у [@BotFather](https://t.me/BotFather)
- Обовʼязково постав `TELEGRAM_ALLOWED_USER_ID`, інакше будь-хто, хто знайде бота, зможе міняти настрій на сайті

## API

- `GET /api/mood` — поточний стан
- `GET /api/stream` — live SSE стрім
