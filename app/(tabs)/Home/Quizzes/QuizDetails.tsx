import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { getMediaUrl, supabase } from "@/utils/supabase";
import { useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenBackButton from "@/components/ScreenBackButton";

const QuizDetail = () => {
  const { params } = useRoute();
  //@ts-ignore
  const id: any = params.id;
  const { toast } = useToast();
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
        const { data, error } = await supabase.from("quizzes")
          .select("id,name,creator_id,couple_id,quiz_questions(id,question,position,quiz_options(id,text,image_path,position))")
          .eq("id", id).single();
        if (error) throw error;
        const isUserCreator = data.creator_id === user?.id;
        const isUserPartner = data.couple_id === user?.coupleId && !isUserCreator;
        setIsCreator(isUserCreator);
        setIsPartner(isUserPartner);
        setAuthorized(isUserCreator || isUserPartner);
        let answersByQuestion = new Map<string, string>();
        let attemptId: string | null = null;
        let wasSubmitted = false;
        const attemptUserId = isUserCreator ? partner?.id : user?.id;
        if ((isUserPartner || isUserCreator) && attemptUserId) {
          const { data: attempt, error: attemptError } = await supabase.from("quiz_attempts")
            .select("id,submitted_at,quiz_answers(question_id,option_id)")
            .eq("quiz_id", id).eq("user_id", attemptUserId).maybeSingle();
          if (attemptError) throw attemptError;
          if (attempt) {
            attemptId = attempt.id;
            wasSubmitted = !!attempt.submitted_at;
            answersByQuestion = new Map((attempt.quiz_answers || []).map((answer: any) => [answer.question_id, answer.option_id]));
          }
        }
        const keyResult = isUserCreator ? await supabase.from("quiz_answer_keys").select("question_id,correct_option_id") : { data: [], error: null };
        if (keyResult.error) throw keyResult.error;
        const keys = new Map((keyResult.data || []).map((key: any) => [key.question_id, key.correct_option_id]));
        const questions = await Promise.all((data.quiz_questions || []).sort((a: any, b: any) => a.position - b.position).map(async (question: any) => {
          const options = await Promise.all((question.quiz_options || []).sort((a: any, b: any) => a.position - b.position).map(async (option: any) => ({
            ...option, image: option.image_path ? await getMediaUrl(option.image_path) : undefined,
          })));
          const correctId = keys.get(question.id);
          return {
            ...question, options,
            correctIndex: correctId ? options.findIndex((option: any) => option.id === correctId) : undefined,
            userAnswer: answersByQuestion.has(question.id) ? options.findIndex((option: any) => option.id === answersByQuestion.get(question.id)) : undefined,
          };
        }));
        if (isUserPartner && wasSubmitted && attemptId) {
          const { data: results, error: resultsError } = await supabase.rpc("get_quiz_results", { target_attempt: attemptId });
          if (resultsError) throw resultsError;
          for (const question of questions) {
            const result: any = results.find((row: any) => row.question_id === question.id);
            if (result) question.correctIndex = result.correct_option_position;
          }
        }
        setQuizData({ id: data.id, name: data.name, questions });
        setSubmitted(wasSubmitted);
      } catch (error) {
        console.error(error);
        toast("Error, Failed to fetch quiz.");
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
      return toast("Please answer all questions before submitting.");
    }

    try {
      const answers = quizData.questions.map((question: any) => ({
        question_id: question.id,
        option_id: question.options[question.userAnswer].id,
      }));
      const { error } = await supabase.rpc("submit_quiz", { target_quiz: id, submitted_answers: answers });
      if (error) throw error;

      setSubmitted(true);
      toast("Success,Quiz submitted successfully!");
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast("Error, Failed to submit quiz. Please try again.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#a65f65" />
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
      <ScreenBackButton label="Quizzes" />
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
    color: "#a65f65",
  },
  status: {
    fontSize: 16,
    color: "#82766d",
    marginBottom: 16,
  },
  questionItem: {
    backgroundColor: "#fcf5f2", // soft pink background
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
    color: "#3f3832",
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionButton: {
    backgroundColor: "#f0dfdc",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2c5c1",
  },
  selectedOption: {
    backgroundColor: "#fbcfe8",
    borderColor: "#a65f65",
  },
  correctOption: {
    backgroundColor: "#e8eee7", // light green
    borderColor: "#6d8777",
  },
  wrongOption: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  optionText: {
    fontSize: 15,
    color: "#3f3832",
  },
  feedbackText: {
    marginTop: 10,
    fontSize: 14,
    fontStyle: "italic",
  },
  correctFeedback: {
    color: "#6d8777",
  },
  wrongFeedback: {
    color: "#ef4444",
  },
  submitButton: {
    backgroundColor: "#a65f65",
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
