# Auth setup

The app uses Supabase Auth for real user accounts.

## Supabase Auth settings

In Supabase Dashboard:

1. Open Authentication -> URL Configuration.
2. Set Site URL:
   - `https://pobeg-studentov.vercel.app`
3. Add Redirect URLs:
   - `https://pobeg-studentov.vercel.app`
   - `http://localhost:5173`

## Email/password

Email/password auth works through Supabase Auth. Keep email confirmation enabled for production if you want verified contacts.

## Google sign-in

To enable the "Войти через Google" button:

1. Create an OAuth Client in Google Cloud Console.
2. Add the Supabase callback URL from Authentication -> Providers -> Google.
3. Copy Google Client ID and Client Secret into Supabase Google provider settings.
4. Enable the Google provider.

## Stored user data

The app stores public game data in `leaderboard_scores`:

- `user_id`
- `player_name`
- `score`
- `stars`

The app stores private contact/profile data in `player_profiles`:

- `user_id`
- `nickname`
- `telegram`
- `email`

RLS allows users to read/update only their own profile. Public leaderboard reads do not expose email or Telegram.
