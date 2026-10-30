import { StyleSheet, Text, View, Animated, Easing } from "react-native";
import React, { useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "@/navigation/router-compat";
import withAuth from "@/hooks/use-with-auth";

const OnBoarding = () => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current; // opacity
  const slideAnim = useRef(new Animated.Value(20)).current; // Y axis

  useEffect(() => {
    // Run animations in parallel
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();

    // Redirect to login after 3 seconds
    const timeout = setTimeout(() => {
      router.replace("/login");
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.animatedBox,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.heading}>Welcome to the App!</Text>
        <Text style={styles.subtext}>Redirecting to login...</Text>
      </Animated.View>
    </SafeAreaView>
  );
};

export default withAuth(OnBoarding);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    justifyContent: "center",
    alignItems: "center",
  },
  animatedBox: {
    alignItems: "center",
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  subtext: {
    marginTop: 10,
    color: "#ccc",
  },
});
