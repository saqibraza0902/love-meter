import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useAppSelector } from "@/hooks/use-redux";

const HomeScreen = () => {
  const router = useRouter();
  const { user, partner } = useAppSelector((s) => s.user);

  const features = [
    { title: "Chat", icon: "chatbubble-ellipses", route: "/(tabs)/Home/Chats" },
    { title: "Quizzes", icon: "bulb", route: "/(tabs)/Home/Quizzes" },
    { title: "Memories", icon: "images", route: "/(tabs)/Home/Memories" },
    { title: "Together", icon: "people", route: "/(tabs)/Home/Calendar" },
    { title: "AI Help", icon: "sparkles", route: "/(tabs)/Home/Calendar" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {user?.name || user?.email?.split("@")[0]}!
        </Text>
        <Text style={styles.partnerName}>
          ❤️ Partner: {partner?.name || partner?.email.split("@")[0]}
        </Text>
      </View>
      <Text style={styles.title}>Welcome 💖</Text>
      <View style={styles.grid}>
        {features.map((feature: any, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            onPress={() => router.push(feature.route)}
          >
            <Ionicons name={feature.icon} size={32} color="#ec4899" />
            <Text style={styles.cardText}>{feature.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 20,
    backgroundColor: "#ec4899",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  partnerName: {
    fontSize: 16,
    color: "#fbcfe8",
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ec4899",
    marginBottom: 20,
    alignSelf: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  card: {
    width: "47%",
    backgroundColor: "#fde2e4",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  cardText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "600",
    color: "#ec4899",
  },
});
