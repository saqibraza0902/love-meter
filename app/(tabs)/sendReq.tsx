import { useToast } from "@/providers/toast-provider";
import { sendPairingRequest } from "@/utils/supabase";
import { handleApiError } from "@/utils/handle-api-errors";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector } from "@/hooks/use-redux";
import { useRouter } from "@/navigation/router-compat";
import ScreenBackButton from "@/components/ScreenBackButton";

const SendRequestScreen = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const currentUser = useAppSelector((state) => state.user.user);
  const router = useRouter();
  const { toast } = useToast();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentUser?.isPaired) router.replace("/(tabs)/Home");
  }, [currentUser?.isPaired, router]);

  const handleSendRequest = async () => {
    Keyboard.dismiss();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address to send an invitation.");
      return;
    }
    if (normalizedEmail === currentUser?.email?.toLowerCase()) {
      setError("Use your partner's email address, not your own.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await sendPairingRequest(normalizedEmail);
      setSuccess(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      setEmail("");
    } catch (error) {
      const err = handleApiError(error);
      toast(err);
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
        <SafeAreaView style={styles.safeContent}>
        <ScreenBackButton label="Home" />
        <View style={styles.illustration}>
          <View style={[styles.personIcon, styles.personLeft]}><Ionicons name="person" size={27} color="#a65f65" /></View>
          <View style={styles.heartIcon}><Ionicons name="heart" size={18} color="#fffdfa" /></View>
          <View style={[styles.personIcon, styles.personRight]}><Ionicons name="person" size={27} color="#6d8777" /></View>
        </View>

        <Text style={styles.eyebrow}>START YOUR SHARED SPACE</Text>
        <Text style={styles.title}>Invite your person</Text>
        <Text style={styles.subtitle}>
          Send an invitation to the email they use for Love Meter. Once they accept, your private couple space is ready.
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons
            name="mail-outline"
            size={24}
            color="#82766d"
            style={styles.inputIcon}
          />
          <TextInput
            placeholder="partner@example.com"
            placeholderTextColor="#82766d"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError("");
              setSuccess(false);
              fadeAnim.setValue(0);
            }}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSendRequest}
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
              <Text style={styles.buttonText}>Send invitation</Text>
            </>
          )}
        </TouchableOpacity>

        <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
          <Ionicons name="checkmark-circle" size={48} color="#7c9b83" />
          <Text style={styles.successText}>Invitation sent</Text>
          <Text style={styles.successSubtext}>
            Weâ€™ll let you know when your partner accepts. You can keep exploring while you wait.
          </Text>
          <TouchableOpacity style={styles.homeLink} onPress={() => router.replace("/(tabs)/Home")}>
            <Text style={styles.homeLinkText}>Back to your home</Text>
            <Ionicons name="arrow-forward" size={16} color="#6d8777" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.privacyNote}><Ionicons name="lock-closed-outline" size={13} color="#6d8777" /> Your partner must accept before anything is shared.</Text>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f2eb",
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingVertical: 16,
    justifyContent: "center",
  },
  safeContent: { flex: 1, justifyContent: "center", alignItems: "stretch" },
  illustration: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  personIcon: { width: 66, height: 66, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e9dfd3" },
  personLeft: { backgroundColor: "#f0dfdc" },
  personRight: { backgroundColor: "#e8eee7" },
  heartIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#a65f65", alignItems: "center", justifyContent: "center", marginHorizontal: -5, zIndex: 1 },
  eyebrow: { color: "#8a7770", fontSize: 10, letterSpacing: 1.5, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#3f3832",
    textAlign: "center",
    marginBottom: 9,
  },
  subtitle: {
    fontSize: 14,
    color: "#82766d",
    textAlign: "center",
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "#e9dfd3",
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
    color: "#3f3832",
    fontSize: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6d8777",
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
    color: "#b85d55",
    fontSize: 14,
    marginTop: 4,
    paddingLeft: 8,
  },
  successContainer: {
    alignItems: "center",
    marginTop: 32,
  },
  successText: {
    color: "#3f3832",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  successSubtext: {
    color: "#82766d",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  homeLink: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10, marginTop: 8 },
  homeLinkText: { color: "#6d8777", fontSize: 13, fontWeight: "700" },
  privacyNote: { color: "#82766d", fontSize: 11, marginTop: 18, textAlign: "center" },
});

export default SendRequestScreen;
