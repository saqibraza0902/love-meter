import { useAppDispatch, useAppSelector } from "@/hooks/use-redux";
import { setPartner, setUser } from "@/redux/slices/user-slice";
import { auth, db } from "@/utils/firebase";
import { checkPairingStatus } from "@/utils/firebase-functions/check-pair-status";
import { fetchPendingRequests } from "@/utils/firebase-functions/pending-req";
import { IUser } from "@/utils/types";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useState } from "react";
export default function TabLayout() {
  const { user } = useAppSelector((s) => s.user);
  const [data, setData] = useState({
    requests: [],
    isPaired: false,
    partnerData: {},
  });
  const dispatch = useAppDispatch();
  useEffect(() => {
    const loadRequests = async () => {
      const pendingRequests = await fetchPendingRequests();
      const { isPaired, partnerData } = await checkPairingStatus();
      setData({
        // @ts-ignore
        requests: pendingRequests,
        isPaired: isPaired,
        partnerData: partnerData || {},
      });
    };
    loadRequests();
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const unsubscribeUser = onSnapshot(
      doc(db, "users", userId),
      (userDoc) => {
        if (!userDoc.exists()) return;

        try {
          const userData = {
            id: userDoc.id,
            ...userDoc.data(),
          } as IUser;
          dispatch(setUser(userData));

          // Listen to partner if exists
          if (userData.partnerId) {
            const unsubscribePartner = onSnapshot(
              doc(db, "users", userData.partnerId),
              (partnerDoc) => {
                if (partnerDoc.exists()) {
                  const partnerData = {
                    id: partnerDoc.id,
                    ...partnerDoc.data(),
                  } as IUser;
                  dispatch(setPartner(partnerData));
                }
              },
              (error) => console.error("Partner listener error:", error)
            );
            return unsubscribePartner;
          }
        } catch (error) {
          console.error("Error processing user data:", error);
        }
      },
      (error) => console.error("User listener error:", error)
    );

    return () => unsubscribeUser();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ffffff", // white for active tab (high contrast)
        tabBarInactiveTintColor: "#fbcfe8", // soft pink for inactive (low contrast)
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ec4899", // pink-500
          borderTopColor: "#334155", // slate-700
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          marginBottom: 4,
        },
      }}
      initialRouteName="Home"
    >
      {/* Tab screens remain the same but with updated icon colors */}
      <Tabs.Screen
        name="Home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={24} name="home" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="viewReq"
        options={{
          href: !user?.partnerId ? "/(tabs)/viewReq" : null,
          title: "Requests",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={24} name="exchange" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sendReq"
        options={{
          href: !user?.partnerId ? "/(tabs)/sendReq" : null,
          title: "Pair",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={24} name="user-plus" color={color} />
          ),
        }}
      />

      {/* <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 size={24} name="calendar-days" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quizes"
        options={{
          title: "Quizes",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 size={24} name="calendar-days" color={color} />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="Settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={24} name="sliders" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
