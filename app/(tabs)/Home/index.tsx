import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppSelector } from "@/hooks/use-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const HomeScreen = () => {
  const router = useRouter();
  const { user, partner } = useAppSelector((s) => s.user);
  const features = [
    { title: "Chat", icon: "chatbubble-ellipses", route: "/(tabs)/Home/Chats" },
    { title: "Quizzes", icon: "bulb", route: "/(tabs)/Home/Quizzes" },
    { title: "Memories", icon: "images", route: "/(tabs)/Home/Memories" },
    { title: "Together", icon: "people", route: "/(tabs)/Home/Things" },
    { title: "AI Help", icon: "sparkles", route: "/(tabs)/Home/Calendar" },
  ];

  const gradientCardColors = [
    "#fbc2eb",
    "#f78ca0",
    "#fccde2",
    "#fddde6",
    "#f8c6d8",
  ];

  if (!user?.isPaired) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: "#ec4899" }}>User is not paired</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header Section */}
      <LinearGradient
        colors={["#f78ca0", "#fbc2eb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.greeting}>
          Hello, {user?.name || user?.email?.split("@")[0]} ❤️
        </Text>
        <Text style={styles.partnerName}>
          Your Partner: {partner?.name || partner?.email?.split("@")[0]}
        </Text>
      </LinearGradient>

      {/* Features Section */}
      <View style={styles.features}>
        {features.map((f: any, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.card,
              {
                backgroundColor:
                  gradientCardColors[i % gradientCardColors.length],
              },
            ]}
            onPress={() => router.push(f.route)}
            activeOpacity={0.9}
          >
            <View style={styles.icon}>
              <Ionicons name={f.icon} size={28} color="#ec4899" />
            </View>
            <Text style={styles.cardText}>{f.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom Gradient */}
      <LinearGradient
        colors={["#fbc2eb", "#f78ca0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bottomGradient}
      />
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: "#ec4899",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { fontSize: 24, fontWeight: "bold", color: "#ffffff" },
  partnerName: { fontSize: 18, color: "#ffe4f0", marginTop: 10 },
  features: {
    paddingHorizontal: 20,
    paddingTop: 30,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "47%",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    transform: [{ scale: 1 }],
  },
  icon: {
    backgroundColor: "#ffffff",
    borderRadius: 40,
    padding: 16,
    shadowColor: "#ec4899",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 10,
  },
  cardText: { color: "#ec4899", fontWeight: "bold", fontSize: 16 },
  bottomGradient: {
    height: 100,
    marginTop: "auto",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: "#ec4899",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
  },
});
