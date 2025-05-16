import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import React, { useState, useEffect } from "react";
import { auth, db } from "@/utils/firebase";
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { unPairUsers } from "@/utils/firebase-functions/unpair-req";
import { useToast } from "native-base";
import { setPartner, setUser } from "@/redux/slices/user-slice";
import { useAppDispatch, useAppSelector } from "@/hooks/use-redux";
import { setQuote } from "@/redux/slices/quotes-slice";

const SettingsScreen = () => {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.user);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
  });
  const [avatar, setAvatar] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const toast = useToast();
  const dispatch = useAppDispatch();

  const fetchUserData = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        dispatch(setUser(userData));
        setIsPremium(userData?.isPremium || false);
        setFormData({
          displayName: userData.name || "",
          bio: userData.bio || "",
        });
        setAvatar(userData.photoURL || null);
      }
      setLoading(false);
    }
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
      await updateDoc(doc(db, "users", auth.currentUser?.uid || ""), {
        name: formData.displayName,
        bio: formData.bio,
        ...(typeof avatar === "string" && { photoURL: avatar }),
      });
      setEditing(false);
      const userDoc = await getDoc(
        doc(db, "users", auth.currentUser?.uid || "")
      );
      if (userDoc.exists()) {
        setUser(userDoc.data());
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpair = async () => {
    try {
      setLoading(true);
      await unPairUsers();
      toast.show({ description: "Successfully unpaired!" });
      dispatch(setPartner(null));
    } catch (error: any) {
      alert(`Unpairing failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    // For manual payment flow
    Alert.alert(
      "Upgrade to Premium",
      "Please contact support@lovequotes.com to upgrade your account manually.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Contact Support",
          onPress: () => Linking.openURL("mailto:support@lovequotes.com"),
        },
      ]
    );
  };

  const openPrivacyPolicy = () => {
    // Replace with your actual privacy policy URL
    Linking.openURL("https://yourwebsite.com/privacy");
  };

  const openTermsConditions = () => {
    // Replace with your actual terms URL
    Linking.openURL("https://yourwebsite.com/terms");
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#ec4899" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            colors={["#ec4899"]}
            tintColor="#ec4899"
            progressBackgroundColor="#ffffff"
          />
        }
      >
        {/* Header with pink background */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile Settings</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-circle" size={100} color="#9ca3af" />
            )}
            {editing && (
              <TouchableOpacity style={styles.editBadge}>
                <Ionicons name="camera" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                placeholderTextColor="#9ca3af"
                value={formData.displayName}
                onChangeText={(text) =>
                  setFormData({ ...formData, displayName: text })
                }
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Bio"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
              />
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <Text style={styles.displayName}>
                {formData.displayName || auth.currentUser?.email}
              </Text>
              {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
              <Text style={styles.email}>{auth.currentUser?.email}</Text>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={16} color="#f59e0b" />
                  <Text style={styles.premiumText}>Premium Member</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Premium Subscription Section */}
        {!isPremium && (
          <View style={styles.card}>
            <View style={styles.premiumHeader}>
              <Ionicons name="diamond" size={24} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Go Premium</Text>
            </View>
            <Text style={styles.premiumDescription}>
              Unlock all features including unlimited quotes, premium content,
              and more!
            </Text>
            <View style={styles.premiumFeatures}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.featureText}>Unlimited Quotes</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.featureText}>Exclusive Content</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.featureText}>No Ads</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.premiumButton]}
              onPress={handleUpgrade}
            >
              <Text style={styles.buttonText}>Upgrade Now - $4.99/month</Text>
            </TouchableOpacity>
            <Text style={styles.noteText}>
              * Contact support for manual payment options
            </Text>
          </View>
        )}

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
              style={[styles.button, styles.unpairButton]}
              onPress={handleUnpair}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Unpair Account</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Legal Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={openPrivacyPolicy}
          >
            <Ionicons name="lock-closed" size={20} color="#64748b" />
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
            onPress={openTermsConditions}
          >
            <Ionicons name="document-text" size={20} color="#64748b" />
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
            auth.signOut();
            router.replace("/login");
          }}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    backgroundColor: "#ec4899",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
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
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#ec4899",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  formContainer: {
    width: "100%",
  },
  input: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontSize: 16,
    color: "#475569",
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
    color: "#475569",
    marginBottom: 5,
    textAlign: "center",
  },
  bio: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  email: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  premiumText: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#f9fafb",
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
    color: "#475569",
    marginBottom: 15,
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  premiumDescription: {
    color: "#64748b",
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
    color: "#475569",
    marginLeft: 8,
  },
  noteText: {
    fontSize: 12,
    color: "#94a3b8",
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
    backgroundColor: "#ec4899",
  },
  unpairButton: {
    backgroundColor: "#f87171",
  },
  premiumButton: {
    backgroundColor: "#f59e0b",
  },
  logoutButton: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginHorizontal: 20,
  },
  saveButton: {
    backgroundColor: "#ec4899",
    marginRight: 10,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    color: "#475569",
    fontWeight: "600",
    fontSize: 16,
  },
  logoutButtonText: {
    color: "#475569",
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
    color: "#475569",
    marginLeft: 12,
    fontSize: 16,
  },
  legalIcon: {
    marginLeft: "auto",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 4,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoLabel: {
    color: "#64748b",
  },
  infoValue: {
    color: "#475569",
    fontWeight: "500",
  },
});

export default SettingsScreen;
