import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { Spinner, useToast } from "native-base";
import { handleApiError } from "@/utils/handle-api-errors";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const toast = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const router = useRouter();

  const handleLogin = async () => {
    Keyboard.dismiss();
    setIsLoading(true);
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid email", "Please re-enter email");
      return;
    }
    try {
      const user = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", user.user.uid), {
        name: name,
        email: user.user.email,
        verified: user.user.emailVerified,
        profile: "",
      });

      toast.show({ description: "Sign up successfully" });
    } catch (error) {
      const err = handleApiError(error);
      toast.show({ description: err });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>Sign Up</Text>
      </View>
      <View>
        <Text style={styles.titleLogin}>Please signup to continue.</Text>
      </View>
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <FontAwesome
            name="user"
            size={20}
            color="#9d9d9d"
            style={styles.icon}
          />

          <TextInput
            placeholder="Name"
            value={name}
            onChangeText={setName}
            style={styles.textInput}
          />
        </View>
        <View style={styles.inputWrapper}>
          <MaterialIcons
            name="mail"
            size={20}
            color="#9d9d9d"
            style={styles.icon}
          />
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.textInput}
          />
        </View>
        <View style={styles.inputWrapper}>
          <MaterialIcons
            name="lock"
            size={20}
            color="#9d9d9d"
            style={styles.icon}
          />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            secureTextEntry={!isPasswordVisible} // Bổ sung thuộc tính secureTextEntry để ẩn mật khẩu
            style={styles.textInput}
          />
          <TouchableOpacity onPress={togglePasswordVisibility}>
            <MaterialIcons
              name={isPasswordVisible ? "visibility" : "visibility-off"}
              size={20}
              color="#9d9d9d"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.registerContainer}>
          <TouchableOpacity>
            <Text style={styles.registerText}>
              Already have an account?{" "}
              <Text
                onPress={() => router.replace("/login")}
                style={styles.registerLink}
              >
                Login
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity disabled={isLoading} onPress={handleLogin}>
          <View style={styles.loginButton}>
            <Text style={styles.loginButtonText}>
              {isLoading ? <Spinner color="#fff" /> : "Sign Up"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.errorMessageContainer}>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </View>
      </View>
    </View>
  );
};

export default SignUp;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#5F5F5F",
    fontSize: 25,
    fontWeight: "600",
  },
  titleLogin: {
    color: "#5F5F5F",
    fontSize: 15,
    marginTop: 10,
  },
  inputContainer: {
    width: "80%",
    marginTop: 20,
    gap: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    borderWidth: 0.2,
    borderRadius: 5,
  },
  textInput: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 10,
  },
  registerContainer: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  registerText: {
    color: "#5F5F5F",
  },
  registerLink: {
    color: "#456FE8",
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#456FE8",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 15,
  },
  errorMessageContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorMessage: {
    color: "red",
  },
});
//  <View style={{ height: "100%" }}>
//                 {receivedQuotes?.data.map((item, i) => (
//                   <View key={i} style={styles.quoteBox}>
//                     <Text style={styles.quoteText}>
//                       {formatCustomDate(item.date)}
//                     </Text>
//                     {item?.quotes?.map((quote, index) => (
//                       <View style={styles.quoteItem} key={index}>
//                         <Text style={styles.quoteText}>{quote.text}</Text>

//                         <Text style={styles.quoteMeta}>
//                           From: {quote.senderName} •{" "}
//                           {formatCustomDate(
//                             quote?.timestamp?.seconds.toString()
//                           )}
//                         </Text>
//                       </View>
//                     ))}
//                   </View>
//                 ))}
//               </View>
