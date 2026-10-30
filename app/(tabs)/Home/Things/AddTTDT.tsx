import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Image,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "@/utils/image-picker-compat";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "@/navigation/router-compat";
import { getCurrentUser, supabase, uploadImage } from "@/utils/supabase";
import ScreenBackButton from "@/components/ScreenBackButton";

const AddTTDT = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const { slug } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert(
        "Permission required",
        "Permission to access media library is required!"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri || null);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return;
    }

    setLoading(true);
    setUploadProgress(null);

    try {
      let imageUrl = null;
      if (imageUri) {
        const user = await getCurrentUser();
        if (!user) throw new Error("Please sign in first.");
        imageUrl = await uploadImage(imageUri, `${user.id}/things/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`, "public-content", setUploadProgress);
      }

      const user = await getCurrentUser();
      if (!user) throw new Error("Please sign in first.");
      const { error } = await supabase.from("things_to_do").insert({
        title: title.trim(),
        description: description.trim() || null,
        link: link.trim() || null,
        image_path: imageUrl || null,
        created_by: user.id,
        slug: slug || null,
      });
      if (error) throw error;

      Alert.alert("Success", "Item added successfully!");
      setTitle("");
      setDescription("");
      setLink("");
      setImageUri(null);
    } catch (error) {
      console.error("Could not save activity", error);
      Alert.alert("Couldn't save item", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenBackButton label="Back to ideas" />
        <Text style={styles.title}>Add New TTDT</Text>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter title"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter description"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Link</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter link"
          value={link}
          onChangeText={setLink}
          keyboardType="url"
          autoCapitalize="none"
        />

        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} />
          ) : (
            <Text>Select Image</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledButton]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.saveButtonText, { marginLeft: 10 }]}>
                Uploading...
              </Text>
              {uploadProgress !== null && (
                <Text style={styles.saveButtonText}> ({uploadProgress}%)</Text>
              )}
            </View>
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddTTDT;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f7f2eb",
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#a65f65",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    marginTop: 15,
    marginBottom: 6,
    fontWeight: "600",
    fontSize: 16,
    color: "#a65f65",
  },
  input: {
    borderWidth: 1,
    borderColor: "#a65f65",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fcf5f2",
    color: "#4a413a",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  imagePicker: {
    width: "100%",
    height: 200,
    backgroundColor: "#fffdfa",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#a65f65",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    resizeMode: "cover",
  },
  saveButton: {
    backgroundColor: "#a65f65",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
    shadowColor: "#a65f65",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    opacity: 0.7,
  },
});
