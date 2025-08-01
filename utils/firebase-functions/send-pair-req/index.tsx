import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

export const sendPairingRequest = async (toUserEmail: string) => {
  const fromUserId = auth.currentUser?.uid;
  const fromUserEmail = auth.currentUser?.email;
  if (!fromUserId || !fromUserEmail) throw new Error("User not authenticated");

  // 1. Check if target user exists
  const usersRef = collection(db, "users");
  const userQuery = query(usersRef, where("email", "==", toUserEmail));
  const userSnapshot = await getDocs(userQuery);

  if (userSnapshot.empty) {
    throw new Error("No user found with this email.");
  }

  const toUserDoc = userSnapshot.docs[0];
  const toUserId = toUserDoc.id;

  // 2. Check if already paired (both directions)
  // console.log(toUserId);
  const docRef = await doc(db, "users", toUserId);
  const docSnap = await getDoc(docRef);
  const data = docSnap.data();
  // console.log(data);
  if (data?.partnerId) {
    throw new Error("This user is already paired");
  }

  // 3. Check if pairing request already exists
  const requestsRef = collection(db, "requests");
  const existingReqQuery = query(
    requestsRef,
    where("fromUserId", "==", fromUserId),
    where("toUserEmail", "==", toUserEmail)
  );
  const existingReqSnapshot = await getDocs(existingReqQuery);
  if (!existingReqSnapshot.empty) {
    throw new Error("Request already sent to this user.");
  }

  // 4. Send new request
  await addDoc(requestsRef, {
    fromUserId,
    fromUserEmail,
    toUserEmail,
    status: "pending",
    timestamp: new Date(),
  });

  return "Request sent successfully!";
};
