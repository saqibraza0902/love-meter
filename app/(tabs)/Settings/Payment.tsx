import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

const PaymentScreen = () => {
  const [transactionId, setTransactionId] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    if (!transactionId || !imageUri) {
      alert("Please enter transaction ID and upload the screenshot.");
      return;
    }

    // Submit logic here: send imageUri and transactionId to Firestore or backend
    alert("Payment proof submitted. We'll verify and upgrade your account.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Upgrade to Premium</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.infoTitle}>Send $5 USD to:</Text>
          <Text style={styles.text}>
            Binance Email: yourbinanceemail@example.com
          </Text>
          <Text style={styles.text}>Network: BUSD / BEP20</Text>

          <Text style={[styles.infoTitle, { marginTop: 20 }]}>
            Upload Payment Screenshot
          </Text>
          <TouchableOpacity style={styles.imageBox} onPress={handlePickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} />
            ) : (
              <Text style={styles.imageText}>Tap to Upload</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.infoTitle}>Transaction ID</Text>
          <TextInput
            placeholder="Enter Transaction ID"
            value={transactionId}
            onChangeText={setTransactionId}
            style={styles.input}
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Submit Payment</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingBottom: 40 },
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
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 10,
  },
  text: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 4,
  },
  imageBox: {
    height: 180,
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  imageText: {
    color: "#475569",
    fontSize: 16,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  input: {
    height: 48,
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#ec4899",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default PaymentScreen;
