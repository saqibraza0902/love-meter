import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85;
const CARD_MARGIN = width * 0.05;

// Using only the specified colors for boxes
const boxColors = [
  "#f8a5d1", // Darker version of #fbc2eb
  "#f87fa6", // Darker version of #f78ca0
  "#f9b8d4", // Darker version of #fccde2
  "#d95d8f", // Darker version of #fddde6
  "#f5b1ce", // Darker version of #f8c6d8
];

// Repeating colors if we have more categories than colors
const categories = [
  { title: "Travel Adventures", icon: "airplane", slug: "travel" },
  { title: "Movie Nights", icon: "film", slug: "watch-movies" },
  { title: "Cooking Together", icon: "restaurant", slug: "cook-together" },
  { title: "Nature Exploration", icon: "leaf", slug: "explore-nature" },
  { title: "Book Club", icon: "book", slug: "read-books" },
  { title: "Home Projects", icon: "home", slug: "home-projects" },
  { title: "Dream Dates", icon: "heart", slug: "dream-date" },
  { title: "Other Activities", icon: "ellipsis-horizontal", slug: "others" },
].map((item, index) => ({
  ...item,
  color: boxColors[index % boxColors.length], // Cycle through the specified colors
}));

type Category = {
  title: string;
  icon: string | any;
  slug: string;
  color: string;
};
type CategoryCardProps = {
  item: Category;
  index: number;
  pulse: Animated.SharedValue<number>;
  onUserInteraction: () => void;
};

const CategoryCard: React.FC<CategoryCardProps> = ({
  item,
  index,
  pulse,
  onUserInteraction,
}) => {
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
    onUserInteraction();
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(600)}
      layout={Layout.springify().mass(0.6)}
      style={styles.cardWrapper}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => router.push(`/(tabs)/Home/Things/${item.slug}`)}
      >
        <Animated.View
          style={[styles.card, animatedStyle, { backgroundColor: item.color }]}
        >
          <View style={styles.cardContent}>
            <Ionicons
              name={item.icon}
              size={40}
              color="white"
              style={styles.cardIcon}
            />
            <Text style={styles.cardText}>{item.title}</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const Things = () => {
  const pulse = useSharedValue(1);
  const inactivityTimeout = useRef<NodeJS.Timeout | null>(null);

  const resetPulse = () => {
    pulse.value = 1;
  };

  const triggerPulse = () => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 800, easing: Easing.ease }),
        withTiming(1, { duration: 800, easing: Easing.ease })
      ),
      -1,
      true
    );
  };

  const resetInactivityTimer = () => {
    if (inactivityTimeout.current) {
      clearTimeout(inactivityTimeout.current);
    }
    resetPulse();
    inactivityTimeout.current = setTimeout(() => {
      triggerPulse();
    }, 8000);
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimeout.current) clearTimeout(inactivityTimeout.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(500)}
        layout={Layout.duration(300)}
      >
        <Animated.Text entering={FadeInDown.duration(700)} style={styles.title}>
          Together Activities
        </Animated.Text>
        <Text style={styles.subtitle}>Create beautiful memories together</Text>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {categories.map((item, index) => (
            <CategoryCard
              key={item.title}
              item={item}
              index={index}
              pulse={pulse}
              onUserInteraction={resetInactivityTimer}
            />
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default Things;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
    fontWeight: "500",
  },
  scrollContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  cardWrapper: {
    width: CARD_WIDTH,

    marginBottom: 20,
  },
  card: {
    width: "100%",
    height: 140,
    borderRadius: 24,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  cardContent: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  cardIcon: {
    marginBottom: 15,
  },
  cardText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
