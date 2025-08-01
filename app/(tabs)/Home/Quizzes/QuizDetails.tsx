import { useAppSelector } from "@/hooks/use-redux";
import { db } from "@/utils/firebase";
import { useRoute } from "@react-navigation/native";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// import { useToast } from "native-base";

const QuizDetail = () => {
  const { params } = useRoute();
  //@ts-ignore
  const id: any = params.id;
  // const toast = useToast();
  const { user, partner } = useAppSelector((s) => s.user);

  const [quizData, setQuizData] = useState<any>({});
  const [submitted, setSubmitted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const get_quiz = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, "quizzes", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setQuizData(data);
          setSubmitted(data.status || false);

          const isUserCreator = data.creatorId === user?.id;
          const isUserPartner = data.users.some(
            (el: string) => el === user?.id
          );
          console.log(isPartner);
          setIsCreator(isUserCreator);
          setIsPartner(isUserPartner);
          setAuthorized(isUserCreator || isUserPartner);
        } else {
          Alert.alert("Not Found", "Quiz does not exist.");
        }
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "Failed to fetch quiz.");
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) get_quiz();
  }, [id, user?.id]);

  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    if (submitted) return; // Don't allow changes after submission

    setQuizData((prev: any) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        userAnswer: optionIndex,
      };
      return {
        ...prev,
        questions: updatedQuestions,
      };
    });
  };

  const submitQuiz = async () => {
    // Check if all questions have been answered
    const allAnswered = quizData.questions?.every(
      (q: any) => q.userAnswer !== undefined
    );

    if (!allAnswered) {
      // toast.show({
      //   description: "Please answer all questions before submitting.",
      // });
      return;
    }

    try {
      const quizRef = doc(db, "quizzes", id);
      await updateDoc(quizRef, {
        questions: quizData.questions,
        status: true,
        submittedAt: new Date(),
      });

      setSubmitted(true);
      Alert.alert("Success", "Quiz submitted successfully!");
    } catch (error) {
      console.error("Error submitting quiz:", error);
      Alert.alert("Error", "Failed to submit quiz. Please try again.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#ec4899" />
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <Text style={{ color: "red", fontSize: 16 }}>
          You are not authorized to view this quiz.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>{quizData?.name}</Text>
      <Text style={styles.status}>
        Status: {submitted ? "Submitted" : "Not Submitted"}
      </Text>

      <ScrollView style={{ marginTop: 20 }}>
        {quizData?.questions?.map((q: any, index: number) => (
          <View key={index} style={styles.questionItem}>
            <Text style={styles.qText}>
              {index + 1}. {q.question}
            </Text>

            <View style={styles.optionsContainer}>
              {q.options.map(
                (
                  option: { text: string; image?: string },
                  optionIndex: number
                ) => (
                  <TouchableOpacity
                    key={optionIndex}
                    style={[
                      styles.optionButton,
                      q.userAnswer === optionIndex && styles.selectedOption,
                      submitted &&
                        optionIndex === q.correctIndex &&
                        styles.correctOption,
                      submitted &&
                        q.userAnswer === optionIndex &&
                        optionIndex !== q.correctIndex &&
                        styles.wrongOption,
                    ]}
                    onPress={() => handleOptionSelect(index, optionIndex)}
                    disabled={submitted}
                  >
                    {option.image ? (
                      <Image
                        source={{ uri: option.image }}
                        height={100}
                        width={100}
                      />
                    ) : (
                      <Text style={styles.optionText}>{option.text}</Text>
                    )}
                  </TouchableOpacity>
                )
              )}
            </View>

            {submitted && (
              <Text
                style={[
                  styles.feedbackText,
                  q.userAnswer === q.correctIndex
                    ? styles.correctFeedback
                    : styles.wrongFeedback,
                ]}
              >
                {q.userAnswer === q.correctIndex
                  ? "Correct!"
                  : `Wrong! The correct answer is: ${
                      q.options[q.correctIndex].text || q.correctIndex
                    }`}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      {!submitted && isPartner && (
        <TouchableOpacity style={styles.submitButton} onPress={submitQuiz}>
          <Text style={styles.submitButtonText}>Submit Quiz</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default QuizDetail;

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#ec4899",
  },
  status: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 16,
  },
  questionItem: {
    backgroundColor: "#fdf2f8", // soft pink background
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fbcfe8",
  },
  qText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#111827",
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionButton: {
    backgroundColor: "#fce7f3",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f9a8d4",
  },
  selectedOption: {
    backgroundColor: "#fbcfe8",
    borderColor: "#ec4899",
  },
  correctOption: {
    backgroundColor: "#d1fae5", // light green
    borderColor: "#10b981",
  },
  wrongOption: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  optionText: {
    fontSize: 15,
    color: "#1f2937",
  },
  feedbackText: {
    marginTop: 10,
    fontSize: 14,
    fontStyle: "italic",
  },
  correctFeedback: {
    color: "#10b981",
  },
  wrongFeedback: {
    color: "#ef4444",
  },
  submitButton: {
    backgroundColor: "#ec4899",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
