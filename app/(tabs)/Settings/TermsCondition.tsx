import React from "react";
import { SafeAreaView, ScrollView, Text, View, StyleSheet } from "react-native";

const TermsConditions = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Terms & Conditions</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Acceptance</Text>
          <Text style={styles.text}>
            By using the Love Quotes app, you agree to these Terms & Conditions.
            If you do not agree, please do not use the app.
          </Text>

          <Text style={styles.sectionTitle}>2. Usage</Text>
          <Text style={styles.text}>
            You may use the app for personal, non-commercial purposes only.
          </Text>

          <Text style={styles.sectionTitle}>3. Content</Text>
          <Text style={styles.text}>
            All quotes and media are either user-generated or from public
            sources. You must not misuse the content.
          </Text>

          <Text style={styles.sectionTitle}>4. Termination</Text>
          <Text style={styles.text}>
            We reserve the right to suspend or terminate accounts that violate
            these terms.
          </Text>

          <Text style={styles.sectionTitle}>5. Changes</Text>
          <Text style={styles.text}>
            Terms may be updated at any time. Continued use constitutes
            acceptance of changes.
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

export default TermsConditions;
