import React from "react";
import { SafeAreaView, ScrollView, Text, View, StyleSheet } from "react-native";
import ScreenBackButton from "@/components/ScreenBackButton";

const PrivacyPolicy = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ paddingHorizontal: 20 }}><ScreenBackButton label="Settings" /></View>
        <View style={styles.header}>
          <Text style={styles.title}>Privacy Policy</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.text}>
            This Privacy Policy explains how we collect, use, and protect your
            personal information when you use the Love Quotes app.
          </Text>

          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.text}>
            We may collect your email, name, photo URL, bio, and any content you
            create while using the app.
          </Text>

          <Text style={styles.sectionTitle}>3. How We Use Information</Text>
          <Text style={styles.text}>
            We use your data to personalize your experience, improve the app,
            and communicate updates or offers.
          </Text>

          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.text}>
            We use industry-standard measures to protect your data from
            unauthorized access.
          </Text>

          <Text style={styles.sectionTitle}>5. Optional AI relationship help</Text>
          <Text style={styles.text}>
            The relationship guide is optional. It will only receive your question, both partnersâ€™ profile bios, and up to 30 recent shared messages after both partners have opted in. You can withdraw your consent in the guide at any time. Questions and answers are not saved to your app account; the configured AI provider processes the request to generate a response, and its own privacy and retention terms also apply.
          </Text>

          <Text style={styles.sectionTitle}>6. Changes</Text>
          <Text style={styles.text}>
            We may update this policy. Changes will be posted in the app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingBottom: 30 },
  header: {
    paddingTop: 30,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#a65f65",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fffdfa",
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4a413a",
    marginTop: 15,
  },
  text: {
    fontSize: 16,
    color: "#82766d",
    marginTop: 8,
    lineHeight: 22,
  },
});

export default PrivacyPolicy;
