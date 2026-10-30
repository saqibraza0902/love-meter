import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { useAppDispatch } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { setPartner, setUser } from "@/redux/slices/user-slice";
import { ToastProvider } from "@/providers/toast-provider";
import { store } from "@/redux/store";
import { supabase } from "@/utils/supabase";
import { navigationRef, setRootNavigation } from "@/navigation/router-compat";
import { getActiveCouple } from "@/utils/supabase";
import Login from "@/app/login";
import Signup from "@/app/signup";
import Home from "@/app/(tabs)/Home/index";
import Chats from "@/app/(tabs)/Home/Chats";
import Memories from "@/app/(tabs)/Home/Memories";
import Quizzes from "@/app/(tabs)/Home/Quizzes/Quizes";
import CreateQuiz from "@/app/(tabs)/Home/Quizzes/CreateQuiz";
import QuizDetails from "@/app/(tabs)/Home/Quizzes/QuizDetails";
import Things from "@/app/(tabs)/Home/Things/index";
import ThingDetails from "@/app/(tabs)/Home/Things/[slug]";
import AddTTDT from "@/app/(tabs)/Home/Things/AddTTDT";
import Settings from "@/app/(tabs)/Settings/index";
import Payment from "@/app/(tabs)/Settings/Payment";
import PrivacyPolicy from "@/app/(tabs)/Settings/PrivacyPolicy";
import TermsCondition from "@/app/(tabs)/Settings/TermsCondition";
import AIHelp from "@/app/(tabs)/Home/AIHelp";
import SendRequest from "@/app/(tabs)/sendReq";
import ViewRequests from "@/app/(tabs)/viewReq";

const Stack = createNativeStackNavigator();
const screens = [
  ["Login", Login], ["Signup", Signup], ["Home", Home],
  ["Chats", Chats], ["Memories", Memories], ["Quizzes", Quizzes],
  ["CreateQuiz", CreateQuiz], ["QuizDetails", QuizDetails], ["Things", Things],
  ["ThingDetails", ThingDetails], ["AddTTDT", AddTTDT], ["Settings", Settings],
  ["Payment", Payment], ["PrivacyPolicy", PrivacyPolicy], ["TermsCondition", TermsCondition],
  ["AIHelp", AIHelp], ["SendRequest", SendRequest], ["ViewRequests", ViewRequests],
] as const;

function AppNavigator() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const [initialRoute, setInitialRoute] = useState<"Login" | "Home" | null>(null);

  const hydrateAccount = useCallback(async (userId: string) => {
    const [profileResult, couple, entitlementResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      getActiveCouple(userId),
      supabase.from("entitlements").select("active").eq("user_id", userId).maybeSingle(),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (entitlementResult.error) throw entitlementResult.error;

    const profile = profileResult.data;
    dispatch(setUser({
      ...profile,
      photoURL: profile.photo_path,
      paid: !!entitlementResult.data?.active,
      partnerId: couple?.partner.id || "",
      isPaired: !!couple,
      coupleId: couple?.id,
    } as any));
    dispatch(setPartner(couple ? {
      ...couple.partner,
      photoURL: couple.partner.photo_path,
      partnerId: userId,
      isPaired: true,
      coupleId: couple.id,
    } as any : null));
  }, [dispatch]);

  useEffect(() => {
    let mounted = true;
    let accountChannel: ReturnType<typeof supabase.channel> | null = null;
    const clearAccount = () => {
      if (accountChannel) void supabase.removeChannel(accountChannel);
      accountChannel = null;
      dispatch(setPartner(null));
      dispatch(setUser(null));
    };
    const subscribeToPairChanges = (userId: string) => {
      if (accountChannel) void supabase.removeChannel(accountChannel);
      accountChannel = supabase.channel(`account:${userId}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "couple_members", filter: `user_id=eq.${userId}`,
        }, () => { setTimeout(() => { if (mounted) void hydrateAccount(userId).catch((error) => console.warn("Could not refresh account state", error)); }, 0); })
        .subscribe();
    };
    const activateSession = async (userId: string, resetNavigation: boolean): Promise<boolean> => {
      try {
        await hydrateAccount(userId);
        if (!mounted) return false;
        subscribeToPairChanges(userId);
        if (resetNavigation && navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: "Home" }] });
        return true;
      } catch (error) {
        console.warn("Could not hydrate signed-in account", error);
        if (!mounted) return false;
        clearAccount();
        if (resetNavigation && navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
        toast("Couldn't load your profile. Please try again.");
        void supabase.auth.signOut();
        return false;
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session) {
        // Defer Supabase queries until its auth callback has released the auth lock.
        setTimeout(() => { if (mounted) void activateSession(session.user.id, true); }, 0);
      } else if (event === "SIGNED_OUT") {
        clearAccount();
        if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    });
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) throw error;
      if (data.session) {
        const loaded = await activateSession(data.session.user.id, false);
        if (mounted) setInitialRoute(loaded ? "Home" : "Login");
      } else {
        clearAccount();
        if (mounted) setInitialRoute("Login");
      }
    }).catch((error) => {
      console.warn("Could not restore the current session", error);
      if (mounted) {
        setInitialRoute("Login");
        toast("Couldn't restore your session. Please sign in again.");
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      if (accountChannel) void supabase.removeChannel(accountChannel);
    };
  }, [dispatch, hydrateAccount, toast]);

  return (
    <NavigationContainer ref={navigationRef} onReady={setRootNavigation}>
      {initialRoute ? <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        {screens.map(([name, component]) => <Stack.Screen key={name} name={name} component={component} />)}
      </Stack.Navigator> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f2eb" }}>
        <ActivityIndicator color="#a65f65" />
      </View>}
    </NavigationContainer>
  );
}

export default function App() {
  return <SafeAreaProvider><Provider store={store}><ToastProvider><StatusBar barStyle="dark-content" /><AppNavigator /></ToastProvider></Provider></SafeAreaProvider>;
}
