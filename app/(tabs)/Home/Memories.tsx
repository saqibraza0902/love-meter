import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { db } from "@/utils/firebase";
import { uploadImageAsync } from "@/utils/firebase-functions/upload-img";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";

const HEIGHT = Dimensions.get("window").height;

async function uploadMemory(
  users: string[],
  date: string,
  text: string,
  imageUrl: string
) {
  try {
    const docQuery = query(
      collection(db, "memories"),
      where("users", "array-contains-any", users)
    );
    const querySnapshot = await getDocs(docQuery);
    const docSnap = querySnapshot.docs[0];
    const newMemory = { date, text, image: imageUrl };

    if (docSnap?.exists()) {
      const docRef = doc(db, "memories", docSnap.id);
      await updateDoc(docRef, {
        memories: arrayUnion(newMemory),
      });
    } else {
      await addDoc(collection(db, "memories"), {
        users: users,
        memories: [newMemory],
      });
    }
  } catch (error) {
    console.error("Error adding memory:", error);
    throw error;
  }
}

async function fetchMemories(users: string[]) {
  try {
    const memoriesQuery = query(
      collection(db, "memories"),
      where("users", "array-contains-any", users)
    );
    const memoriesSnapshot = await getDocs(memoriesQuery);
    const memoriesObj = memoriesSnapshot?.docs[0];
    return {
      memories: memoriesObj?.data()?.memories,
      id: memoriesObj?.id,
    };
  } catch (error) {
    console.log(error);
  }
}

const CalendarScreen = () => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [memoryText, setMemoryText] = useState("");
  const [memoryImage, setMemoryImage] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [memories, setMemories] = useState<any>();
  const { partner, user } = useAppSelector((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const [fullImageVisible, setFullImageVisible] = useState(false);

  const users = [user?.id || "", partner?.id || ""];
  const currentDate = new Date();
  const month = currentDate.toLocaleString("default", { month: "short" });
  const day = currentDate.getDate();
  const year = currentDate.getFullYear();

  // Gradient colors matching the HomeScreen
  const gradientColors: [string, string] = ["#f78ca0", "#fbc2eb"];
  const cardGradients: [string, string][] = [
    ["#fbc2eb", "#f78ca0"],
    ["#fccde2", "#fddde6"],
    ["#f8c6d8", "#fbc2eb"],
    ["#f78ca0", "#fccde2"],
  ];

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    setLoading(true);
    const data = await fetchMemories(users);
    setMemories(data);
    setLoading(false);
  };

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setCalendarVisible(false);
    setModalVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: false,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setMemoryImage(asset.uri);
    }
  };

  const saveMemory = async () => {
    if (!memoryText || !memoryImage) {
      return toast("Please select an image and write a memory!");
    }

    if (memoryText.split(" ").length > 20) {
      return toast("Please limit your memory to 20 words.");
    }

    try {
      setUploading(true);
      const imageUrl = await uploadImageAsync(memoryImage, setUploadProgress);
      await uploadMemory(users, selectedDate!, memoryText, imageUrl);
      toast("Memory saved successfully!");

      setModalVisible(false);
      setMemoryText("");
      setMemoryImage(null);
      setUploadProgress(0);
      loadMemories();
    } catch (error) {
      toast("Failed to save memory. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <LinearGradient colors={["#f8fafc", "#fff1f2"]} style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={["#3d0c1f", "#d73772"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Memory Lane</Text>
            <Text style={styles.headerSubtitle}>
              Cherish your moments together
            </Text>
          </View>

          <View style={styles.coupleContainer}>
            <View style={styles.nameBadge}>
              <Text style={styles.nameInitial}>
                {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
              </Text>
            </View>

            <Ionicons
              name="heart"
              size={24}
              color="white"
              style={styles.heartIcon}
            />

            <View style={styles.nameBadge}>
              <Text style={styles.nameInitial}>
                {partner?.name?.charAt(0) ||
                  partner?.email?.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Memories List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f472b6" />
        </View>
      ) : (
        <FlatList
          data={memories?.memories}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => (
            <LinearGradient
              colors={cardGradients[index % cardGradients.length]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.memoryCard}
            >
              <TouchableOpacity
                onPress={() => {
                  setSelectedImageUri(item.image);
                  setFullImageVisible(true);
                }}
              >
                <Image
                  source={{ uri: item.image }}
                  style={styles.memoryImage}
                />
              </TouchableOpacity>
              <Text style={styles.memoryDate}>{item.date}</Text>
              <Text style={styles.memoryText}>{item.text}</Text>
            </LinearGradient>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images" size={48} color="#fbcfe8" />
              <Text style={styles.noMemoryText}>
                No memories yet. Start adding some!
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        onPress={() => setCalendarVisible(true)}
        style={styles.addButton}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.addButtonGradient}
        >
          <Ionicons name="add" size={30} color="white" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Full Image Modal */}
      <Modal visible={fullImageVisible} transparent animationType="fade">
        <Pressable
          style={styles.fullImageContainer}
          onPress={() => setFullImageVisible(false)}
        >
          <Image
            source={{ uri: selectedImageUri! }}
            style={{ width: "100%", height: "100%", resizeMode: "contain" }}
          />
        </Pressable>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={calendarVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <LinearGradient
            colors={["#fdf2f8", "#fce7f3"]}
            style={styles.modalContainer}
          >
            <Text style={styles.modalTitle}>Select a Date</Text>
            <View style={styles.calendarWrapper}>
              <Calendar
                current={new Date().toISOString().split("T")[0]}
                onDayPress={handleDayPress}
                theme={{
                  selectedDayBackgroundColor: "#ec4899",
                  todayTextColor: "#ec4899",
                  textDayFontWeight: "600",
                  textMonthFontWeight: "bold",
                  textDayHeaderFontWeight: "600",
                  arrowColor: "#ec4899",
                  textDisabledColor: "#cbd5e1",
                  dotColor: "#ec4899",
                  selectedDotColor: "#fff",
                }}
                style={styles.calendar}
              />
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCalendarVisible(false)}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Add Memory Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <LinearGradient
            colors={["#fdf2f8", "#fce7f3"]}
            style={styles.memoryModalContainer}
          >
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>Memory for {selectedDate}</Text>

              <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                {memoryImage ? (
                  <Image source={{ uri: memoryImage }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image" size={48} color="#fbcfe8" />
                    <Text style={styles.placeholderText}>Select Image</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TextInput
                placeholder="Write a short memory (20 words max)"
                placeholderTextColor="#9ca3af"
                value={memoryText}
                onChangeText={setMemoryText}
                multiline
                style={styles.textInput}
                editable={!uploading}
              />

              {uploadProgress > 0 && uploadProgress < 100 && (
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${uploadProgress}%` },
                    ]}
                  />
                  <Text style={styles.progressText}>
                    Uploading: {uploadProgress}%
                  </Text>
                </View>
              )}

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    uploading && styles.disabledButton,
                  ]}
                  disabled={uploading}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.saveButton,
                    uploading && styles.disabledButton,
                  ]}
                  disabled={uploading}
                  onPress={saveMemory}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.subbuttonText}>Save Memory</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
};

export default CalendarScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextContainer: {
    maxWidth: "60%",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "white",
    marginBottom: 5,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  coupleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  nameInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  heartIcon: {
    marginHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "white",
    marginBottom: 15,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  namesContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  memoryCard: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  memoryImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 12,
    resizeMode: "cover",
  },
  memoryDate: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  memoryText: {
    fontSize: 15,
    color: "white",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonGradient: {
    flex: 1,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  noMemoryText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#9ca3af",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImageContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    borderRadius: 24,
    padding: 24,
    paddingTop: 40,
    maxHeight: "80%",
  },
  calendarWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  calendar: {
    padding: 12,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 8,
    elevation: 3,
  },
  memoryModalContainer: {
    width: "90%",
    borderRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 24,
  },
  imagePicker: {
    width: "100%",
    height: 260,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#fbcfe8",
    borderStyle: "dashed",
    overflow: "hidden",
    elevation: 3,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  placeholderText: {
    marginTop: 12,
    color: "#9ca3af",
    fontWeight: "500",
    fontSize: 16,
  },
  textInput: {
    borderColor: "#fbcfe8",
    borderWidth: 2,
    width: "100%",
    padding: 20,
    borderRadius: 20,
    minHeight: 140,
    marginBottom: 24,
    textAlignVertical: "top",
    backgroundColor: "#fff",
    color: "#334155",
    fontSize: 16,
    elevation: 2,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
  },
  saveButton: {
    backgroundColor: "#ec4899",
  },
  cancelButton: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#64748b",
  },
  disabledButton: {
    opacity: 0.6,
  },
  subbuttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  progressContainer: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    marginBottom: 24,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#ec4899",
  },
  progressText: {
    textAlign: "center",
    marginBottom: 16,
    color: "#64748b",
    fontWeight: "500",
  },
});
