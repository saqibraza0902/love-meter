import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

export const checkPairingStatus = async () => {
  const userId = auth.currentUser?.uid;
  if (!userId) return { isPaired: false, partnerData: null };

  try {
    // 1. Fetch user document
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error("User document not found");
    }

    const userData = userDoc.data();

    // 2. If paired, fetch partner's data
    if (userData?.isPaired && userData.partnerId) {
      const partnerDocRef = doc(db, "users", userData.partnerId);
      const partnerDoc = await getDoc(partnerDocRef);
      return { isPaired: true, partnerData: partnerDoc.data() };
    }

    return { isPaired: false, partnerData: null };
  } catch (error) {
    console.error("Error checking pairing status:", error);
    return { isPaired: false, partnerData: null };
  }
};
