# Love Meter (React Native CLI)

This is the bare React Native Community CLI version of Love Meter. It keeps the existing screens and flows, Supabase Auth/Postgres/Realtime/Storage backend, shared chats, quizzes, memories, pairing, AI relationship guide, and RevenueCat subscriptions. Navigation is handled by React Navigation with a full-screen stack and no bottom tab bar.

## Android setup

1. Install Node.js 22.11 or newer, JDK 17, Android Studio, and Android SDK Platform Tools.
2. Configure `JAVA_HOME` and `ANDROID_HOME`, then enable USB debugging and authorize this computer on the Android phone.
3. Copy `.env.example` to `.env` and supply the Supabase URL/public key plus RevenueCat public SDK keys.
4. Run `npm install`, then `npm start` in one terminal and `npm run android` in another.
5. Check `adb devices` if the phone is not detected.

## iOS setup

Use macOS with Xcode and CocoaPods. Open `ios/LoveMeter.xcodeproj` or run `npm run ios` after `npm install` and `pod install`.

## Backend

The `supabase/` migrations and Edge Functions are unchanged. Apply migrations and deploy functions using the Supabase CLI as described in `supabase/README.md`. Keep service role keys and AI provider secrets on the server only.
