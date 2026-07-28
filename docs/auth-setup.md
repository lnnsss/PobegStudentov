# Telegram Mini App auth setup

The app uses Telegram Mini App identity. The browser client sends raw `window.Telegram.WebApp.initData` to the Supabase Edge Function `telegram-auth`; the function verifies the signature with the bot token before it reads or writes profile and leaderboard data.

## Telegram bot

1. Create or open the bot in BotFather.
2. Configure the Mini App URL to the deployed site, for example:
   - `https://pobeg-studentov.vercel.app`
3. Keep the bot token private. Do not expose it in Vite env vars.

## Telegram /start webhook

The `telegram-webhook` Edge Function answers `/start` in the bot chat with a short hint:

> Чтобы запустить игру, нажми **«Играть»** слева снизу.  
> Она работает только внутри Telegram Mini App.

Deploy the function and set the bot secrets:

```sh
supabase functions deploy telegram-webhook
supabase secrets set TELEGRAM_BOT_TOKEN=<bot-token> TELEGRAM_WEBHOOK_SECRET=<random-secret>
```

Connect Telegram to the deployed function:

```sh
curl "https://api.telegram.org/bot<bot-token>/setWebhook" \
  -d "url=https://<project-ref>.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=<random-secret>"
```

For this linked Supabase project, the webhook URL is:

```text
https://uqwbfujabjfuqojnzxyb.supabase.co/functions/v1/telegram-webhook
```

## Supabase

Apply the database migrations, then deploy the Edge Function:

```sh
supabase functions deploy telegram-auth
supabase secrets set TELEGRAM_BOT_TOKEN=<bot-token>
```

The Edge Function also expects the standard Supabase runtime secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Stored user data

The app stores public game data in `leaderboard_scores`:

- `telegram_id`
- `player_name`
- `score`
- `stars`

The app stores private/contact profile data in `player_profiles`:

- `telegram_id`
- `nickname`
- `telegram`
- `telegram_username`
- `telegram_first_name`
- `telegram_photo_url`

Old leaderboard rows remain readable. New submissions are tied to `telegram_id`.

## Local development

Normal browser tabs do not have `window.Telegram.WebApp.initData`, so login will show an “open in Telegram” message. For local-only testing you may set `VITE_TELEGRAM_DEV_INIT_DATA` to a real signed Telegram initData string from your bot session. Leave it empty in production.
