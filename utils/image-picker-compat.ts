import { launchImageLibrary } from "react-native-image-picker";

export const MediaTypeOptions = { Images: "photo" };

export async function requestMediaLibraryPermissionsAsync() {
  // The system picker grants access only to the photo the user selects.
  return { status: "granted" as const, granted: true };
}

export async function launchImageLibraryAsync(options: { quality?: number; mediaTypes?: unknown; base64?: boolean; allowsEditing?: boolean; aspect?: number[] } = {}) {
  const result = await launchImageLibrary({ mediaType: "photo", quality: options.quality as 0.3 | 0.7 | undefined });
  return { canceled: Boolean(result.didCancel), assets: result.assets || [] };
}
