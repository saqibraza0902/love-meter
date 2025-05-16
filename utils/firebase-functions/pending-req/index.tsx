import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";

export const fetchPendingRequests = async () => {
  const currentUserEmail = auth.currentUser?.email;
  if (!currentUserEmail) return [];

  try {
    const q = query(
      collection(db, "requests"),
      where("toUserEmail", "==", currentUserEmail),
      where("status", "==", "pending")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching requests:", error);
    return [];
  }
};
