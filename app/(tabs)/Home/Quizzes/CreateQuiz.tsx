import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { useNavigation } from "@react-navigation/native";
import { useAppSelector } from "@/hooks/use-redux";
import Checkbox from "expo-checkbox";
import { useToast } from "native-base";
import { useRouter } from "expo-router";
import { AntDesign, Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Switch } from "react-native";

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
  const toast = useToast();
  const router = useRouter();
  const [quizName, setQuizName] = useState("");

  const [questions, setQuestions] = useState<Question[]>([
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
      Alert.alert(
        "Permission required",
        "We need camera roll permissions to upload images"
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3, // Reduced quality to keep Base64 size manageable
    });

    if (!result.canceled) {
      try {
        // Read the image file and convert to Base64
        const base64 = await FileSystem.readAsStringAsync(
          result.assets[0].uri,
          {
            encoding: FileSystem.EncodingType.Base64,
          }
        );

        const newQuestions = [...questions];
        newQuestions[qIndex].options[optIndex] = {
          ...newQuestions[qIndex].options[optIndex],
          image: `data:image/jpeg;base64,${base64}`,
          text: "", // Clear text when image is added
        };
        setQuestions(newQuestions);
      } catch (error) {
        console.error("Error converting image:", error);
        toast.show({ description: "Failed to process image" });
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
      Alert.alert("Cannot delete", "You must have at least one question");
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
      Alert.alert("Cannot delete", "You must have at least two options");
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
            q.correctIndex !== null
        );

      if (!partner?.id || !isValid) {
        return toast.show({ description: "Please complete all the fields" });
      }

      // Prepare cleaned questions
      const cleanedQuestions = questions.map((question) => ({
        ...question,
        options: question.options.map((option) => ({
          text: option.text || "",
          ...(option.image ? { image: option.image } : {}),
        })),
      }));

      const quizData = {
        name: quizName,
        creatorId: user?.id,
        users: [user?.id, partner.id],
        status: false,
        questions: cleanedQuestions,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "quizzes"), quizData);

      toast.show({ description: "Quiz created successfully" });
      router.back();
    } catch (error) {
      console.log(error);
      toast.show({ description: "Failed to create quiz" });
    }
  };

  const renderOptionInput = (qIndex: number, optIndex: number, opt: Option) => {
    const isPaidUser = user?.paid === true;

    return (
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>
          {String.fromCharCode(65 + optIndex)}.
        </Text>

        {opt.image ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: opt.image }} style={styles.optionImage} />
            {isPaidUser && (
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeImage(qIndex, optIndex)}
              >
                <Feather name="x" size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <TextInput
              style={styles.optionInput}
              value={opt.text}
              onChangeText={(text) => updateOptionText(text, qIndex, optIndex)}
              placeholder={`Option ${optIndex + 1}`}
            />
            {isPaidUser && (
              <TouchableOpacity
                style={styles.uploadImageButton}
                onPress={() => pickImage(qIndex, optIndex)}
              >
                <Text style={styles.uploadImageText}>+ Img</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <TouchableOpacity
          onPress={() => deleteOption(qIndex, optIndex)}
          style={styles.deleteOptionButton}
        >
          <Feather name="x" size={18} color="#ef4444" />
        </TouchableOpacity>

        <Checkbox
          style={styles.checkbox}
          value={questions[qIndex].correctIndex === optIndex}
          onValueChange={() => setCorrectOption(qIndex, optIndex)}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <ScrollView>
        {/* Quiz Name Input */}
        <View style={styles.quizNameContainer}>
          <Text style={styles.label}>Quiz Name</Text>
          <TextInput
            style={styles.input}
            value={quizName}
            onChangeText={setQuizName}
            placeholder="Enter quiz name"
          />
        </View>

        {/* Image Quiz Toggle */}

        {questions.map((q, qIndex) => (
          <View key={qIndex} style={styles.questionBlock}>
            <View style={styles.questionHeader}>
              <Text style={styles.label}>Q{qIndex + 1}</Text>
              <TouchableOpacity
                onPress={() => deleteQuestion(qIndex)}
                style={styles.deleteButton}
              >
                <Feather name="trash-2" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={q.question}
              onChangeText={(text) => updateQuestionText(text, qIndex)}
              placeholder="Write your question"
            />

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
              style={styles.addOptionButton}
              onPress={() => addOption(qIndex)}
              disabled={q.options.length >= 6}
            >
              <Text style={styles.addOptionText}>+ Add Option</Text>
            </TouchableOpacity>
          </View>
        ))}

        {questions.length < 20 && (
          <TouchableOpacity style={styles.addBtn} onPress={addQuestion}>
            <Text style={styles.addText}>+ Add Question</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.saveBtn} onPress={saveQuiz}>
        <Text style={styles.saveText}>Save Quiz</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default CreateQuiz;

const styles = StyleSheet.create({
  quizNameContainer: {
    marginBottom: 20,
  },
  label: {
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  checkbox: {
    margin: 8,
  },
  questionBlock: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  deleteButton: {
    padding: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
  },
  optionLabel: {
    width: 20,
    fontWeight: "bold",
    marginRight: 8,
  },
  optionInput: {
    flex: 1,
    padding: 8,
  },
  deleteOptionButton: {
    padding: 4,
    marginRight: 8,
  },
  addOptionButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  addOptionText: {
    color: "#3b82f6",
    fontWeight: "500",
  },
  addBtn: {
    backgroundColor: "#fbbf24",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
  },
  addText: {
    color: "#000",
    fontWeight: "500",
  },
  saveBtn: {
    backgroundColor: "#10b981",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  correctOption: {
    borderColor: "#10b981",
    backgroundColor: "#ecfdf5",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  optionContainer: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
  },
  optionImage: {
    width: 100,
    height: 100,
    borderRadius: 4,
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  uploadImageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  uploadImageText: {
    color: "#3b82f6",
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "white",
    borderRadius: 10,
    padding: 2,
  },
});
