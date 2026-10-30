import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { supabase } from "@/utils/supabase";
import { useRouter } from "@/navigation/router-compat";
import Ionicons from "react-native-vector-icons/Ionicons";
import ScreenBackButton from "@/components/ScreenBackButton";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const QuizzesScreen = () => {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, partner } = useAppSelector((s) => s.user);

  useEffect(() => {
    if (!user?.coupleId) { setQuizzes([]); setLoading(false); return; }
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("quizzes").select("*, quiz_attempts(user_id,submitted_at)")
        .eq("couple_id", user.coupleId).order("created_at", { ascending: false });
      if (error) { toast("Could not load quizzes."); console.warn(error); }
      else if (active) setQuizzes((data || []).map((quiz: any) => ({
        ...quiz,
        creatorId: quiz.creator_id,
        status: (quiz.quiz_attempts || []).some((attempt: any) => attempt.user_id === partner?.id && !!attempt.submitted_at),
      })));
      if (active) setLoading(false);
    };
    void load();
    const channel = supabase.channel(`quizzes:${user.coupleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quizzes", filter: `couple_id=eq.${user.coupleId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, () => void load())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [user?.coupleId, partner?.id, toast]);

  const renderQuizItem = ({ item }: { item: any }) => {
    const isCreatedByUser = item.creatorId === user?.id;
    const isForUser = item.partnerId === user?.id;
    const targetName = isForUser ? user?.name : partner?.name;

    return (
      <TouchableOpacity
        style={[
          styles.quizItem,
          isCreatedByUser ? styles.userQuiz : styles.partnerQuiz,
        ]}
        onPress={() => {
          if (item.status || !isCreatedByUser) {
            router.push({
              pathname: `/(tabs)/Home/Quizzes/QuizDetails`,
              params: { id: item.id },
            });
          } else {
            toast("Quiz not submitted yet");
          }
        }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.quizTitle}>{item.name}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: item.status ? "#7c9b83" : "#fbbf24" },
            ]}
          >
            <Text style={styles.statusText}>
              {item.status ? "Submitted" : "Pending"}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>
          Created by:{" "}
          <Text style={{ fontWeight: "600" }}>
            {item.creatorId === user?.id ? "You" : partner?.name}
          </Text>
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headingRow}>
        <ScreenBackButton label="Home" />
        <Text style={styles.heading}>Your quizzes</Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#a65f65" />
        </View>
      ) : (
        <FlatList
          data={quizzes}
          keyExtractor={(item) => item.id}
          renderItem={renderQuizItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="help-circle-outline" size={28} color="#a65f65" /></View>
              <Text style={styles.emptyTitle}>Start with a question</Text>
              <Text style={styles.emptyText}>Make a short quiz for your partner and see what you both remember.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        />
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={() => router.push("/(tabs)/Home/Quizzes/CreateQuiz")}
        disabled={loading}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fffdfa" />
        <Text style={styles.buttonText}>{quizzes.length ? "Create a quiz" : "Create your first quiz"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default QuizzesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: "#f7f2eb" },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 2,
    marginBottom: 14,
    color: "#3f3832",
  },
  headingRow: { marginBottom: 2 },
  button: {
    backgroundColor: "#a65f65",
    padding: 16,
    borderRadius: 14,
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: {
    backgroundColor: "#e2c5c1",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  quizItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  userQuiz: {
    backgroundColor: "#fcf5f2",
    borderColor: "#e2c5c1",
    borderWidth: 1,
  },
  partnerQuiz: {
    backgroundColor: "#fffdfa",
    borderColor: "#e9dfd3",
    borderWidth: 1,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3f3832",
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: "#82766d",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusText: {
    color: "white",
    fontWeight: "600",
    fontSize: 12,
  },
  emptyText: {
    textAlign: "center", color: "#82766d", fontSize: 13, lineHeight: 19, marginTop: 6,
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, paddingBottom: 70 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#f0dfdc", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { color: "#4a413a", fontSize: 16, fontWeight: "700" },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
