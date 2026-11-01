import { useAppSelector } from "@/hooks/use-redux";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "react-native-linear-gradient";
import { useRouter } from "@/navigation/router-compat";
import React from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const features: {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  section?: string;
  tint: string;
}[] = [
  {
    title: "Everyday together",
    subtitle: "Daily status, a 24-hour snap, and a shared streak",
    icon: "people-circle-outline",
    route: "/(tabs)/Home/Together",
    section: "connection",
    tint: "#e8eee7",
  },
  {
    title: "Cycle tracker",
    subtitle: "Private cycle settings and optional partner sharing",
    icon: "heart-half-outline",
    route: "/(tabs)/Home/CycleTracker",
    tint: "#f8e9e8",
  },
  {
    title: "Chat",
    subtitle: "Stay close, every day",
    icon: "chatbubble-ellipses-outline",
    route: "/(tabs)/Home/Chats",
    tint: "#e8eee7",
  },
  {
    title: "Quizzes",
    subtitle: "See how well you know each other",
    icon: "help-circle-outline",
    route: "/(tabs)/Home/Quizzes",
    tint: "#f0dfdc",
  },
  {
    title: "Memories",
    subtitle: "Keep your moments together",
    icon: "images-outline",
    route: "/(tabs)/Home/Memories",
    tint: "#f2e8d8",
  },
  {
    title: "Plan our life",
    subtitle: "Shifts, calls, visits, and future hopes",
    icon: "calendar-outline",
    route: "/(tabs)/Home/Together",
    section: "planning",
    tint: "#e8eee7",
  },
  {
    title: "Notes & important plans",
    subtitle: "Keep immigration steps and lists together",
    icon: "folder-open-outline",
    route: "/(tabs)/Home/Together",
    section: "notes",
    tint: "#f2e8d8",
  },
  {
    title: "Watch, listen & doodle",
    subtitle: "Links and a shared sketchpad for parallel play",
    icon: "color-palette-outline",
    route: "/(tabs)/Home/Together",
    section: "play",
    tint: "#eee7f1",
  },
  {
    title: "Relationship guide",
    subtitle: "Thoughtful ideas for both of you",
    icon: "sparkles-outline",
    route: "/(tabs)/Home/AIHelp",
    tint: "#f0dfdc",
  },
];

const HomeScreen = () => {
  const router = useRouter();
  const { user, partner } = useAppSelector(state => state.user);
  const { top } = useSafeAreaInsets();
  const paired = !!user?.isPaired && !!partner;

  if (!user || (user.isPaired && !partner)) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="small" color="#a65f65" />
      </SafeAreaView>
    );
  }

  if (!paired) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
          <View style={styles.onboardingTop}>
            <View style={styles.brandMark}>
              <Ionicons name="heart" size={27} color="#a65f65" />
            </View>
            <TouchableOpacity style={styles.onboardingSettings} onPress={() => router.push("/(tabs)/Settings")} accessibilityLabel="Open settings">
              <Ionicons name="settings-outline" size={21} color="#6d8777" />
            </TouchableOpacity>
          </View>
          <Text style={styles.eyebrow}>A LITTLE SPACE FOR TWO</Text>
          <Text style={styles.onboardingTitle}>Make this your place to grow closer.</Text>
          <Text style={styles.onboardingCopy}>Connect with your partner to start a private space for messages, memories, quizzes, and plans together.</Text>

          <View style={styles.previewCard}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, styles.avatarRose]}>
                <Ionicons name="person" size={23} color="#a65f65" />
              </View>
              <View style={styles.connectionLine}>
                <Ionicons name="heart" size={17} color="#a65f65" />
              </View>
              <View style={[styles.avatar, styles.avatarSage]}>
                <Ionicons name="person" size={23} color="#6d8777" />
              </View>
            </View>
            <Text style={styles.previewTitle}>Your shared space starts here</Text>
            <Text style={styles.previewCopy}>Only you and your partner can see what you share.</Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(tabs)/sendReq")} activeOpacity={0.85}>
            <Ionicons name="heart-circle-outline" size={21} color="#fffdfa" />
            <Text style={styles.primaryButtonText}>Connect with your partner</Text>
            <Ionicons name="arrow-forward" size={18} color="#fffdfa" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/(tabs)/viewReq")} activeOpacity={0.8}>
            <Ionicons name="mail-unread-outline" size={19} color="#6d8777" />
            <Text style={styles.secondaryButtonText}>Check incoming requests</Text>
          </TouchableOpacity>

          <View style={styles.stepsRow}>
            <Step number="1" label="Send an invite" />
            <View style={styles.stepDivider} />
            <Step number="2" label="They accept" />
            <View style={styles.stepDivider} />
            <Step number="3" label="Grow together" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const userName = user.name || user.email?.split("@")[0] || "You";
  const partnerName = partner.name || partner.email?.split("@")[0] || "Your partner";

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#a65f65", "#bd8078"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: Math.max(top, 14) + 8 }]}>
          <View style={styles.headerTopline}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerEyebrow}>YOUR SPACE FOR TWO</Text>
              <Text numberOfLines={2} style={styles.headerTitle}>Your life, side by side</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerSettings} onPress={() => router.push("/(tabs)/Settings")} accessibilityLabel="Open settings">
                <Ionicons name="settings-outline" size={20} color="#fffdfa" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.coupleRow}>
            <View style={[styles.coupleAvatar, { backgroundColor: "#f0dfdc" }]}>
              <Text style={[styles.avatarInitial, { color: "#a65f65" }]}>{userName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.coupleHeart}>
              <Ionicons name="heart" size={16} color="#fffdfa" />
            </View>
            <View style={[styles.coupleAvatar, { backgroundColor: "#e8eee7" }]}>
              <Text style={[styles.avatarInitial, { color: "#6d8777" }]}>{partnerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.coupleNames}>
              <Text style={styles.namesTitle}>
                {userName} & {partnerName}
              </Text>
              <Text style={styles.namesSubtitle}>Your private couple space</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.pointsCard}>
          <View style={styles.pointsIcon}>
            <Ionicons name="heart" size={21} color="#a65f65" />
          </View>
          <View style={styles.pointsCopy}>
            <Text style={styles.pointsLabel}>Love points</Text>
            <Text style={styles.pointsHint}>Every thoughtful message counts</Text>
          </View>
          <Text style={styles.pointsValue}>{user.score || 0}</Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Make room for real life</Text>
            <Text style={styles.sectionSubtitle}>Tools for the everyday and the future you share</Text>
          </View>
          <Ionicons name="leaf-outline" size={21} color="#6d8777" />
        </View>
        <View style={styles.features}>
          {features.map(feature => (
            <TouchableOpacity key={feature.title} style={styles.featureCard} onPress={() => router.push(feature.section ? { pathname: feature.route, params: { section: feature.section } } : feature.route as never)} activeOpacity={0.82}>
              <View style={[styles.featureIcon, { backgroundColor: feature.tint }]}>
                <Ionicons name={feature.icon} size={23} color="#73585a" />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#a69a8f" />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.footerNote}>
          <Ionicons name="lock-closed-outline" size={14} color="#6d8777" />
          <Text style={styles.footerNoteText}>Your shared space is just for the two of you.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const Step = ({ number, label }: { number: string; label: string }) => (
  <View style={styles.step}>
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{number}</Text>
    </View>
    <Text style={styles.stepLabel}>{label}</Text>
  </View>
);

export default HomeScreen;

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#f7f2eb",
    alignItems: "center",
    justifyContent: "center",
  },
  container: { flex: 1, backgroundColor: "#f7f2eb" },
  onboardingContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 36,
    paddingBottom: 30,
    justifyContent: "center",
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0dfdc",
    alignSelf: "center",
    marginBottom: 22,
  },
  onboardingTop: {
    position: "relative",
    alignItems: "center",
    alignSelf: "stretch",
  },
  onboardingSettings: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "#e9dfd3",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#8a7770",
    letterSpacing: 2,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  onboardingTitle: {
    color: "#3f3832",
    fontSize: 29,
    fontWeight: "800",
    lineHeight: 36,
    textAlign: "center",
    marginTop: 12,
  },
  onboardingCopy: {
    color: "#82766d",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 12,
  },
  previewCard: {
    backgroundColor: "#fffdfa",
    borderColor: "#e9dfd3",
    borderWidth: 1,
    borderRadius: 23,
    alignItems: "center",
    padding: 22,
    marginTop: 27,
    marginBottom: 20,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fffdfa",
  },
  avatarRose: { backgroundColor: "#f0dfdc" },
  avatarSage: { backgroundColor: "#e8eee7" },
  connectionLine: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fffdfa",
    zIndex: 1,
    marginHorizontal: -5,
  },
  previewTitle: {
    color: "#4a413a",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  previewCopy: {
    color: "#82766d",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 5,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#a65f65",
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    flex: 1,
    color: "#fffdfa",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 7,
  },
  secondaryButtonText: { color: "#5d7666", fontSize: 14, fontWeight: "600" },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 27,
  },
  step: { alignItems: "center", gap: 6 },
  stepNumber: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#e8eee7",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { color: "#5d7666", fontSize: 12, fontWeight: "700" },
  stepLabel: { color: "#82766d", fontSize: 10 },
  stepDivider: {
    width: 27,
    height: 1,
    backgroundColor: "#d9cec2",
    marginHorizontal: 8,
    marginBottom: 16,
  },
  homeContent: { paddingBottom: 28 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 23,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitleWrap: { flex: 1, minWidth: 0, paddingRight: 10 },
  headerActions: { flexShrink: 0, flexDirection: "row", alignItems: "center" },
  headerEyebrow: {
    color: "#f4ddda",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: "#fffdfa",
    fontSize: 23,
    fontWeight: "800",
    marginTop: 4,
    flexShrink: 1,
  },
  pairedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff2b",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pairedPillText: { color: "#fffdfa", fontSize: 11, fontWeight: "700" },
  headerSettings: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#ffffff26",
    alignItems: "center",
    justifyContent: "center",
  },
  coupleRow: { flexDirection: "row", alignItems: "center", marginTop: 21 },
  coupleAvatar: {
    width: 47,
    height: 47,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#ffffff88",
    borderWidth: 2,
  },
  avatarInitial: { fontSize: 18, fontWeight: "800" },
  coupleHeart: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#bd8078",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -5,
    zIndex: 1,
  },
  coupleNames: { marginLeft: 12 },
  namesTitle: { color: "#fffdfa", fontSize: 15, fontWeight: "700" },
  namesSubtitle: { color: "#f4ddda", fontSize: 11, marginTop: 3 },
  pointsCard: {
    marginHorizontal: 20,
    marginTop: 17,
    backgroundColor: "#fffdfa",
    borderColor: "#e9dfd3",
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  pointsIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#f0dfdc",
    alignItems: "center",
    justifyContent: "center",
  },
  pointsCopy: { flex: 1, marginLeft: 11 },
  pointsLabel: { color: "#4a413a", fontSize: 14, fontWeight: "700" },
  pointsHint: { color: "#82766d", fontSize: 11, marginTop: 3 },
  pointsValue: { color: "#a65f65", fontSize: 23, fontWeight: "800" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 22,
    marginTop: 26,
    marginBottom: 11,
  },
  sectionTitle: { color: "#3f3832", fontSize: 18, fontWeight: "800" },
  sectionSubtitle: { color: "#82766d", fontSize: 12, marginTop: 3 },
  features: { marginHorizontal: 18 },
  featureCard: {
    minHeight: 71,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#ece2d8",
    backgroundColor: "#fffdfa",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 9,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: { flex: 1, marginLeft: 12 },
  featureTitle: { color: "#4a413a", fontSize: 14, fontWeight: "700" },
  featureSubtitle: { color: "#8a7e73", fontSize: 11, marginTop: 3 },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  footerNoteText: { color: "#82766d", fontSize: 11 },
});
