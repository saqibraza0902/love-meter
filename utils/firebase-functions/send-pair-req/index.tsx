import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";

export const sendPairingRequest = async (toUserEmail: string) => {
  const fromUserId = auth.currentUser?.uid;
  if (!fromUserId) throw new Error("User not authenticated");

  // 1. Check if target user exists
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", toUserEmail));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error("No user found with this email.");
  }

  // 2. Create a pairing request
  const requestsRef = collection(db, "requests");

  const reqQuery = query(
    requestsRef,
    where("fromUserId", "==", fromUserId),
    where("toUserEmail", "==", toUserEmail)
  );
  const reqSnapshot = await getDocs(reqQuery);
  if (!reqSnapshot.empty) {
    throw new Error("Request already sent to this user.");
  }
  await addDoc(requestsRef, {
    fromUserId,
    fromUserEmail: auth.currentUser?.email,
    toUserEmail,
    status: "pending",
    timestamp: new Date(),
  });

  return "Request sent successfully!";
};
