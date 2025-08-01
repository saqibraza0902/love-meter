import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";

export const rejectPairingRequest = async (requestId: string) => {
  await deleteDoc(doc(db, "requests", requestId));
};
