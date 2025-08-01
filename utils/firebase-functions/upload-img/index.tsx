import { storage } from "@/utils/firebase"; // Make sure this is correct
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export async function uploadImageAsync(
  uri: string,
  onProgress: (percent: number) => void
): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `memories/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);

    return await new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(Math.round(progress));
        },
        (error) => {
          console.error("Upload failed:", error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  } catch (err) {
    console.error("Error in uploadImageAsync:", err);
    throw err;
  }
}
