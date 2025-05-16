// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDAwg1ETSSLNkj_gb5vdm2bNsZwCrWHz9E",
  authDomain: "love-meter-91.firebaseapp.com",
  projectId: "love-meter-91",
  storageBucket: "love-meter-91.firebasestorage.app",
  messagingSenderId: "997136462983",
  appId: "1:997136462983:web:d0383d3e1ac6dbe9373422",
  measurementId: "G-7QBR0TRZ3L",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);
