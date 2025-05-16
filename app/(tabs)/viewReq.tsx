import {
  Animated,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { fetchPendingRequests } from "@/utils/firebase-functions/pending-req";
import { acceptPairingRequest } from "@/utils/firebase-functions/accept-pair-req";
import { auth } from "@/utils/firebase";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DEFAULT_PROFILE } from "@/utils/default-url";
const RequestCard = ({
  request,
  onAccept,
  onReject,
}: {
  request: any;
  onAccept: () => void;
  onReject: () => void;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Image source={{ uri: DEFAULT_PROFILE }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>{request.fromUserEmail}</Text>
          <Text style={styles.requestText}>wants to pair with you</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onAccept}
        >
          <Ionicons name="checkmark" size={20} color="white" />
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onReject}
        >
          <Ionicons name="close" size={20} color="white" />
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
const viewReq = () => {
  const [requests, setRequests] = useState<any>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async () => {
    try {
      const pendingRequests = await fetchPendingRequests();
      setRequests(pendingRequests);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleAccept = async (requestId: string, fromUserId: string) => {
    if (auth.currentUser?.uid) {
      await acceptPairingRequest(requestId, fromUserId, auth.currentUser.uid);
    } else {
      console.error("User ID is undefined.");
    }
    // Refresh the list after action
    setRequests(requests.filter((req: any) => req.id !== requestId));
  };
  const handleReject = (requestId: string) => {
    // Your reject logic
    setRequests((prev: any) => prev.filter((req: any) => req.id !== requestId));
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4ade80"]}
            tintColor="#4ade80"
            progressBackgroundColor="#ffffff"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pairing Requests</Text>
          <Text style={styles.headerSubtitle}>
            {requests.length} pending request{requests.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color="#6b7280" />
            <Text style={styles.emptyText}>No pending requests</Text>
            <Text style={styles.emptySubtext}>
              Pull down to refresh or wait for new requests
            </Text>
          </View>
        ) : (
          <View style={styles.listContent}>
            {requests.map((item: any) => (
              <RequestCard
                key={item.id}
                request={item}
                onAccept={() => handleAccept(item.id, item.fromUserId)}
                onReject={() => handleReject(item.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default viewReq;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#e2e8f0",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  requestText: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: "#4ade80",
  },
  rejectButton: {
    backgroundColor: "#f87171",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
});
