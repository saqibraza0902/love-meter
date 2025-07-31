import React from "react";
import { SafeAreaView, ScrollView, Text, View, StyleSheet } from "react-native";

const PrivacyPolicy = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
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

          <Text style={styles.sectionTitle}>5. Changes</Text>
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
    color: "#ec4899",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#f9fafb",
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
    color: "#475569",
    marginTop: 15,
  },
  text: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 8,
    lineHeight: 22,
  },
});

export default PrivacyPolicy;
