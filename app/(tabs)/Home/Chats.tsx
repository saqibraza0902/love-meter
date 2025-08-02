import { useAppDispatch, useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { setTimer } from "@/redux/slices/user-slice";
import { auth, db } from "@/utils/firebase";
import { formatCustomDate } from "@/utils/format-date";
import { handleApiError } from "@/utils/handle-api-errors";
import { IQuotes } from "@/utils/types";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
const ChatScreen: React.FC = () => {
  const { partner, user, timer, lastSent } = useAppSelector((s) => s.user);
  const scrollViewRef = useRef<ScrollView>(null);

  const [message, setMessage] = useState("");
  const [spinner, setSpinner] = useState(false);
  const [quotes, setQuote] = useState<IQuotes | null>(null);
  const [score, setScore] = useState<number>(0);

  const dispatch = useAppDispatch();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { toast } = useToast();
  const getUserScores = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !user?.partnerId) return;
    const quotesDoc = doc(db, "users", userId);
    const unsubscribeUserScores = onSnapshot(
      quotesDoc,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();

          setScore(data.score || 0);
        }
      },
      (error) => {
        return toast(handleApiError(error));
      }
    );
    return unsubscribeUserScores;
  };
  // const getQuotes = async () => {
  //   const userId = auth.currentUser?.uid;
  //   if (!userId) return;
  //   if (!partner?.id) return;
  //   const quotesSnap = doc(db, "quotes", partner.id);
  //   const unsubscribeQuotes = onSnapshot(
  //     quotesSnap,
  //     (doc) => {
  //       if (doc.exists()) {
  //         const data = doc.data();

  //         const myQuotes: IQuotes = {
  //           id: doc.id,
  //           data: JSON.parse(JSON.stringify(data.data || [])), // deep clone
  //           senderId: data.senderId || "", // Provide a default value if senderId is missing
  //           score: data.score || 0, // Provide a default value if score is missing
  //         };
  //         setQuote(myQuotes);
  //       }
  //     },
  //     (error) => {
  //       return toast.show({ description: handleApiError(error) });
  //     }
  //   );
  //   console.log(serverTimestamp());
  //   setLoading(false);

  //   return unsubscribeQuotes;
  // };
  // Calculates and sets the remaining cooldown time

  const calculateRemainingTime = (lastSent: number) => {
    if (!lastSent) return;

    const now = Date.now();
    const timeDiff = Math.floor((now - lastSent) / 60000); // minutes passed
    const remaining = Math.max(0, 120 - timeDiff); // 2-hour cooldown
    dispatch(setTimer(remaining));
  };

  // Inside ChatScreen

  const getQuotes = async () => {
    if (!user || !partner) return;

    const usersss = [user?.id, partner?.id];
    const abc = query(
      collection(db, "chats"),
      where("users", "array-contains-any", usersss)
    );

    const unsubscribe = onSnapshot(abc, async (querySnapshot) => {
      const docSnap = querySnapshot.docs[0];
      if (!docSnap) return;

      const quotesData = { id: docSnap.id, ...docSnap.data() } as IQuotes;
      setQuote(quotesData);

      // Mark unseen quotes as seen if user is the partner
    });

    return unsubscribe;
  };

  const getChatId = (userId1: string, userId2: string): string => {
    return [userId1, userId2].sort().join("_");
  };

  const updateSeenQuotes = async () => {
    if (!user?.id || !partner?.id) return;
    console.log(getChatId(user.id, partner.id));

    const docRef = doc(db, "chats", getChatId(user.id, partner.id));

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return console.log("It is not ");
    console.log(docSnap.id);
    const quoteData = docSnap.data() as IQuotes;

    const updatedData = quoteData.data.map((entry) => {
      const updatedQuotes = entry.quotes.map((quote) => {
        // Mark as seen ONLY if it's not already seen AND it’s from the other user
        if (!quote.seen && quote.name !== user.name) {
          return { ...quote, seen: true };
        }
        return quote;
      });

      return { ...entry, quotes: updatedQuotes };
    });

    await updateDoc(docRef, { data: updatedData });
  };

  // Starts the countdown timer if applicable
  const startCountdown = (timer: number, dispatch: any) => {
    if (timer <= 0) return;

    const interval = setInterval(() => {
      dispatch(setTimer(Math.max(0, timer - 1)));
    }, 60000);

    return interval; // so we can clear it later
  };
  useEffect(() => {
    const setup = async () => {
      if (user?.id && partner?.id) {
        const unsub = await getQuotes();
        getUserScores();
        await updateSeenQuotes(); // Only mark as seen when chat is opened
        return unsub;
      }
    };

    let unsubscribe: (() => void) | undefined;
    setup().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, partner]);

  // Check quote cooldown and load received quotes

  useEffect(() => {
    calculateRemainingTime(lastSent || 0);
  }, [lastSent]);

  useEffect(() => {
    const interval = startCountdown(timer, dispatch);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  // const sendQuote = async () => {
  //   if (!user || !partner) {
  //     Alert.alert("Cooldown", "You can only send a quote every 2 hours");
  //     return;
  //   }

  //   if (message.trim().length === 0) {
  //     Alert.alert("Error", "Please enter a quote");
  //     return;
  //   }

  //   try {
  //     setSpinner(true);
  //     const now = Date();
  //     const formattedDate = formatCustomDate(now);
  //     // console.log(formattedDate);
  //     const senderQuotesRef = doc(db, "quotes", user.id);
  //     const docSnap = await getDoc(senderQuotesRef);

  //     // Calculate score: word count of the message
  //     const wordCount = message.trim().split(/\s+/).length;

  //     const newQuote = {
  //       text: message,
  //       senderName: user.name || user.email,
  //     };

  //     if (docSnap.exists()) {
  //       const data = docSnap.data();
  //       const quotesByDate = data.data || [];
  //       const existingScore = data.score || 0;

  //       const existingDateIndex = quotesByDate.findIndex(
  //         (entry: any) => entry.date === formattedDate
  //       );
  //       console.log("existing ", existingDateIndex);
  //       if (existingDateIndex !== -1) {
  //         quotesByDate[existingDateIndex].quotes.push(newQuote);
  //       } else {
  //         quotesByDate.push({
  //           date: formattedDate,
  //           quotes: [newQuote],
  //         });
  //       }

  //       await updateDoc(senderQuotesRef, {
  //         data: quotesByDate,
  //         score: existingScore + wordCount,
  //       });
  //     } else {
  //       await setDoc(senderQuotesRef, {
  //         data: [
  //           {
  //             date: formattedDate,
  //             quotes: [newQuote],
  //           },
  //         ],
  //         score: wordCount,
  //         senderId: user.id,
  //       });
  //     }

  //     setMessage("");
  //     // const noww = Date.now(); // current timestamp in ms
  //     // dispatch(setLastSent(noww));
  //     // dispatch(setTimer(120)); // 2 hours cooldown in minutes
  //     toast.show({
  //       description: "Your quote has been sent!",
  //     });
  //   } catch (error) {
  //     const err = handleApiError(error);
  //     toast.show({ description: err });
  //   } finally {
  //     setSpinner(false);
  //   }
  // };

  const sendQuote = async () => {
    Keyboard.dismiss();
    if (!user || !partner) {
      return toast("Cooldown, You can only send a quote every 2 hours");
    }

    if (message.trim().length === 0) {
      return toast("Error, Please enter a quote");
    }

    try {
      setSpinner(true);
      const now = Date();
      const formattedDate = formatCustomDate(now);
      const wordCount = message.trim().split(/\s+/).length;
      const chatId = getChatId(user.id, partner.id);

      const newQuote = {
        id: user.id,
        name: user.name || user.email,
        text: message,
        seen: false,
        time: format(now, "hh:mm a"),
      };

      const chatRef = doc(db, "chats", chatId);
      const userRef = doc(db, "users", user.id);
      const chatSnap = await getDoc(chatRef);

      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const quotesByDate = data.data || [];

        const existingDateIndex = quotesByDate.findIndex(
          (entry: any) => entry.date === formattedDate
        );

        if (existingDateIndex !== -1) {
          quotesByDate[existingDateIndex].quotes.push(newQuote);
        } else {
          quotesByDate.push({
            date: formattedDate,
            quotes: [newQuote],
          });
        }

        await updateDoc(chatRef, {
          data: quotesByDate,
        });
      } else {
        await setDoc(chatRef, {
          data: [
            {
              date: formattedDate,
              quotes: [newQuote],
            },
          ],
          users: [user.id, partner.id],
        });
      }

      await updateDoc(userRef, {
        score: score + wordCount,
      });

      setMessage("");
      // Dispatch cooldown if needed
    } catch (error) {
      console.log(error);
      const err = handleApiError(error);
      toast(err);
    } finally {
      setSpinner(false);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [quotes?.data.length]);
  // const onRefresh = () => {
  //   setLoading(true);
  //   getQuotes();
  //   getUserScores();
  //   calculateRemainingTime(lastSent || 0);
  //   // Optionally restart countdown
  //   const interval = startCountdown(timer, dispatch);
  //   if (interval) clearInterval(interval);
  // };
  // console.log(JSON.stringify(quotes?.data));
  return (
    <SafeAreaView style={styles.container}>
      {partner?.partnerId ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={onRefresh}
                colors={["#ec4899"]}
                tintColor="#ec4899"
                progressBackgroundColor="#ffffff"
              />
            }
          > */}
          <View style={styles.streakContainer}>
            <Ionicons name="flame" size={28} color="#f59e0b" />
            <Text style={styles.streakText}>{score || 0} Love Points</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Send a Love Quote</Text>
            <TextInput
              style={styles.input}
              placeholder="Write something sweet..."
              placeholderTextColor="#9ca3af"
              multiline
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity
              style={[styles.button, timer > 0 && styles.disabledButton]}
              onPress={sendQuote}
              disabled={timer > 0 || spinner}
            >
              {!spinner && <Ionicons name="heart" size={20} color="#fff" />}
              <Text style={styles.buttonText}>
                {spinner ? <ActivityIndicator color="#fff" /> : "Send Quote"}
              </Text>
            </TouchableOpacity>
            {timer > 0 && (
              <Text style={styles.cooldownText}>
                {timer} minutes until you can send again
              </Text>
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Received Quotes</Text>
            {quotes === null ? (
              <Text style={styles.noQuotesText}>No quotes yet...</Text>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 300 }}
                onContentSizeChange={() =>
                  scrollViewRef.current?.scrollToEnd({ animated: true })
                }
              >
                {quotes?.data?.map((item, i) => {
                  return (
                    <View key={i}>
                      <Text style={styles.dateText}>{item.date}</Text>
                      <View style={styles.quoteContainer}>
                        {item?.quotes?.map((quote, index) => {
                          const isSent = quote.id === user?.id;
                          return (
                            <View
                              key={index}
                              style={
                                isSent
                                  ? styles.sentMessage
                                  : styles.receivedMessage
                              }
                            >
                              <Text style={styles.metaText}>{quote.name}</Text>
                              <Text style={styles.quoteText}>{quote.text}</Text>
                              <Text
                                style={[
                                  styles.metaText,
                                  { textAlign: "right" },
                                ]}
                              >
                                {quote.time}
                                {isSent && (
                                  <Text style={styles.metaText}>
                                    <Ionicons
                                      name={
                                        quote.seen && user.paid
                                          ? "checkmark-done"
                                          : "checkmark"
                                      }
                                      size={12}
                                    />
                                  </Text>
                                )}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
          {/* </ScrollView> */}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.noQuotesText}>
            No partner selected. Please find your match first! 💖
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  streakContainer: {
    marginHorizontal: 20,
    backgroundColor: "#fde2e4",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    gap: 5,
  },
  streakText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ec4899",
  },
  pushLink: {
    marginTop: 5,
    color: "#7c3aed",
    fontSize: 14,
  },
  sentMessage: {
    alignSelf: "flex-end",
    minWidth: "50%",
    marginVertical: 10,
    padding: 5,
    borderRadius: 10,
    backgroundColor: "#ec46994d",
  },
  receivedMessage: {
    alignSelf: "flex-start",
    minWidth: "50%",
    marginVertical: 10,
    padding: 5,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  card: {
    backgroundColor: "#f9fafb",
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 10,
  },
  input: {
    height: 100,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: "top",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#ec4899",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#f9a8d4",
  },
  cooldownText: {
    textAlign: "center",
    marginTop: 8,
    color: "#f87171",
    fontSize: 14,
  },
  noQuotesText: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 20,
  },
  quoteContainer: {
    marginTop: 10,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dateText: {
    fontSize: 12,
    textAlign: "center",
    color: "#9ca3af",
    marginBottom: 5,
  },
  singleQuote: {
    marginTop: 5,
  },
  quoteText: {
    fontSize: 16,
    color: "#475569",
    fontStyle: "italic",
  },
  metaText: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
});

export default ChatScreen;
