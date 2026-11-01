import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { supabase, uploadImage } from "@/utils/supabase";
import Feather from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "@/utils/image-picker-compat";
import { useLocalSearchParams, useRouter } from "@/navigation/router-compat";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenBackButton from "@/components/ScreenBackButton";
import { QUIZ_STARTERS } from "@/constants/quiz-starters";

type Option = {
  text: string;
  image?: string;
};

type Question = {
  question: string;
  options: Option[];
  correctIndex: number | null;
};

const CreateQuiz = () => {
  const { toast } = useToast();
  const router = useRouter();
  const { template } = useLocalSearchParams<{ template?: string }>();
  const starter = QUIZ_STARTERS.find(item => item.id === template);
  const [quizName, setQuizName] = useState(starter?.name || "");

  const [questions, setQuestions] = useState<Question[]>(starter ? starter.questions.map(question => ({
    question,
    options: starter.options.map(text => ({ text })),
    correctIndex: null,
  })) : [
    {
      question: "",
      options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
      correctIndex: null,
    },
  ]);
  const navigation = useNavigation();
  const { user, partner } = useAppSelector((s) => s.user);

  const pickImage = async (qIndex: number, optIndex: number) => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return toast(
        "Permission required, We need camera roll permissions to upload images"
      );
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3, // Reduced quality to keep Base64 size manageable
    });

    if (!result.canceled) {
      try {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[optIndex] = {
          ...newQuestions[qIndex].options[optIndex],
          image: result.assets[0].uri,
          text: "", // Clear text when image is added
        };
        setQuestions(newQuestions);
      } catch (error) {
        console.error("Error converting image:", error);
        toast("Failed to process image");
      }
    }
  };

  const removeImage = (qIndex: number, optIndex: number) => {
    const newQuestions = [...questions];
    const newOptions = [...newQuestions[qIndex].options];
    newOptions[optIndex] = {
      ...newOptions[optIndex],
      image: undefined,
      text: "", // Reset text
    };
    newQuestions[qIndex].options = newOptions;
    setQuestions(newQuestions);
  };

  // ... (keep all your existing functions like addQuestion, deleteQuestion, etc.)

  const addQuestion = () => {
    if (questions.length < 20) {
      setQuestions([
        ...questions,
        {
          question: "",
          options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
          correctIndex: null,
        },
      ]);
    }
  };

  const deleteQuestion = (qIndex: number) => {
    if (questions.length <= 1) {
      toast("Cannot delete, You must have at least one question");
      return;
    }

    setQuestions(questions.filter((_, index) => index !== qIndex));
  };

  const addOption = (qIndex: number) => {
    if (questions[qIndex].options.length < 6) {
      const newQuestions = [...questions];
      newQuestions[qIndex].options.push({ text: "" });
      setQuestions(newQuestions);
    }
  };

  const deleteOption = (qIndex: number, optIndex: number) => {
    const newQuestions = [...questions];
    const options = newQuestions[qIndex].options;

    // Can't delete if only 2 options remain
    if (options.length <= 2) {
      toast("Cannot delete, You must have at least two options");
      return;
    }

    // If deleting the correct option, reset correctIndex
    if (newQuestions[qIndex].correctIndex === optIndex) {
      newQuestions[qIndex].correctIndex = null;
    }
    // Adjust correctIndex if needed
    else if (
      newQuestions[qIndex].correctIndex !== null &&
      newQuestions[qIndex].correctIndex > optIndex
    ) {
      newQuestions[qIndex].correctIndex = newQuestions[qIndex].correctIndex - 1;
    }

    options.splice(optIndex, 1);
    setQuestions(newQuestions);
  };

  const updateQuestionText = (text: string, qIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].question = text;
    setQuestions(newQuestions);
  };

  const updateOptionText = (text: string, qIndex: number, optIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[optIndex].text = text;
    setQuestions(newQuestions);
  };

  const setCorrectOption = (qIndex: number, optIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].correctIndex = optIndex;
    setQuestions(newQuestions);
  };

  const saveQuiz = async () => {
    try {
      const isValid =
        quizName.trim() !== "" &&
        questions.every(
          (q) =>
            q.question.trim() !== "" &&
            q.options.every((opt) => opt.text.trim() !== "" || opt.image) &&
            (!!starter || q.correctIndex !== null)
        );

      if (!partner?.id || !isValid) {
        return toast("Please complete all the fields");
      }

      if (!user?.coupleId) return toast("Your account needs an active couple to create a quiz.");
      const cleanedQuestions = await Promise.all(questions.map(async (question) => ({
        question: question.question.trim(),
        correctIndex: question.correctIndex,
        options: await Promise.all(question.options.map(async (option) => ({
          text: option.text || "",
          ...(option.image ? { image_path: await uploadImage(option.image, `${user.coupleId}/quizzes/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`) } : {}),
        }))),
      })));
      const { error } = starter
        ? await supabase.rpc("create_conversation_quiz", { target_couple: user.coupleId, quiz_name: quizName.trim(), quiz_questions: cleanedQuestions })
        : await supabase.rpc("create_quiz", { target_couple: user.coupleId, quiz_name: quizName.trim(), quiz_questions: cleanedQuestions });
      if (error) throw error;

      toast("Quiz created successfully");
      router.back();
    } catch (error) {
      console.log(error);
      toast("Failed to create quiz");
    }
  };

  const renderOptionInput = (qIndex: number, optIndex: number, opt: Option) => {
    return (
      <View style={styles.optionRow}>
        <View style={styles.optionContent}>
          <Text style={styles.optionLabel}>
            {String.fromCharCode(65 + optIndex)}.
          </Text>

          {opt.image ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: opt.image }} style={styles.optionImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeImage(qIndex, optIndex)}
              >
                <Feather name="x" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.optionInput}
                value={opt.text}
                onChangeText={(text) =>
                  updateOptionText(text, qIndex, optIndex)
                }
                placeholder={`Enter option ${optIndex + 1}`}
                placeholderTextColor="#9a8e83"
              />
              <TouchableOpacity
                style={styles.uploadImageButton}
                onPress={() => pickImage(qIndex, optIndex)}
              >
                <Feather name="image" size={18} color="#6d8777" />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.optionActions}>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: questions[qIndex].correctIndex === optIndex }}
            onPress={() => setCorrectOption(qIndex, optIndex)}
            style={[styles.checkbox, { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: questions[qIndex].correctIndex === optIndex ? "#6d8777" : "#b8b0a8", alignItems: "center", justifyContent: "center" }]}
          >
            {questions[qIndex].correctIndex === optIndex && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#6d8777" }} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteOption(qIndex, optIndex)}
            style={styles.deleteOptionButton}
          >
            <Feather name="trash-2" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <ScreenBackButton label="Quizzes" />
        {starter && <View style={styles.conversationHint}><Feather name="message-circle" size={18} color="#6d8777" /><Text style={styles.conversationHintText}>This is a no-score conversation deck. Your partner answers from your choices, and you can compare what they picked.</Text></View>}
        {/* Quiz Name Input */}
        <View style={styles.quizNameContainer}>
          <Text style={styles.sectionTitle}>Quiz Name</Text>
          <TextInput
            style={styles.input}
            value={quizName}
            onChangeText={setQuizName}
            placeholder="Enter quiz name"
            placeholderTextColor="#9a8e83"
          />
        </View>

        {/* Questions List */}
        {questions.map((q, qIndex) => (
          <View key={qIndex} style={styles.questionBlock}>
            <View style={styles.questionHeader}>
              <Text style={styles.sectionTitle}>Question {qIndex + 1}</Text>
              <TouchableOpacity
                onPress={() => deleteQuestion(qIndex)}
                style={styles.deleteButton}
              >
                <Feather name="trash-2" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.questionInput}
              value={q.question}
              onChangeText={(text) => updateQuestionText(text, qIndex)}
              placeholder="Enter your question"
              placeholderTextColor="#9a8e83"
              multiline
            />

            <Text style={styles.optionsTitle}>Options</Text>

            {q.options.map((opt, optIndex) => (
              <View
                key={optIndex}
                style={[
                  styles.optionContainer,
                  q.correctIndex === optIndex && styles.correctOption,
                ]}
              >
                {renderOptionInput(qIndex, optIndex, opt)}
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.addOptionButton,
                q.options.length >= 6 && styles.disabledButton,
              ]}
              onPress={() => addOption(qIndex)}
              disabled={q.options.length >= 6}
            >
              <Feather name="plus" size={18} color="#6d8777" />
              <Text style={styles.addOptionText}>Add Option</Text>
            </TouchableOpacity>
          </View>
        ))}

        {questions.length < 20 && (
          <TouchableOpacity
            style={styles.addQuestionButton}
            onPress={addQuestion}
          >
            <Feather name="plus-circle" size={20} color="#6d8777" />
            <Text style={styles.addQuestionText}>Add Question</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={saveQuiz}>
          <Text style={styles.saveText}>Save Quiz</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
// Styles would go here
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffdfa",
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  conversationHint: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#e8eee7", borderRadius: 14, padding: 12, marginBottom: 16 },
  conversationHintText: { flex: 1, color: "#536b59", fontSize: 12, lineHeight: 17 },
  quizNameContainer: {
    marginBottom: 25,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3f3832",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#f3ede5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#3f3832",
  },
  questionInput: {
    backgroundColor: "#f3ede5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#3f3832",
    minHeight: 60,
    textAlignVertical: "top",
  },
  questionBlock: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#4a413a",
    marginTop: 12,
    marginBottom: 8,
  },
  optionContainer: {
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9dfd3",
    padding: 12,
  },
  correctOption: {
    borderColor: "#6d8777",
    backgroundColor: "#e8eee7",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  optionActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#3f3832",
    marginRight: 10,
    width: 24,
  },
  optionInput: {
    flex: 1,
    fontSize: 16,
    color: "#3f3832",
    paddingVertical: 6,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
  },
  optionImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 4,
  },
  uploadImageButton: {
    marginLeft: 10,
    padding: 6,
  },
  deleteOptionButton: {
    marginLeft: 12,
    padding: 4,
  },
  checkbox: {
    marginLeft: 8,
  },
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  addOptionText: {
    color: "#6d8777",
    marginLeft: 8,
    fontWeight: "500",
  },
  addQuestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#e8eee7",
    marginBottom: 20,
  },
  addQuestionText: {
    color: "#6d8777",
    marginLeft: 8,
    fontWeight: "600",
    fontSize: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9dfd3",
  },
  saveBtn: {
    backgroundColor: "#6d8777",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  deleteButton: {
    padding: 6,
  },
});
export default CreateQuiz;
