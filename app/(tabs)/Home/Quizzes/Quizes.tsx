import { useAppSelector } from "@/hooks/use-redux";
import { db } from "@/utils/firebase";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
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
// import { useToast } from "native-base";

const QuizzesScreen = () => {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // const toast = useToast();
  const { user, partner } = useAppSelector((s) => s.user);

  useEffect(() => {
    if (!user?.id) return;
    const users = [user?.id, partner?.id].filter(Boolean);
    const q1 = query(
      collection(db, "quizzes"),
      where("users", "array-contains-any", users)
    );
    const unsubscribe = onSnapshot(q1, async (snap) => {
      setQuizzes(snap.docs.map((el) => ({ id: el.id, ...el.data() })));
    });
    return () => unsubscribe();
  }, [user?.id]);

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
            // toast.show({ description: "Quiz not submitted yet" });
          }
        }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.quizTitle}>{item.name}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: item.status ? "#4ade80" : "#fbbf24" },
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
      <Text style={styles.heading}>Your Quizzes</Text>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#ec4899" />
        </View>
      ) : (
        <FlatList
          data={quizzes}
          keyExtractor={(item) => item.id}
          renderItem={renderQuizItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No quizzes available.</Text>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={() => router.push("/(tabs)/Home/Quizzes/CreateQuiz")}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Create New Quiz</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default QuizzesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#111827",
  },
  button: {
    backgroundColor: "#ec4899",
    padding: 16,
    borderRadius: 14,
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: "#f9a8d4",
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
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    borderWidth: 1,
  },
  partnerQuiz: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    borderWidth: 1,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: "#6b7280",
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
    textAlign: "center",
    marginTop: 40,
    color: "#9ca3af",
    fontSize: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
