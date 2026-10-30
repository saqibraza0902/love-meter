import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { acceptPairingRequest, getActiveCouple, getCurrentUser, loadPendingRequests, rejectPairingRequest, supabase } from "@/utils/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAppDispatch, useAppSelector } from "@/hooks/use-redux";
import { setPartner, setUser } from "@/redux/slices/user-slice";
import { useFocusEffect, useRouter } from "@/navigation/router-compat";
import { useToast } from "@/providers/toast-provider";
import ScreenBackButton from "@/components/ScreenBackButton";
const RequestCard = ({
  request,
  onAccept,
  onReject,
  processingId,
}: {
  request: any;
  onAccept: () => void;
  onReject: () => void;
  processingId: string | null;
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
  const working = processingId === request.id;

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
        <View style={styles.avatar}><Ionicons name="person" size={23} color="#6d8777" /></View>
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>{request.fromUserEmail}</Text>
          <Text style={styles.requestText}>wants to pair with you</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          disabled={!!processingId}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onAccept}
        >
          {working ? <ActivityIndicator color="white" size="small" /> : <><Ionicons name="checkmark" size={20} color="white" /><Text style={styles.buttonText}>Accept</Text></>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          disabled={!!processingId}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onReject}
        >
          {working ? <ActivityIndicator color="white" size="small" /> : <><Ionicons name="close" size={20} color="white" /><Text style={styles.buttonText}>Decline</Text></>}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
const viewReq = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.user);
  const { toast } = useToast();
  const [requests, setRequests] = useState<any>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const pendingRequests = await loadPendingRequests();
      setRequests(pendingRequests);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setRefreshing(false);
      setLoadingRequests(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchRequests();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void getCurrentUser().then((authUser) => {
      if (!active || !authUser) return;
      channel = supabase.channel(`incoming-requests:${authUser.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pairing_requests", filter: `to_user_id=eq.${authUser.id}` }, () => {
          void fetchRequests();
        })
        .subscribe();
    }).catch((error) => console.warn("Could not subscribe to pairing requests", error));
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchRequests]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleAccept = async (requestId: string) => {
    if (processingId) return;
    setProcessingId(requestId);
    try {
      const authUser = await getCurrentUser();
      if (!authUser) throw new Error("Please sign in again.");
      await acceptPairingRequest(requestId);
      const couple = await getActiveCouple(authUser.id);
      if (!couple) throw new Error("Connected, but your shared space is still loading. Please try again in a moment.");
      dispatch(setUser({ ...user, id: authUser.id, partnerId: couple.partner.id, isPaired: true, coupleId: couple.id } as any));
      dispatch(setPartner({ ...couple.partner, photoURL: couple.partner.photo_path, partnerId: authUser.id, isPaired: true, coupleId: couple.id } as any));
      setRequests((previous: any[]) => previous.filter((request) => request.id !== requestId));
      toast("You're connected. Your shared space is ready!");
      router.replace("/(tabs)/Home");
    } catch (error: any) {
      toast(error?.message || "Could not accept this request. Please try again.");
      void fetchRequests();
    } finally {
      setProcessingId(null);
    }
  };
  const handleReject = async (requestId: string) => {
    if (processingId) return;
    setProcessingId(requestId);
    try {
      await rejectPairingRequest(requestId);
      setRequests((prev: any[]) => prev.filter((req) => req.id !== requestId));
      toast("Request declined.");
    } catch (error: any) {
      toast(error?.message || "Could not decline this request.");
    } finally {
      setProcessingId(null);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#7c9b83"]}
            tintColor="#7c9b83"
            progressBackgroundColor="#ffffff"
          />
        }
      >
        <View style={styles.header}>
          <ScreenBackButton label="Home" />
          <Text style={styles.headerTitle}>Pairing Requests</Text>
          <Text style={styles.headerSubtitle}>
            {requests.length ? `${requests.length} pending request${requests.length !== 1 ? "s" : ""}` : "A place for invitations to connect"}
          </Text>
        </View>

        {loadingRequests ? (
          <View style={styles.loadingState}><ActivityIndicator size="small" color="#a65f65" /><Text style={styles.loadingText}>Checking for invitationsâ€¦</Text></View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="mail-open-outline" size={29} color="#a65f65" /></View>
            <Text style={styles.emptyText}>Nothing waiting for you</Text>
            <Text style={styles.emptySubtext}>
              When your partner sends an invitation, it will show up here. You can also send them one first.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push("/(tabs)/sendReq")}>
              <Ionicons name="heart-circle-outline" size={19} color="#fffdfa" />
              <Text style={styles.emptyButtonText}>Invite your partner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContent}>
            {requests.map((item: any) => (
              <RequestCard
                key={item.id}
                request={item}
                processingId={processingId}
                onAccept={() => handleAccept(item.id)}
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
    backgroundColor: "#f7f2eb",
  },
  loadingState: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 9 },
  loadingText: { color: "#82766d", fontSize: 13 },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#3f3832",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#82766d",
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: { width: 66, height: 66, borderRadius: 23, backgroundColor: "#f0dfdc", alignItems: "center", justifyContent: "center" },
  emptyText: {
    fontSize: 18,
    color: "#4a413a",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    lineHeight: 20,
    color: "#82766d",
    marginTop: 8,
    textAlign: "center",
  },
  emptyButton: { minHeight: 47, backgroundColor: "#a65f65", borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, marginTop: 20 },
  emptyButtonText: { color: "#fffdfa", fontSize: 13, fontWeight: "700" },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fffdfa",
    borderWidth: 1,
    borderColor: "#e9dfd3",
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8eee7",
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3f3832",
  },
  requestText: {
    fontSize: 14,
    color: "#82766d",
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
    backgroundColor: "#6d8777",
  },
  rejectButton: {
    backgroundColor: "#b85d55",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    marginLeft: 8,
  },
});
