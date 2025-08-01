import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../utils/firebase";
// import { Spinner, useToast } from "native-base";
import { handleApiError } from "@/utils/handle-api-errors";

const SignUp = () => {
  const [email, setEmail] = useState("");
  // const toast = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const isDisabled = !email || !password || !name || isLoading;

  const handleSignUp = async () => {
    Keyboard.dismiss();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!name || !email || !password) {
      Alert.alert("Missing Fields", "Please fill out all fields.");
      return;
    }

    try {
      setIsLoading(true);
      const user = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", user.user.uid), {
        name: name,
        email: user.user.email,
        verified: user.user.emailVerified,
        profile: "",
      });

      router.replace("/(tabs)/Home");
      // toast.show({ description: "Signed up successfully!" });
    } catch (error) {
      const err = handleApiError(error);
      // toast.show({ description: err });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>

        <View style={styles.inputWrapper}>
          <FontAwesome name="user" size={20} color="#9ca3af" />
          <TextInput
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="mail" size={20} color="#9ca3af" />
          <TextInput
            placeholder="Email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="lock" size={20} color="#9ca3af" />
          <TextInput
            placeholder="Password"
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSignUp}
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity
            onPress={() => setIsPasswordVisible((prev) => !prev)}
          >
            <MaterialIcons
              name={isPasswordVisible ? "visibility" : "visibility-off"}
              size={20}
              color="#9ca3af"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, isDisabled && styles.disabledButton]}
          onPress={handleSignUp}
          disabled={isDisabled}
        >
          {isLoading ? (
            <Text>Loading...</Text>
          ) : (
            // <Spinner color="#fff" />
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.loginText}>
          Already have an account?{" "}
          <Text style={styles.link} onPress={() => router.replace("/login")}>
            Log in
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

export default SignUp;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ec4899",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 30,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 50,
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#475569",
  },
  button: {
    backgroundColor: "#ec4899",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: "#d1d5db",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  loginText: {
    textAlign: "center",
    marginTop: 20,
    color: "#475569",
    fontSize: 14,
  },
  link: {
    color: "#ec4899",
    fontWeight: "600",
  },
});
