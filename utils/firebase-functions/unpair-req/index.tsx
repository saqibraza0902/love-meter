import { doc, runTransaction } from "firebase/firestore";
import { auth, db } from "../../firebase";

export const unPairUsers = async () => {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) {
    throw new Error("User not authenticated");
  }

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Get current user data
      const currentUserRef = doc(db, "users", currentUserId);
      const currentUserDoc = await transaction.get(currentUserRef);

      if (!currentUserDoc.exists()) {
        throw new Error("User document not found");
      }

      const currentUserData = currentUserDoc.data();

      // 2. Verify the user is actually paired
      if (!currentUserData.isPaired || !currentUserData.partnerId) {
        throw new Error("User is not currently paired");
      }

      const partnerId = currentUserData.partnerId;

      // 3. Get partner data
      const partnerRef = doc(db, "users", partnerId);
      const partnerDoc = await transaction.get(partnerRef);

      if (!partnerDoc.exists()) {
        throw new Error("Partner document not found");
      }

      // 4. Update both users' status
      transaction.update(currentUserRef, {
        isPaired: false,
        partnerId: "",
        // Add any other fields to reset (e.g., shared data pointers)
      });

      transaction.update(partnerRef, {
        isPaired: false,
        partnerId: "",
      });

      // 5. (Optional) Delete any shared data/collections
      // Example: transaction.delete(doc(db, 'coupleData', `${currentUserId}_${partnerId}`));
    });

    console.log("Successfully unpaired users");
    return true;
  } catch (error) {
    console.error("Unpairing failed:", error);
    throw error; // Re-throw for UI error handling
  }
};
