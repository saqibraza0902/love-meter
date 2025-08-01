import { DEFAULT_PROFILE } from "@/utils/default-url";
import { auth } from "@/utils/firebase";
import { sendPairingRequest } from "@/utils/firebase-functions/send-pair-req";
import { handleApiError } from "@/utils/handle-api-errors";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// import { useToast } from "native-base";

const SendRequestScreen = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  // const toast = useToast();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleSendRequest = async () => {
    Keyboard.dismiss();
    if (!email) {
      setError("Please enter an email address");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await sendPairingRequest(email);
      setSuccess(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Reset after 3 seconds
      setTimeout(() => {
        setSuccess(false);
        setEmail("");
        fadeAnim.setValue(0);
      }, 3000);
    } catch (error) {
      const err = handleApiError(error);
      // toast.show({ description: err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <Image
          source={{
            uri: auth.currentUser?.photoURL || DEFAULT_PROFILE,
          }}
          style={styles.headerImage}
          resizeMode="contain"
        />

        <Text style={styles.title}>Connect with Your Partner</Text>
        <Text style={styles.subtitle}>
          Enter your partner's email address to send a pairing request
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons
            name="mail-outline"
            size={24}
            color="#6b7280"
            style={styles.inputIcon}
          />
          <TextInput
            placeholder="partner@example.com"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError("");
            }}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendRequest}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="person-add-outline" size={20} color="white" />
              <Text style={styles.buttonText}>Send Pairing Request</Text>
            </>
          )}
        </TouchableOpacity>

        <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
          <Ionicons name="checkmark-circle" size={48} color="#4ade80" />
          <Text style={styles.successText}>Request Sent Successfully!</Text>
          <Text style={styles.successSubtext}>
            We'll notify you when they accept your request
          </Text>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
  },
  headerImage: {
    width: 200,
    height: 150,
    alignSelf: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    color: "#ffffff",
    fontSize: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
    height: 56,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    marginTop: 4,
    paddingLeft: 8,
  },
  successContainer: {
    alignItems: "center",
    marginTop: 32,
  },
  successText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  successSubtext: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});

export default SendRequestScreen;
