import { createNavigationContainerRef, useNavigation, useRoute } from "@react-navigation/native";
import { useMemo } from "react";
export { useFocusEffect } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();
export function setRootNavigation() { /* NavigationContainer installs the ref */ }

const routes: Record<string, string> = {
  "": "Login", index: "Login", login: "Login", signup: "Signup",
  "(tabs)/Home": "Home", "(tabs)/Home/index": "Home", "(tabs)/Home/Chats": "Chats",
  "(tabs)/Home/Memories": "Memories", "(tabs)/Home/Quizzes/Quizes": "Quizzes",
  "(tabs)/Home/Quizzes": "Quizzes", "(tabs)/Home/Quizzes/CreateQuiz": "CreateQuiz",
  "(tabs)/Home/Quizzes/QuizDetails": "QuizDetails", "(tabs)/Home/Things": "Things",
  "(tabs)/Home/Things/AddTTDT": "AddTTDT", "(tabs)/Settings": "Settings",
  "(tabs)/Settings/index": "Settings", "(tabs)/Settings/Payment": "Payment",
  "(tabs)/Settings/PrivacyPolicy": "PrivacyPolicy", "(tabs)/Settings/TermsCondition": "TermsCondition",
  "(tabs)/Home/AIHelp": "AIHelp", "(tabs)/sendReq": "SendRequest", "(tabs)/viewReq": "ViewRequests",
};

function resolve(path: string) {
  const clean = path.replace(/^\//, "").replace(/\.(tsx?|jsx?)$/, "").replace(/\\/g, "/");
  const normalized = clean.startsWith("(tabs)/") || !clean.includes("/") ? clean : `(${clean}`;
  const name = routes[clean] || routes[normalized];
  if (name) return { name, params: {} as Record<string, unknown> };
  const thing = clean.match(/\(tabs\)\/Home\/Things\/([^/]+)$/);
  if (thing) return { name: "ThingDetails", params: { slug: thing[1] } };
  return { name: "Home", params: {} };
}

export function useRouter() {
  const navigation = useNavigation<any>();
  return useMemo(() => ({
    push: (target: string | { pathname: string; params?: Record<string, unknown> }) => {
      const resolved = resolve(typeof target === "string" ? target : target.pathname);
      navigation.navigate(resolved.name, { ...resolved.params, ...(typeof target === "string" ? {} : target.params) });
    },
    replace: (target: string) => { const { name, params } = resolve(target); navigation.replace(name, params); },
    back: () => navigation.goBack(),
    canGoBack: () => navigation.canGoBack(),
  }), [navigation]);
}

export function useLocalSearchParams<T extends Record<string, string | string[] | undefined> = Record<string, string | string[] | undefined>>() {
  return (useRoute<any>().params || {}) as T;
}
