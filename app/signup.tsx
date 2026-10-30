import { useToast } from "@/providers/toast-provider";
import { handleApiError } from "@/utils/handle-api-errors";
import FontAwesome from "react-native-vector-icons/FontAwesome";
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

const SignUp = () => {
  const [email, setEmail] = useState("");
  const { toast } = useToast();
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
      toast("Invalid Email, Please enter a valid email address.");
      return;
    }
    if (!name || !email || !password) {
      toast("Missing Fields, Please fill out all fields.");
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw error;
      if (!data.session) {
        toast("Check your email to confirm your account, then log in.");
        router.replace("/login");
        return;
      }

      toast("Signed up successfully!");
    } catch (error) {
      const err = handleApiError(error);
      toast(err);
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
          <FontAwesome name="user" size={20} color="#9a8e83" />
          <TextInput
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#9a8e83"
          />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="mail" size={20} color="#9a8e83" />
          <TextInput
            placeholder="Email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="#9a8e83"
          />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialIcons name="lock" size={20} color="#9a8e83" />
          <TextInput
            placeholder="Password"
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSignUp}
            style={styles.input}
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
          style={[styles.button, isDisabled && styles.disabledButton]}
          onPress={handleSignUp}
          disabled={isDisabled}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
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
    backgroundColor: "#f7f2eb",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#fffdfa",
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
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f4ee",
    borderWidth: 1,
    borderColor: "#e9dfd3",
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 50,
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#4a413a",
  },
  button: {
    backgroundColor: "#a65f65",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: "#c8bdb2",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  loginText: {
    textAlign: "center",
    marginTop: 20,
    color: "#4a413a",
    fontSize: 14,
  },
  link: {
    color: "#a65f65",
    fontWeight: "600",
  },
});
