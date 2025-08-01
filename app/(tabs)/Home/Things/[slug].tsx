import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
// import { Pressable } from "native-base";
import { db } from "@/utils/firebase";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
export type TThing = {
  id: string;
  createdAt: Timestamp;
  description: string | null;
  imageUrl: string;
  link: string;
  slug: string;
  title: string;
};

const Details = () => {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TThing[] | []>([]);
  const animationRefs = useRef<Animated.Value[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "ttdt"), where("slug", "==", slug));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as TThing)
        );
        setItems(data);

        // Create refs for animation
        animationRefs.current = data.map(() => new Animated.Value(0));

        // Start animations
        Animated.stagger(
          100,
          animationRefs.current.map((ref) =>
            Animated.timing(ref, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            })
          )
        ).start();
      } catch (err) {
        console.error("Failed to fetch items:", err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchData();
  }, [slug]);

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <Text style={styles.title}>Items for: {slug}</Text>

        {loading ? (
          <View style={{ height: "100%" }}>
            <ActivityIndicator size="large" color="#f472b6" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const animationStyle = {
                opacity: animationRefs.current[index],
                transform: [
                  {
                    translateY: animationRefs.current[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              };

              return (
                <Animated.View style={[styles.memoryCard, animationStyle]}>
                  {item.imageUrl && (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.memoryImage}
                    />
                  )}
                  <Text style={styles.memoryDate}>
                    {item.createdAt.toDate().toLocaleDateString() || "No Date"}
                  </Text>
                  <Text style={styles.memoryText}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.memoryText}>{item.description}</Text>
                  )}
                  {item.link && (
                    <Text style={[styles.memoryText, { color: "#3b82f6" }]}>
                      {item.link}
                    </Text>
                  )}
                </Animated.View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.noMemoryText}>No entries found.</Text>
            }
          />
        )}

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(tabs)/Home/Things/AddTTDT",
              params: { slug: slug },
            })
          }
          style={styles.addButton}
        >
          <Text style={styles.btnText}>Add Entry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default Details;
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff1f2",
    padding: 20,
    height: "100%",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ec4899",
    marginBottom: 20,
    textAlign: "center",
  },
  memoryCard: {
    backgroundColor: "#fdf2f8",
    padding: 18,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: "#ec4899",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: "#fbcfe8",
  },
  memoryImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    resizeMode: "cover",
    marginBottom: 10,
  },
  memoryDate: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ec4899",
    marginBottom: 4,
  },
  memoryText: {
    fontSize: 14,
    color: "#4b5563",
  },
  addButton: {
    marginTop: 10,
    backgroundColor: "#ec4899",
    borderRadius: 12,
    paddingVertical: 15,
  },
  btnText: {
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  noMemoryText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#9ca3af",
  },
});
