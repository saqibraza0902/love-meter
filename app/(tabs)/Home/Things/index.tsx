import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "@/navigation/router-compat";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenBackButton from "@/components/ScreenBackButton";

const categories: { title: string; description: string; icon: string; slug: string; tint: string }[] = [
  { title: "Travel", description: "Plan a little escape", icon: "airplane-outline", slug: "travel", tint: "#f2e8d8" },
  { title: "Movie nights", description: "Pick something to watch", icon: "film-outline", slug: "watch-movies", tint: "#f0dfdc" },
  { title: "Cook together", description: "Find a recipe to try", icon: "restaurant-outline", slug: "cook-together", tint: "#e8eee7" },
  { title: "Explore nature", description: "Get outside together", icon: "leaf-outline", slug: "explore-nature", tint: "#e8eee7" },
  { title: "Read together", description: "Start a tiny book club", icon: "book-outline", slug: "read-books", tint: "#f2e8d8" },
  { title: "Home projects", description: "Make your space yours", icon: "home-outline", slug: "home-projects", tint: "#f0dfdc" },
  { title: "Dream dates", description: "Turn an idea into a plan", icon: "heart-outline", slug: "dream-date", tint: "#f0dfdc" },
  { title: "Something else", description: "Browse more ideas", icon: "sparkles-outline", slug: "others", tint: "#f2e8d8" },
];

const Things = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenBackButton label="Home" />
        <Text style={styles.eyebrow}>MAKE TIME FOR EACH OTHER</Text>
        <Text style={styles.title}>Things to do together</Text>
        <Text style={styles.subtitle}>Choose a mood and find a simple idea you can make your own.</Text>

        <View style={styles.grid}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item.slug}
              style={styles.card}
              onPress={() => router.push(`/(tabs)/Home/Things/${item.slug}`)}
              activeOpacity={0.82}
            >
              <View style={[styles.iconTile, { backgroundColor: item.tint }]}>
                <Ionicons name={item.icon} size={23} color="#73585a" />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
              <Ionicons name="arrow-forward" size={16} color="#9a8e83" style={styles.arrow} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.note}><Ionicons name="heart-outline" size={16} color="#a65f65" /><Text style={styles.noteText}>Small plans can become favorite memories.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Things;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f2eb" },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  eyebrow: { color: "#8a7770", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 6 },
  title: { color: "#3f3832", fontSize: 26, fontWeight: "800", marginTop: 6 },
  subtitle: { color: "#82766d", fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48.3%", minHeight: 145, backgroundColor: "#fffdfa", borderRadius: 19, borderColor: "#e9dfd3", borderWidth: 1, padding: 14, marginBottom: 11 },
  iconTile: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 11 },
  cardTitle: { color: "#4a413a", fontSize: 14, fontWeight: "700" },
  cardDescription: { color: "#82766d", fontSize: 11, lineHeight: 16, marginTop: 4, paddingRight: 4 },
  arrow: { position: "absolute", right: 13, top: 14 },
  note: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 3 },
  noteText: { color: "#82766d", fontSize: 11 },
});
