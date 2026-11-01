import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { PermissionsAndroid, Platform } from "react-native";

export const MediaTypeOptions = { Images: "photo" };

export async function requestMediaLibraryPermissionsAsync() {
  // The system picker grants access only to the photo the user selects.
  return { status: "granted" as const, granted: true };
}

export async function launchImageLibraryAsync(options: { quality?: number; mediaTypes?: unknown; base64?: boolean; allowsEditing?: boolean; aspect?: number[] } = {}) {
  const result = await launchImageLibrary({ mediaType: "photo", quality: options.quality as 0.3 | 0.7 | undefined });
  return { canceled: Boolean(result.didCancel), assets: result.assets || [] };
}

export async function launchCameraAsync(options: { quality?: number } = {}) {
  if (Platform.OS === "android") {
    const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Allow camera access to take a memory photo.");
  }
  const result = await launchCamera({ mediaType: "photo", quality: options.quality as 0.3 | 0.7 | undefined, saveToPhotos: false });
  if (result.errorCode) throw new Error(result.errorMessage || "Couldn't open the camera.");
  return { canceled: Boolean(result.didCancel), assets: result.assets || [] };
}
