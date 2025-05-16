import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { getAuth } from "firebase/auth";

import { NativeBaseProvider } from "native-base";
import { Provider } from "react-redux";
// import { PersistGate } from "redux-persist/integration/react";
import { store } from "@/redux/store";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const { currentUser } = getAuth();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (currentUser !== null) {
      console.log("This is running");
      router.push("/(tabs)/Home");
    }

    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded, currentUser, router]);

  if (!loaded) {
    return null;
  }

  return (
    // <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
    <NativeBaseProvider>
      <Provider store={store}>
        {/* <PersistGate loading={null} persistor={persistor}> */}
        <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
        {/* </PersistGate> */}
      </Provider>
    </NativeBaseProvider>
    // </ThemeProvider>
  );
}
