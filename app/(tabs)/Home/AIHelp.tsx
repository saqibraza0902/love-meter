import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { supabase } from "@/utils/supabase";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "@/navigation/router-compat";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const AIHelpScreen = () => {
  const router = useRouter();
  const { user, partner } = useAppSelector((state) => state.user);
  const { toast } = useToast();
  const [consented, setConsented] = useState(!!user?.ai_consent_at);
  const [savingConsent, setSavingConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => setConsented(!!user?.ai_consent_at), [user?.ai_consent_at]);

  const updateConsent = async (nextValue: boolean) => {
    if (!user?.id) return;
    setSavingConsent(true);
    const { error } = await supabase.from("profiles").update({ ai_consent_at: nextValue ? new Date().toISOString() : null }).eq("id", user.id);
    setSavingConsent(false);
    if (error) return toast("We couldn't update your consent. Please try again.");
    setConsented(nextValue);
    if (!nextValue) setAnswer("");
  };

  const askCoach = async () => {
    if (!question.trim() || asking) return;
    try {
      setAsking(true);
      setAnswer("");
      const { data, error } = await supabase.functions.invoke("relationship-coach", { body: { question: question.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnswer(data?.answer || "I couldn't prepare an answer just now. Please try again.");
    } catch (error: any) {
      toast(error.message || "Relationship help is unavailable right now.");
    } finally { setAsking(false); }
  };

  const bothConsented = consented && !!partner?.ai_consent_at;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color="#554b43" /><Text style={styles.backText}>Back</Text></TouchableOpacity>
        <View style={styles.heroIcon}><Ionicons name="sparkles" size={27} color="#a65f65" /></View>
        <Text style={styles.title}>A little help, when you need it</Text>
        <Text style={styles.subtitle}>Ask for a thoughtful perspective, a conversation starter, or a small way to reconnect.</Text>

        {!user?.paid ? <View style={styles.membershipCard}>
          <Text style={styles.cardTitle}>A membership feature</Text>
          <Text style={styles.body}>The relationship guide is included with membership. Your everyday app features remain free.</Text>
          <TouchableOpacity style={styles.membershipButton} onPress={() => router.push("/(tabs)/Settings/Payment")}><Text style={styles.membershipButtonText}>See membership options</Text></TouchableOpacity>
        </View> : <>
          <View style={styles.consentCard}>
            <Text style={styles.cardTitle}>Shared context is optional</Text>
            <Text style={styles.body}>With both partnersâ€™ permission, the guide can use your profile bios and up to 30 recent shared messages to shape its suggestions. It does not save your questions or answers in the app.</Text>
            <View style={styles.consentRow}>
              <View style={{ flex: 1 }}><Text style={styles.consentTitle}>Allow AI context for me</Text><Text style={styles.consentStatus}>{consented ? "Youâ€™ve opted in" : "You have not opted in"}</Text></View>
              {savingConsent ? <ActivityIndicator color="#a65f65" /> : <Switch value={consented} onValueChange={updateConsent} trackColor={{ false: "#d7cec4", true: "#b9cbbd" }} thumbColor={consented ? "#6d8777" : "#fffdfa"} />}
            </View>
            {!partner?.ai_consent_at && <View style={styles.waitingRow}><Ionicons name="time-outline" size={17} color="#8d735e" /><Text style={styles.waitingText}>Your partner also needs to opt in before shared messages can be used.</Text></View>}
          </View>

          {bothConsented ? <>
            <View style={styles.askCard}>
              <Text style={styles.cardTitle}>Whatâ€™s on your mind?</Text>
              <TextInput style={styles.questionInput} multiline maxLength={2000} value={question} onChangeText={setQuestion} placeholder="For example: How can I bring up feeling disconnected without sounding critical?" placeholderTextColor="#9a8e83" />
              <TouchableOpacity style={[styles.askButton, (!question.trim() || asking) && styles.disabled]} onPress={askCoach} disabled={!question.trim() || asking}>
                {asking ? <ActivityIndicator color="#fffdfa" /> : <><Ionicons name="sparkles" size={17} color="#fffdfa" /><Text style={styles.askButtonText}>Ask the guide</Text></>}
              </TouchableOpacity>
            </View>
            {!!answer && <View style={styles.answerCard}><Text style={styles.answerLabel}>A gentle perspective</Text><Text style={styles.answerText}>{answer}</Text></View>}
          </> : <View style={styles.lockedCard}><Ionicons name="lock-closed" size={18} color="#728778" /><Text style={styles.lockedText}>The guide becomes available after both partners opt in.</Text></View>}
        </>}

        <Text style={styles.disclaimer}>This is general relationship guidance, not therapy or crisis support. If anyone is unsafe, contact a trusted person or local professional support.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f2eb" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, alignSelf: "flex-start" },
  backText: { color: "#554b43", fontWeight: "600" },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#f0dfdc", alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 14 },
  title: { color: "#3f3832", textAlign: "center", fontSize: 24, fontWeight: "700", marginTop: 14 },
  subtitle: { color: "#82766d", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 7, marginBottom: 20 },
  consentCard: { backgroundColor: "#fffdfa", borderRadius: 18, borderColor: "#e9dfd3", borderWidth: 1, padding: 17 },
  cardTitle: { color: "#4a413a", fontSize: 16, fontWeight: "700" },
  body: { color: "#82766d", fontSize: 13, lineHeight: 19, marginTop: 8 },
  consentRow: { borderTopColor: "#eee5da", borderTopWidth: 1, marginTop: 16, paddingTop: 14, flexDirection: "row", alignItems: "center" },
  consentTitle: { color: "#4a413a", fontSize: 14, fontWeight: "600" },
  consentStatus: { color: "#8a7f75", fontSize: 11, marginTop: 3 },
  waitingRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: "#f7f0e7", borderRadius: 11, padding: 11, marginTop: 12 },
  waitingText: { flex: 1, color: "#806b59", fontSize: 12, lineHeight: 17 },
  askCard: { backgroundColor: "#fffdfa", borderRadius: 18, borderColor: "#e9dfd3", borderWidth: 1, padding: 17, marginTop: 14 },
  questionInput: { minHeight: 110, backgroundColor: "#f8f4ee", borderRadius: 13, padding: 13, marginTop: 12, color: "#3f3832", textAlignVertical: "top", lineHeight: 20 },
  askButton: { backgroundColor: "#a65f65", minHeight: 47, borderRadius: 13, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 12 },
  askButtonText: { color: "#fffdfa", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },
  answerCard: { backgroundColor: "#eef2eb", borderColor: "#dce5da", borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 14 },
  answerLabel: { color: "#5c7562", fontWeight: "700", fontSize: 13, marginBottom: 8 },
  answerText: { color: "#435047", fontSize: 14, lineHeight: 21 },
  lockedCard: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#edf1eb", padding: 14, borderRadius: 14, marginTop: 14 },
  lockedText: { flex: 1, color: "#657569", fontSize: 12, lineHeight: 17 },
  membershipCard: { backgroundColor: "#fffdfa", borderRadius: 18, borderColor: "#e9dfd3", borderWidth: 1, padding: 17 },
  membershipButton: { backgroundColor: "#a65f65", borderRadius: 12, padding: 13, alignItems: "center", marginTop: 14 },
  membershipButtonText: { color: "#fffdfa", fontWeight: "700" },
  disclaimer: { color: "#988d82", fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 18, paddingHorizontal: 8 },
});

export default AIHelpScreen;
