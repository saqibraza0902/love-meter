import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  Button,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from "react-native";
import React, { useState, useEffect } from "react";
import { Calendar, CalendarUtils } from "react-native-calendars";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  getDoc,
  updateDoc,
  arrayUnion,
  setDoc,
  doc,
  where,
  query,
} from "firebase/firestore";
import { db } from "@/utils/firebase";
import { useAppSelector } from "@/hooks/use-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "@/constants/colors";
import { useToast } from "native-base";

const HEIGHT = Dimensions.get("window").height;
const WIDTH = Dimensions.get("window").width;

// Upload memory function
async function uploadMemory(
  users: string[], // example: "couple123"
  date: string,
  text: string,
  base64Image: string
) {
  try {
    const docQuery = query(
      collection(db, "memories"),
      where("users", "array-contains-any", users)
    );
    const querySnapshot = await getDocs(docQuery);
    const docSnap = querySnapshot.docs[0];
    // const docSnap = await getDoc(docRef);
    // console.log("insidet docSnap", users);
    const newMemory = {
      date,
      text,
      image: base64Image,
    };

    if (docSnap?.exists()) {
      const docRef = doc(db, "memories", docSnap.id);
      // Document exists, just add memory
      await updateDoc(docRef, {
        memories: arrayUnion(newMemory),
      });
    } else {
      // Document does not exist, create with empty users (you can pass users if needed)
      await addDoc(collection(db, "memories"), {
        users: users, // or pass users array if you want
        memories: [newMemory],
      });
    }

    console.log("Memory added successfully!");
  } catch (error) {
    console.error("Error adding memory:", error);
    throw error;
  }
}

// Fetch all memories function
async function fetchMemories(users: string[]) {
  try {
    const memoriesQuery = query(
      collection(db, "memories"),
      where("users", "array-contains-any", users)
    );
    const memoriesSnapshot = await getDocs(memoriesQuery);
    const memoriesObj = memoriesSnapshot?.docs[0];
    // console.log("memories", memoriesObj?.data());
    const memories = {
      memories: memoriesObj?.data()?.memories,
      id: memoriesObj?.id,
    };
    return memories;
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
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [fullImageVisible, setFullImageVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  // const [imageDimensions, setImageDimensions] = useState({
  //   width: 0,
  //   height: 0,
  // });

  const [memories, setMemories] = useState<any>();
  const { partner, user } = useAppSelector((s) => s.user);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const users = [user?.id || "", partner?.id || ""];
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
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setMemoryImage(asset.uri);
      setBase64Image(`data:image/jpeg;base64,${asset.base64}`);
    }
  };

  const saveMemory = async () => {
    if (!memoryText || !base64Image) {
      console.log("Please select an image and write a memory!");
      toast.show({
        title: "Toast",
        // position: "absolute",
        // bottom: 200,
        zIndex: 10000,
        // duration: 3000,
      });
      return;
    }

    if (memoryText.split(" ").length > 20) {
      toast.show({ description: "Please limit your memory to 20 words." });
      return;
    }

    try {
      await uploadMemory(users, selectedDate!, memoryText, base64Image);
      toast.show({ description: "Memory saved successfully!" });
      // Reset states
      setModalVisible(false);
      setMemoryText("");
      setMemoryImage(null);
      setBase64Image(null);
      loadMemories(); // Reload memories
    } catch (error) {
      toast.show({ description: "Failed to save memory. Please try again." });
    }
  };

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <Text style={styles.title}>Your Memories</Text>

        {loading ? (
          <View style={{ height: "100%" }}>
            <ActivityIndicator size="large" color="#f472b6" />
          </View>
        ) : (
          <FlatList
            data={memories.memories}
            showsVerticalScrollIndicator={false}
            keyExtractor={(item) => Math.random().toString()}
            renderItem={({ item }) => (
              <View key={Math.random()} style={styles.memoryCard}>
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
              <Text style={styles.noMemoryText}>
                No memories yet. Start adding some!
              </Text>
            }
          />
        )}

        <Pressable
          onPress={() => setCalendarVisible(true)}
          style={styles.addButton}
        >
          <Text style={styles.btnText}>Add Memory</Text>
        </Pressable>
        <Modal visible={fullImageVisible} transparent animationType="fade">
          <Pressable
            style={styles.fullImageContainer}
            onPress={() => setFullImageVisible(false)}
          >
            <Image
              source={{ uri: selectedImageUri! }}
              style={{
                width: "100%",
                height: "100%",
                resizeMode: "contain",
              }}
            />
          </Pressable>
        </Modal>
        {/* Calendar Modal */}
        <Modal visible={calendarVisible}>
          <View style={styles.modalContent}>
            <Text style={styles.selectDateText}>Select a date</Text>
            <Calendar
              style={styles.calendar}
              current={currentDate}
              onDayPress={handleDayPress}
              hideArrows={false} // hides next/prev month arrows
              disableMonthChange={true} // disables swiping between months
              theme={{
                selectedDayBackgroundColor: "#f472b6",
                todayTextColor: "#f472b6",
              }}
            />
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setCalendarVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Add Memory Modal */}
        <Modal visible={modalVisible} animationType="slide">
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.dateText}>Memory for: {selectedDate}</Text>

            <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
              {memoryImage ? (
                <Image source={{ uri: memoryImage }} style={styles.image} />
              ) : (
                <Text>Select Image</Text>
              )}
            </TouchableOpacity>

            <TextInput
              placeholder="Write a short memory (20 words max)"
              value={memoryText}
              onChangeText={setMemoryText}
              multiline
              style={styles.textInput}
            />

            <TouchableOpacity style={styles.modalButton} onPress={saveMemory}>
              <Text style={styles.modalButtonText}>Save Memory</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#fca5a5" }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default CalendarScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff1f2", // soft pink background
    padding: 20,
    height: "100%",
  },
  calendar: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ec4899",
    marginBottom: 20,
    textAlign: "center",
  },
  memoryCard: {
    backgroundColor: "#fdf2f8", // softer pink-lavender for a gentle tone
    padding: 18,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: "#ec4899",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: "#fbcfe8", // adds a soft highlight edge
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
    backgroundColor: COLORS.primary_btn,
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
  modalContent: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  selectDateText: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
    color: "#ec4899",
  },
  dateText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
    color: "#ec4899",
  },
  imagePicker: {
    width: 200,
    height: 200,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderRadius: 12,
    alignSelf: "center",
    borderWidth: 2,
    borderColor: "#ec4899",
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  textInput: {
    borderColor: "#ec4899",
    borderWidth: 1,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    height: 100,
    marginBottom: 20,
    textAlignVertical: "top",
    backgroundColor: "#fff0f6",
    color: "#374151",
  },
  modalButton: {
    backgroundColor: "#ec4899",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#ec4899",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  fullImageContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
});
