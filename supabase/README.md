# Supabase setup

1. Copy the project URL and publishable/anon key into a local `.env` using `.env.example` as the template.
2. Apply the migrations with `npx supabase db push` after linking the CLI to the project.
3. Enable email/password authentication and configure email-confirmation redirects.
4. Configure a RevenueCat project with an entitlement named `premium`, monthly and annual store products, and a current offering containing monthly and yearly packages. Use the Supabase Auth UUID as the RevenueCat app user ID.
5. Add the RevenueCat Apple and Google public SDK keys to `.env`, configure the RevenueCat webhook to call `/functions/v1/revenuecat-webhook`, and set its Bearer secret as `REVENUECAT_WEBHOOK_SECRET` in Supabase Functions secrets.
6. Set provider credentials as Supabase Function secrets, never in the mobile app's `.env` file:

   ```sh
   npx supabase secrets set AI_CHAT_COMPLETIONS_URL="https://YOUR_PROVIDER/v1/chat/completions" AI_PROVIDER_API_KEY="YOUR_SERVER_SIDE_KEY" AI_PROVIDER_MODEL="YOUR_MODEL" REVENUECAT_WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET"
   ```

   The AI function uses an OpenAI-compatible chat-completions endpoint, so you can choose the provider later.

7. Deploy the two Edge Functions:

   ```sh
   npx supabase functions deploy relationship-coach
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   ```

8. Build and install the native iOS/Android app before testing store purchases. Store billing is unavailable in simulators without configured store test accounts.

The app uses separate `messages` rows with server-generated UUIDs. A message insert is independent from other inserts, so simultaneous sends do not replace one another. The database trigger increments the sender's score atomically. The app subscribes to changes for the active couple, initially loads the latest 50 rows, and fetches older pages as needed.

Migration `202610280003_reconnect_previous_couple.sql` reactivates the most recent ended couple when those exact two accounts pair again. Since messages and other shared records stay attached to that couple ID, their prior conversation and shared history return. Couple data and private media are readable only while the pairing is active. This applies to data already stored in Supabase; Firebase records still need a separate import.

All app features are available without a paid entitlement. RevenueCat webhooks may continue syncing existing subscriptions for account management, but quiz image uploads, quiz creation, and the relationship coach do not require an active subscription. The relationship coach still requires an active couple and both partners' consent before shared messages or profile context are used. Each request sends the couple's bios, the user's question, and up to 30 recent shared messages to the configured AI provider; prompts and answers are not stored by the app.

## Existing Firebase data

This migration creates the new schema; it does not copy production Firebase records or Firebase Auth accounts. Before switching real users, export Firestore collections and Storage objects, map old Firebase UIDs to new Supabase Auth UUIDs, transform embedded message/memory/quiz arrays into rows, and validate counts and ownership. Firebase password hashes cannot simply be copied into Supabase Auth through this app; plan an account relinking or password reset flow. Keep the existing Firebase project available until the export and cutover are verified.

The old Firebase project settings are preserved in `utils/legacy-firebase-config.json` for the legacy export/cutover period. New app screens use Supabase.

## Shared everyday tools

Migration `202610310001_shared_life_tools.sql` adds the couple-only shared-space screen: presence/status check-ins, local timezone clocks, a shared calendar for work shifts and plans, future goals, pinned notes/checklists, watch and playlist links, an append-safe realtime sketchboard, and a basic period start/end log. Period logs are private to each account by default; each person can separately opt in to sharing their dates with their current partner. The database enforces this with row-level security.

Migration `202611010002_cycle_tracker_customization.sql` allows an opted-in partner to add or edit cycle entries. Migration `202611010004_period_cycle_timestamps.sql` adds timezone-aware start and end instants and each person's cycle-tracking preference while preserving existing date-only records. Apply migrations with `npx supabase db push` before using the updated cycle tracker.

Migration `202611030001_add_tracks_periods_preference.sql` adds the period-tracking preference for projects that already applied `202611010004` before that column was added to the app. Existing users with shared or logged cycle data are opted in during the backfill; new preferences default to off.

The notes/checklists are ordinary shared database text and are not end-to-end encrypted. The watch/listen section saves links and opens the selected service; it does not synchronize playback or share screens. This migration is still couple-scoped; it does not create family workspaces.

Migration `202611020001_daily_snap_streak.sql` adds 24-hour couple-only photo snaps and date-only streak history. Deploy `npx supabase functions deploy expire-daily-snaps` and schedule that Edge Function to run every 15 minutes with an `Authorization: Bearer <service-role-key>` header. The app also invokes cleanup when Everyday Together opens and when an on-screen snap expires; the schedule removes expired storage files even when neither partner opens the app. Never put the service-role key in the mobile app.
