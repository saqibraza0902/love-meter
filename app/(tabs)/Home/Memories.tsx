import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { getMediaUrl, supabase, uploadImage } from "@/utils/supabase";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "@/utils/image-picker-compat";
import { LinearGradient } from "react-native-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenBackButton from "@/components/ScreenBackButton";

async function uploadMemory(
  coupleId: string,
  userId: string,
  date: string,
  text: string,
  imageUrl: string
) {
  const { error } = await supabase.from("memories").insert({
    couple_id: coupleId, created_by: userId, memory_date: date, text, image_path: imageUrl,
  });
  if (error) throw error;
}

async function fetchMemories(coupleId?: string) {
  if (!coupleId) return { memories: [] };
  const { data, error } = await supabase.from("memories").select("*")
    .eq("couple_id", coupleId).order("memory_date", { ascending: false });
  if (error) throw error;
  const memories = await Promise.all((data || []).map(async (item) => ({
    date: item.memory_date, text: item.text,
    image: item.image_path ? await getMediaUrl(item.image_path) : "",
  })));
  return { memories };
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
  const { top } = useSafeAreaInsets();

  const gradientColors: [string, string] = ["#a65f65", "#f0dfdc"];

  useEffect(() => {
    loadMemories();
  }, [user?.coupleId]);

  const loadMemories = async () => {
    setLoading(true);
    try { const data = await fetchMemories(user?.coupleId); setMemories(data); }
    catch (error) { console.warn("Could not load memories", error); }
    finally { setLoading(false); }
  };

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setCalendarVisible(false);
    setModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return toast("Allow photo library access to add a memory image.");
      const result = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 0.7 });
      if (!result.canceled && result.assets.length > 0) setMemoryImage(result.assets[0].uri || null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't open your photo library.");
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
      if (!user?.id || !user.coupleId) throw new Error("Pair your account before adding memories.");
      const imageUrl = await uploadImage(memoryImage, `${user.coupleId}/memories/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`, "private-media", setUploadProgress);
      await uploadMemory(user.coupleId, user.id, selectedDate!, memoryText, imageUrl);
      toast("Memory saved successfully!");

      setModalVisible(false);
      setMemoryText("");
      setMemoryImage(null);
      setUploadProgress(0);
      loadMemories();
    } catch (error) {
      console.error("Could not save memory", error);
      toast(error instanceof Error ? error.message : "Failed to save memory. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <LinearGradient colors={["#f7f2eb", "#f7f2eb"]} style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header with Gradient */}
      <LinearGradient
        colors={["#a65f65", "#bd8078"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: top + 16 }]}
      >
        <ScreenBackButton label="Home" light />
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
          <ActivityIndicator size="large" color="#a65f65" />
        </View>
      ) : (
        <FlatList
          data={memories?.memories}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.memoryCard}>
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
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color="#e2c5c1" />
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
            colors={["#fcf5f2", "#f0dfdc"]}
            style={styles.modalContainer}
          >
            <Text style={styles.modalTitle}>Select a Date</Text>
            <View style={styles.calendarWrapper}>
              <Calendar
                current={new Date().toISOString().split("T")[0]}
                onDayPress={handleDayPress}
                theme={{
                  selectedDayBackgroundColor: "#a65f65",
                  todayTextColor: "#a65f65",
                  textDayFontWeight: "600",
                  textMonthFontWeight: "bold",
                  textDayHeaderFontWeight: "600",
                  arrowColor: "#a65f65",
                  textDisabledColor: "#cbd5e1",
                  dotColor: "#a65f65",
                  selectedDotColor: "#fff",
                }}
                style={styles.calendar}
              />
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCalendarVisible(false)}
            >
              <Ionicons name="close" size={24} color="#82766d" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Add Memory Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <LinearGradient
            colors={["#fcf5f2", "#f0dfdc"]}
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
                    <Ionicons name="image-outline" size={48} color="#e2c5c1" />
                    <Text style={styles.placeholderText}>Select Image</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TextInput
                placeholder="Write a short memory (20 words max)"
                placeholderTextColor="#9a8e83"
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
    paddingTop: 16,
    paddingBottom: 30,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#795856",
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
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "#e9dfd3",
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
    color: "#a65f65",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  memoryText: {
    fontSize: 15,
    color: "#4a413a",
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
    color: "#9a8e83",
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
    color: "#3f3832",
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
    borderColor: "#e2c5c1",
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
    backgroundColor: "#f7f2eb",
  },
  placeholderText: {
    marginTop: 12,
    color: "#9a8e83",
    fontWeight: "500",
    fontSize: 16,
  },
  textInput: {
    borderColor: "#e2c5c1",
    borderWidth: 2,
    width: "100%",
    padding: 20,
    borderRadius: 20,
    minHeight: 140,
    marginBottom: 24,
    textAlignVertical: "top",
    backgroundColor: "#fff",
    color: "#4a413a",
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
    backgroundColor: "#a65f65",
  },
  cancelButton: {
    backgroundColor: "#f7f2eb",
    borderWidth: 1,
    borderColor: "#e9dfd3",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#82766d",
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
    backgroundColor: "#e9dfd3",
    borderRadius: 4,
    marginBottom: 24,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#a65f65",
  },
  progressText: {
    textAlign: "center",
    marginBottom: 16,
    color: "#82766d",
    fontWeight: "500",
  },
});
