import { runTransaction, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

export const acceptPairingRequest = async (
  requestId: string,
  fromUserId: string,
  toUserId: string
) => {
  try {
    await runTransaction(db, async (transaction) => {
      // Update both users
      const fromUserRef = doc(db, "users", fromUserId);
      const toUserRef = doc(db, "users", toUserId);

      transaction.update(fromUserRef, {
        isPaired: true,
        partnerId: toUserId,
        score: 0,
      });
      transaction.update(toUserRef, {
        isPaired: true,
        partnerId: fromUserId,
        score: 0,
      });

      // Delete the request
      const requestRef = doc(db, "requests", requestId);
      transaction.delete(requestRef);
    });
  } catch (error) {
    console.error("Transaction failed:", error);
  }
};
