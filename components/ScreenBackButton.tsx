import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "@/navigation/router-compat";
import React from "react";
import { Text, TouchableOpacity } from "react-native";

export default function ScreenBackButton({ label = "Back", light = false }: { label?: string; light?: boolean }) {
  const router = useRouter();
  const color = light ? "#fffdfa" : "#6d8777";
  return (
    <TouchableOpacity
      onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/Home")}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: 40, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, paddingHorizontal: 3 }}
    >
      <Ionicons name="chevron-back" size={21} color={color} />
      <Text style={{ color, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );
}

