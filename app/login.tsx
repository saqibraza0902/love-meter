import { useToast } from "@/providers/toast-provider";
import { handleApiError } from "@/utils/handle-api-errors";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { useRouter } from "@/navigation/router-compat";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../utils/supabase";

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const isDisabled = !email || !password || isLoading;

  const handleLogin = async () => {
    Keyboard.dismiss();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast("Please enter a valid email address.");
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (error: any) {
      const err = handleApiError(error);
      toast(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Please log in to continue</Text>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <MaterialIcons name="mail" size={20} color="#9a8e83" />
          <TextInput
            placeholder="Email"
            value={email}
            keyboardType="email-address"
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="#9a8e83"
          />
        </View>
        <View style={styles.inputWrapper}>
          <MaterialIcons name="lock" size={20} color="#9a8e83" />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry={!isPasswordVisible}
            placeholderTextColor="#9a8e83"
          />
          <TouchableOpacity
            onPress={() => setIsPasswordVisible((prev) => !prev)}
          >
            <MaterialIcons
              name={isPasswordVisible ? "visibility" : "visibility-off"}
              size={20}
              color="#9a8e83"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          style={[styles.loginButton, isDisabled && styles.loginButtonDisabled]}
          disabled={isDisabled}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/signup")}
          style={styles.signupContainer}
        >
          <Text style={styles.signupText}>
            Donâ€™t have an account?{" "}
            <Text style={styles.signupLink}>Sign Up</Text>
          </Text>
        </TouchableOpacity>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f2eb",
    paddingHorizontal: 30,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#a65f65",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#4a413a",
    textAlign: "center",
    marginBottom: 30,
  },
  inputContainer: {
    gap: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "#e9dfd3",
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 50,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#4a413a",
  },
  loginButton: {
    backgroundColor: "#a65f65",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: "#c8bdb2",
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  signupContainer: {
    marginTop: 15,
    alignItems: "center",
  },
  signupText: {
    color: "#4a413a",
    fontSize: 14,
  },
  signupLink: {
    color: "#a65f65",
    fontWeight: "600",
  },
  errorText: {
    marginTop: 10,
    color: "#ef4444",
    textAlign: "center",
  },
});
