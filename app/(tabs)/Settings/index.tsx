import { useAppDispatch, useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { setQuote } from "@/redux/slices/quotes-slice";
import { setPartner, setUser } from "@/redux/slices/user-slice";
import { getActiveCouple, getCurrentProfile, supabase, unpairUsers } from "@/utils/supabase";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "react-native-linear-gradient";
import { useRouter } from "@/navigation/router-compat";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenBackButton from "@/components/ScreenBackButton";

const SettingsScreen = () => {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.user);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
  });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const { toast } = useToast();
  const { top } = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const fetchUserData = async () => {
    try {
      const userData = await getCurrentProfile();
      if (userData) {
        const [couple, { data: entitlement }] = await Promise.all([
          getActiveCouple(userData.id),
          supabase.from("entitlements").select("active").eq("user_id", userData.id).maybeSingle(),
        ]);
        const paid = !!entitlement?.active;
        dispatch(setUser({ ...userData, id: userData.id, paid, partnerId: couple?.partner.id || "", isPaired: !!couple, coupleId: couple?.id } as any));
        dispatch(setPartner(couple ? { ...couple.partner, photoURL: couple.partner.photo_path, partnerId: userData.id, isPaired: true, coupleId: couple.id } as any : null));
        setIsPremium(paid);
        setFormData({
          displayName: userData.name || "",
          bio: userData.bio || "",
        });
        setAvatar(userData.photo_path || null);
      }
    } catch (error) { console.warn("Could not load profile", error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const onRefresh = () => {
    setLoading(true);
    fetchUserData();
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const authUser = await supabase.auth.getUser();
      if (!authUser.data.user) throw new Error("Please sign in again.");
      const { error } = await supabase.from("profiles").update({
        name: formData.displayName, bio: formData.bio,
        ...(typeof avatar === "string" && { photo_path: avatar }),
      }).eq("id", authUser.data.user.id);
      if (error) throw error;
      setEditing(false);
      await fetchUserData();
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmUnpair = async () => {
    try {
      setLoading(true);
      await unpairUsers();
      dispatch(setUser({ ...user, partnerId: "", isPaired: false, coupleId: undefined } as any));
      toast("Successfully unpaired!");
      dispatch(setPartner(null));
      router.replace("/(tabs)/Home");
    } catch (error: any) {
      toast(`Unpairing failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpair = () => {
    Alert.alert(
      "Unpair from your partner?",
      "Your shared space will close for both of you. Messages and shared history stay private and return if you reconnect.",
      [
        { text: "Keep paired", style: "cancel" },
        { text: "Unpair", style: "destructive", onPress: () => { void confirmUnpair(); } },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={["left", "right", "bottom"]}>
        <ActivityIndicator size="large" color="#a65f65" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            colors={["#a65f65"]}
            tintColor="#a65f65"
            progressBackgroundColor="#ffffff"
          />
        }
      >
        {/* Header with pink background */}
        <LinearGradient
          colors={["#a65f65", "#c8877a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingVertical: top }]}
        >
          <ScreenBackButton label="Home" light />
          <Text style={styles.greeting}>
            {user?.name || user?.email?.split("@")[0]}
          </Text>
        </LinearGradient>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-circle" size={100} color="#9a8e83" />
            )}
          </View>

          {editing ? (
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                placeholderTextColor="#9a8e83"
                value={formData.displayName}
                onChangeText={(text) =>
                  setFormData({ ...formData, displayName: text })
                }
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Bio"
                placeholderTextColor="#9a8e83"
                multiline
                numberOfLines={3}
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
              />
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <Text style={styles.displayName}>
                {formData.displayName || user?.email}
              </Text>
              {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          )}
        </View>

        {/* Profile Actions */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile Settings</Text>
          {editing ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdateProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditing(false)}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.editButton]}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}

          {user?.isPaired && (
            <TouchableOpacity
              style={styles.unpairButton}
              onPress={handleUnpair}
              disabled={loading}
            >
              <Ionicons name="heart-dislike-outline" size={19} color="#a65f65" />
              <View style={styles.unpairCopy}><Text style={styles.unpairTitle}>Unpair from your partner</Text><Text style={styles.unpairSubtitle}>Your shared space will close for both of you.</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#a69a8f" />
            </TouchableOpacity>
          )}
        </View>

        {/* Optional subscription management and support */}
        {(
          <View style={styles.card}>
            <View style={styles.premiumHeader}>
              <Ionicons name={isPremium ? "heart" : "sparkles"} size={24} color="#a65f65" />
              <Text style={styles.sectionTitle}>{isPremium ? "Membership active" : "Support Love Meter"}</Text>
            </View>
            <Text style={styles.premiumDescription}>
              {isPremium
                ? "All features are available to everyone. Manage or cancel your existing subscription here."
                : "All features are free. An optional membership supports continued development."}
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.premiumButton]}
              onPress={() => router.push("/(tabs)/Settings/Payment")}
            >
              <Text style={styles.buttonText}>{isPremium ? "Manage membership" : "Optional support"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Legal Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => router.push("/(tabs)/Settings/PrivacyPolicy")}
          >
            <Ionicons name="lock-closed" size={20} color="#82766d" />
            <Text style={styles.legalText}>Privacy Policy</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#94a3b8"
              style={styles.legalIcon}
            />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => router.push("/(tabs)/Settings/TermsCondition")}
          >
            <Ionicons name="document-text" size={20} color="#82766d" />
            <Text style={styles.legalText}>Terms & Conditions</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#94a3b8"
              style={styles.legalIcon}
            />
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Developer</Text>
            <Text style={styles.infoValue}>Love Quotes Team</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={() => {
            dispatch(setPartner(null));
            dispatch(setUser(null));
            dispatch(setQuote(null));
            void supabase.auth.signOut();
            router.replace("/login");
          }}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f2eb",
  },
  greeting: { fontSize: 24, fontWeight: "bold", color: "#ffffff" },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: "#795856",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  formContainer: {
    width: "100%",
  },
  input: {
    backgroundColor: "#fffdfa",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e9dfd3",
    fontSize: 16,
    color: "#4a413a",
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
  infoContainer: {
    alignItems: "center",
  },
  displayName: {
    fontSize: 22,
    fontWeight: "600",
    color: "#4a413a",
    marginBottom: 5,
    textAlign: "center",
  },
  bio: {
    fontSize: 16,
    color: "#82766d",
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  email: {
    fontSize: 14,
    color: "#a39488",
    textAlign: "center",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8d2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  premiumText: {
    color: "#765f43",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fffdfa",
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4a413a",
    marginBottom: 15,
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  premiumDescription: {
    color: "#82766d",
    marginBottom: 15,
    lineHeight: 22,
  },
  premiumFeatures: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureText: {
    color: "#4a413a",
    marginLeft: 8,
  },
  noteText: {
    fontSize: 12,
    color: "#a39488",
    textAlign: "center",
    marginTop: 10,
  },
  actionsContainer: {
    width: "100%",
    paddingHorizontal: 20,
  },
  button: {
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    flexDirection: "row",
  },
  editButton: {
    backgroundColor: "#a65f65",
  },
  unpairButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#fcf5f2",
    borderWidth: 1,
    borderColor: "#ecd5d1",
    borderRadius: 14,
    paddingHorizontal: 13,
    marginTop: 14,
  },
  unpairCopy: { flex: 1 },
  unpairTitle: { color: "#8d5354", fontSize: 13, fontWeight: "700" },
  unpairSubtitle: { color: "#8a7f75", fontSize: 10, lineHeight: 15, marginTop: 2 },
  premiumButton: {
    backgroundColor: "#6d8777",
  },
  logoutButton: {
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "#e9dfd3",
    marginHorizontal: 20,
  },
  saveButton: {
    backgroundColor: "#a65f65",
    marginRight: 10,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "#e9dfd3",
    flex: 1,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelButtonText: {
    color: "#4a413a",
    fontWeight: "600",
    fontSize: 16,
  },
  logoutButtonText: {
    color: "#4a413a",
    fontWeight: "600",
    fontSize: 16,
  },
  legalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  legalText: {
    flex: 1,
    color: "#4a413a",
    marginLeft: 12,
    fontSize: 16,
  },
  legalIcon: {
    marginLeft: "auto",
  },
  divider: {
    height: 1,
    backgroundColor: "#e9dfd3",
    marginVertical: 4,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoLabel: {
    color: "#82766d",
  },
  infoValue: {
    color: "#4a413a",
    fontWeight: "500",
  },
});

export default SettingsScreen;
