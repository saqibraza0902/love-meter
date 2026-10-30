// toast-context.tsx
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet, Text } from "react-native";

const ToastContext = createContext<{
  toast: (message: string, duration?: number) => void;
} | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [message, setMessage] = useState("");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;

  const toast = useCallback((msg: string, duration = 2000) => {
    setMessage(msg);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 50,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, duration);
    });
  }, [opacity, translateY]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toastContainer,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "#333",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    maxWidth: Dimensions.get("window").width * 0.8,
    zIndex: 999,
  },
  toastText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
  },
});
