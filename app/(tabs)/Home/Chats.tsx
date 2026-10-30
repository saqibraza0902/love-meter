import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { formatCustomDate } from "@/utils/format-date";
import { deleteMessage, editMessage, listMessages, sendMessage, supabase } from "@/utils/supabase";
import Ionicons from "react-native-vector-icons/Ionicons";
import { format } from "date-fns";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "@/navigation/router-compat";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, KeyboardAvoidingView, PanResponder, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MessageRow = { id: string; sender_id: string; body: string; created_at: string; read_at: string | null; edited_at?: string | null; deleted_at?: string | null; reply_to_id?: string | null };
type ChatMessage = MessageRow & { time: string };
type DayGroup = { date: string; messages: ChatMessage[] };
const PAGE_SIZE = 50;

const ChatScreen: React.FC = () => {
  const router = useRouter();
  const { partner, user } = useAppSelector((state) => state.user);
  const { toast } = useToast();
  const isFocused = useIsFocused();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageRow | null>(null);
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const scrollOffset = useRef(0);
  const contentHeight = useRef(0);
  const preserveScrollPosition = useRef(false);
  const didInitialScroll = useRef(false);
  const paginationLock = useRef(false);
  const scrollAfterMessageRef = useRef(false);
  const isNearLatestRef = useRef(true);
  const swipePositions = useRef(new Map<string, Animated.Value>());
  const selectedMessages = useMemo(() => rows.filter((row) => selectedIds.includes(row.id)), [rows, selectedIds]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!user?.coupleId) return;
    const incoming = await listMessages(user.coupleId, undefined, PAGE_SIZE) as MessageRow[];
    setRows((previous) => mergeRows(previous, incoming));
    setHasMore(incoming.length === PAGE_SIZE);
  }, [user?.coupleId]);

  const markUnreadRead = useCallback(async () => {
    if (!isFocusedRef.current || !user?.coupleId || !user.id || AppState.currentState !== "active") return;
    const { error } = await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("couple_id", user.coupleId).neq("sender_id", user.id).is("read_at", null);
    if (error) console.warn("Could not mark messages read", error);
  }, [user?.coupleId, user?.id]);

  const groups = useMemo(() => {
    const byDate = new Map<string, DayGroup>();
    for (const row of rows) {
      const created = new Date(row.created_at);
      const date = formatCustomDate(created.toISOString());
      const group = byDate.get(date) || { date, messages: [] };
      group.messages.push({ ...row, time: format(created, "hh:mm a") });
      byDate.set(date, group);
    }
    return [...byDate.values()];
  }, [rows]);

  const loadOlder = useCallback(async () => {
    if (!user?.coupleId || !rows.length || paginationLock.current || !hasMore) return;
    paginationLock.current = true;
    preserveScrollPosition.current = true;
    setLoadingOlder(true);
    try {
      const oldest = rows[0];
      const older = await listMessages(user.coupleId, { created_at: oldest.created_at, id: oldest.id }, PAGE_SIZE) as MessageRow[];
      setRows((previous) => mergeRows(previous, older));
      setHasMore(older.length === PAGE_SIZE);
    } catch (error: any) {
      preserveScrollPosition.current = false;
      toast(error.message || "Couldn't load older messages.");
    } finally {
      setLoadingOlder(false);
      paginationLock.current = false;
    }
  }, [hasMore, rows, toast, user?.coupleId]);

  useEffect(() => {
    if (!user?.coupleId || !user.id) {
      setRows([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    let mounted = true;
    didInitialScroll.current = false;
    setLoading(true);
    setHasMore(true);
    setRows([]);
    refreshMessages()
      .then(() => { if (mounted) void markUnreadRead(); })
      .catch((error) => toast(error.message || "Couldn't load messages."))
      .finally(() => { if (mounted) setLoading(false); });

    const channel = supabase.channel(`messages:${user.coupleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `couple_id=eq.${user.coupleId}` }, (payload) => {
        const row = (payload.new || payload.old) as MessageRow;
        if (payload.eventType === "DELETE") {
          setRows((previous) => previous.filter((item) => item.id !== row.id));
          return;
        }
        const followIncoming = payload.eventType === "INSERT" && row?.sender_id !== user.id && isNearLatestRef.current;
        if (followIncoming) scrollAfterMessageRef.current = true;
        if (row?.id) setRows((previous) => mergeRows(previous, [row]));
        if (payload.eventType === "INSERT" && row?.sender_id !== user.id) {
          void markUnreadRead();
          if (followIncoming) setTimeout(() => {
            scrollAfterMessageRef.current = false;
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 120);
        }
      })
      .subscribe();

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void markUnreadRead();
    });
    void markUnreadRead();
    return () => { mounted = false; appState.remove(); void supabase.removeChannel(channel); };
  }, [user?.coupleId, user?.id, refreshMessages, markUnreadRead, toast]);

  // Wait for the initial page and native layout before scrolling. A ScrollView may
  // not emit a size change when its content initially fits the available height.
  useEffect(() => {
    if (loading || !rows.length || !isFocused || didInitialScroll.current) return;
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
        didInitialScroll.current = true;
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [loading, rows.length, isFocused]);

  const send = async () => {
    const body = message.trim();
    if (!body) return;
    if (!user?.id || !user.coupleId) return toast("Pair with someone before sending a message.");
    try {
      setSending(true);
      const sent = await sendMessage(user.coupleId, user.id, body, replyTo?.id ?? null) as MessageRow;
      scrollAfterMessageRef.current = true;
      setRows((previous) => mergeRows(previous, [sent]));
      setMessage("");
      setReplyTo(null);
      // Fallback for content-size events that arrive before the keyboard/layout settles.
      setTimeout(() => {
        scrollAfterMessageRef.current = false;
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);
    } catch (error: any) {
      toast(error.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const openMessageActions = (item: ChatMessage, _mine: boolean) => {
    if (item.deleted_at) return;
    setActionMessage(item);
    setSelectedIds([item.id]);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMessage(deleteTarget.id);
      setRows((current) => current.map((row) => row.id === deleteTarget.id
        ? { ...row, body: "This message was deleted", deleted_at: new Date().toISOString() } : row));
      setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error: any) { toast(error.message || "Message could not be deleted."); }
  };

  const saveEdit = async () => {
    const body = editDraft.trim();
    if (!body || !editing) return;
    try {
      await editMessage(editing.id, body);
      setRows((previous) => previous.map((row) => row.id === editing.id ? { ...row, body, edited_at: new Date().toISOString() } : row));
      setEditing(null);
    } catch (error: any) { toast(error.message || "Message could not be edited."); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          {selectedIds.length > 0 && <>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedIds([])} accessibilityLabel="Clear message selection"><Ionicons name="close" size={25} color="#fff" /></TouchableOpacity>
            <Text style={styles.selectionCount}>{selectedIds.length}</Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity style={styles.headerAction} onPress={() => setShowMessageInfo(true)} accessibilityLabel="Message info"><Ionicons name="information-circle-outline" size={24} color="#fff" /></TouchableOpacity>
              <TouchableOpacity style={styles.headerAction} onPress={() => {
                if (selectedMessages.length !== 1) return toast("Select one message to reply, edit, or delete it.");
                const selected = selectedMessages[0];
                openMessageActions({ ...selected, time: format(new Date(selected.created_at), "hh:mm a") }, selected.sender_id === user?.id);
              }} accessibilityLabel="More message actions"><Ionicons name="ellipsis-vertical" size={22} color="#fff" /></TouchableOpacity>
            </View>
          </>}
          {selectedIds.length === 0 && <>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={25} color="#fff" /></TouchableOpacity>
          <View style={styles.avatar}><Text style={styles.avatarText}>{partner?.name?.charAt(0)?.toUpperCase() || "♥"}</Text></View>
          <View style={styles.headerCopy}><Text style={styles.partnerName}>{partner?.name || "Your partner"}</Text><Text style={styles.headerSubtitle}>{partner ? "Your conversation" : "Love Meter chat"}</Text></View>
          <Ionicons name="heart" size={23} color="#fff" style={styles.headerHeart} />
          </>}
        </View>

        {user?.coupleId ? <>
          <ScrollView ref={scrollViewRef} style={styles.messages} contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="none"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              scrollOffset.current = contentOffset.y;
              isNearLatestRef.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 140;
              if (event.nativeEvent.contentOffset.y < 90) void loadOlder();
            }} scrollEventThrottle={16}
            onContentSizeChange={(_, height) => {
              if (preserveScrollPosition.current) {
                scrollViewRef.current?.scrollTo({ y: scrollOffset.current + height - contentHeight.current, animated: false });
                preserveScrollPosition.current = false;
              }
              contentHeight.current = height;
              if (scrollAfterMessageRef.current) {
                scrollAfterMessageRef.current = false;
                requestAnimationFrame(() => requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true })));
              }
            }}>
            {loadingOlder && <ActivityIndicator color="#128c7e" style={styles.olderLoader} />}
            {loading && rows.length === 0 ? <ActivityIndicator color="#128c7e" style={styles.loader} /> : groups.length === 0 ?
              <View style={styles.welcomeNote}><Ionicons name="lock-closed" size={13} color="#607d8b" /><Text style={styles.welcomeText}>Your messages are just for the two of you. Say hello!</Text></View> : groups.map((group) => <View key={group.date}>
                <View style={styles.datePill}><Text style={styles.dateText}>{group.date.toUpperCase()}</Text></View>
                {group.messages.map((item) => {
                  const mine = item.sender_id === user.id;
                  const replied = item.reply_to_id ? rows.find((row) => row.id === item.reply_to_id) : null;
                  const selected = selectedIds.includes(item.id);
                  let swipePosition = swipePositions.current.get(item.id);
                  if (!swipePosition) { swipePosition = new Animated.Value(0); swipePositions.current.set(item.id, swipePosition); }
                  const position = swipePosition;
                  const panResponder = PanResponder.create({
                    onMoveShouldSetPanResponder: (_, gesture) => selectedIds.length === 0 && gesture.dx > 10 && Math.abs(gesture.dy) < 18,
                    onPanResponderMove: (_, gesture) => position.setValue(Math.max(0, Math.min(gesture.dx, 144))),
                    onPanResponderRelease: (_, gesture) => {
                      if (gesture.dx > 64) { setReplyTo(item); setSelectedIds([]); }
                      Animated.timing(position, { toValue: 0, duration: 110, useNativeDriver: true }).start();
                    },
                    onPanResponderTerminate: () => Animated.timing(position, { toValue: 0, duration: 100, useNativeDriver: true }).start(),
                  });
                  const hintOpacity = position.interpolate({ inputRange: [0, 10, 58], outputRange: [0, 0, 1], extrapolate: "clamp" });
                  const hintScale = position.interpolate({ inputRange: [0, 58], outputRange: [0.65, 1], extrapolate: "clamp" });
                  return <View key={item.id} style={styles.swipeRow}>
                    <Animated.View pointerEvents="none" style={[styles.swipeReplyHint, { opacity: hintOpacity, transform: [{ scale: hintScale }] }]}><Ionicons name="arrow-undo" size={19} color="#fff" /></Animated.View>
                    <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX: position }] }}>
                    <TouchableOpacity activeOpacity={0.92} onPress={() => selectedIds.length > 0 && toggleSelected(item.id)} onLongPress={() => toggleSelected(item.id)} delayLongPress={330}
                      style={[styles.messageBubble, mine ? styles.sentBubble : styles.receivedBubble, selected && styles.selectedBubble]}>
                      {replied && <View style={[styles.replyQuote, mine ? styles.sentQuote : styles.receivedQuote]}><Text style={styles.quoteName}>{replied.sender_id === user.id ? "You" : partner?.name || "Partner"}</Text><Text style={styles.quoteText} numberOfLines={2}>{replied.deleted_at ? "This message was deleted" : replied.body}</Text></View>}
                      <Text style={styles.messageText}>{item.deleted_at ? "This message was deleted" : item.body}</Text>
                      <View style={styles.messageMeta}>
                        {item.edited_at && !item.deleted_at && <Text style={styles.editedText}>edited</Text>}
                        <Text style={styles.timeText}>{item.time}</Text>
                        {mine && <Ionicons name={item.read_at ? "checkmark-done" : "checkmark"} size={15} color={item.read_at ? "#53bdeb" : "#8696a0"} />}
                      </View>
                    </TouchableOpacity>
                    </Animated.View>
                  </View>;
                })}
              </View>)}
          </ScrollView>

          <View style={styles.composerArea}>
            {replyTo && <View style={styles.replyBar}><View style={styles.replyBarAccent} /><View style={styles.replyBarCopy}><Text style={styles.replyBarTitle}>Replying to {replyTo.sender_id === user?.id ? "yourself" : partner?.name || "partner"}</Text><Text style={styles.replyBarBody} numberOfLines={1}>{replyTo.body}</Text></View><TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close-circle" size={22} color="#667781" /></TouchableOpacity></View>}
            <View style={styles.composerBar}>
              <View style={styles.inputShell}><TextInput style={styles.input} placeholder="Message" placeholderTextColor="#8696a0" multiline value={message} onChangeText={setMessage} maxLength={4000} /></View>
              <TouchableOpacity style={[styles.sendButton, sending && styles.sendButtonDisabled]} onPress={send} disabled={sending || !message.trim()} accessibilityLabel="Send message">
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={19} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </> : <View style={styles.emptyState}><Ionicons name="people-outline" size={42} color="#7b8b85" /><Text style={styles.emptyTitle}>No conversation yet</Text><Text style={styles.emptyCopy}>Pair your account to start sharing messages here.</Text></View>}
      </KeyboardAvoidingView>
      {editing && <View style={styles.modalBackdrop}><View style={styles.editCard}><Text style={styles.editTitle}>Edit message</Text><TextInput value={editDraft} onChangeText={setEditDraft} multiline autoFocus maxLength={4000} style={styles.editInput} /><View style={styles.editActions}><TouchableOpacity onPress={() => setEditing(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={saveEdit}><Text style={styles.saveText}>Save</Text></TouchableOpacity></View></View></View>}
      {actionMessage && <View style={styles.sheetBackdrop}>
        <TouchableOpacity activeOpacity={1} style={styles.sheetScrim} onPress={() => setActionMessage(null)} />
        <View style={styles.actionSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Message actions</Text>
          <Text style={styles.sheetPreview} numberOfLines={2}>{actionMessage.body}</Text>
          <TouchableOpacity style={styles.actionRow} onPress={() => { setReplyTo(actionMessage); setSelectedIds([]); setActionMessage(null); }}><View style={styles.actionIcon}><Ionicons name="arrow-undo-outline" size={19} color="#087f70" /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Reply</Text><Text style={styles.actionHint}>Quote this message in your reply</Text></View><Ionicons name="chevron-forward" size={18} color="#9aa6a2" /></TouchableOpacity>
          {actionMessage.sender_id === user?.id && <>
            <TouchableOpacity style={styles.actionRow} onPress={() => { setEditing(actionMessage); setEditDraft(actionMessage.body); setSelectedIds([]); setActionMessage(null); }}><View style={styles.actionIcon}><Ionicons name="create-outline" size={19} color="#087f70" /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>Edit message</Text><Text style={styles.actionHint}>Update the text for both of you</Text></View><Ionicons name="chevron-forward" size={18} color="#9aa6a2" /></TouchableOpacity>
            <TouchableOpacity style={styles.actionRow} onPress={() => { setDeleteTarget(actionMessage); setActionMessage(null); }}><View style={[styles.actionIcon, styles.deleteActionIcon]}><Ionicons name="trash-outline" size={19} color="#c24646" /></View><View style={styles.actionCopy}><Text style={styles.deleteActionTitle}>Delete message</Text><Text style={styles.actionHint}>Remove the text for both of you</Text></View><Ionicons name="chevron-forward" size={18} color="#9aa6a2" /></TouchableOpacity>
          </>}
          <TouchableOpacity style={styles.sheetCancelButton} onPress={() => setActionMessage(null)}><Text style={styles.sheetCancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </View>}
      {deleteTarget && <View style={styles.modalBackdrop}><View style={styles.confirmCard}>
        <View style={styles.confirmIcon}><Ionicons name="trash-outline" size={24} color="#bf4a4a" /></View>
        <Text style={styles.confirmTitle}>Delete this message?</Text><Text style={styles.confirmCopy}>The message text will be removed from both sides of this conversation.</Text>
        <View style={styles.confirmActions}><TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteTarget(null)}><Text style={styles.confirmCancelText}>Keep message</Text></TouchableOpacity><TouchableOpacity style={styles.confirmDelete} onPress={confirmDelete}><Text style={styles.confirmDeleteText}>Delete</Text></TouchableOpacity></View>
      </View></View>}
      {showMessageInfo && <View style={styles.modalBackdrop}><View style={styles.infoCard}>
        <View style={styles.infoHeader}><View><Text style={styles.infoTitle}>Message info</Text><Text style={styles.infoSubtitle}>{selectedMessages.length === 1 ? "Details for this message" : `${selectedMessages.length} selected messages`}</Text></View><TouchableOpacity onPress={() => setShowMessageInfo(false)} accessibilityLabel="Close message info"><Ionicons name="close" size={24} color="#667781" /></TouchableOpacity></View>
        <ScrollView style={styles.infoList} showsVerticalScrollIndicator={false}>
          {selectedMessages.map((item) => <View key={item.id} style={styles.infoMessage}>
            <Text style={styles.infoMessageBody} numberOfLines={3}>{item.deleted_at ? "This message was deleted" : item.body}</Text>
            <View style={styles.infoTimeRow}><Ionicons name="checkmark" size={16} color="#8696a0" /><Text style={styles.infoTimeLabel}>Sent</Text><Text style={styles.infoTimeValue}>{format(new Date(item.created_at), "dd MMM yyyy, hh:mm a")}</Text></View>
            <View style={styles.infoTimeRow}><Ionicons name="checkmark-done" size={16} color={item.read_at ? "#128c7e" : "#a5b0b5"} /><Text style={styles.infoTimeLabel}>{item.sender_id === user?.id ? `Seen by ${partner?.name || "partner"}` : "Seen by you"}</Text><Text style={[styles.infoTimeValue, !item.read_at && styles.infoPending]}>{item.read_at ? format(new Date(item.read_at), "dd MMM yyyy, hh:mm a") : "Not seen yet"}</Text></View>
          </View>)}
        </ScrollView>
        <TouchableOpacity style={styles.infoDoneButton} onPress={() => setShowMessageInfo(false)}><Text style={styles.infoDoneText}>Done</Text></TouchableOpacity>
      </View></View>}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#efe7dd" }, keyboardView: { flex: 1 },
  header: { minHeight: 64, backgroundColor: "#075e54", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  selectionCount: { color: "#fff", fontSize: 18, fontWeight: "600", marginLeft: 8 }, selectionActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 18 }, headerAction: { padding: 6 },
  backButton: { padding: 5, marginRight: 5 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#d8eee8", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { color: "#075e54", fontWeight: "700", fontSize: 19 }, headerCopy: { flex: 1 }, partnerName: { color: "#fff", fontSize: 17, fontWeight: "600" },
  headerSubtitle: { color: "#d0e7e3", fontSize: 12, marginTop: 2 }, headerHeart: { paddingHorizontal: 8 }, messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16, flexGrow: 1, justifyContent: "flex-end" },
  datePill: { alignSelf: "center", backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 10, elevation: 1 },
  dateText: { color: "#667781", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 }, olderLoader: { marginVertical: 8 }, loader: { marginTop: 28 },
  messageBubble: { maxWidth: "84%", minWidth: 90, paddingHorizontal: 10, paddingTop: 7, paddingBottom: 5, marginVertical: 3, borderRadius: 9, elevation: 1 },
  swipeRow: { position: "relative", justifyContent: "center" }, swipeReplyHint: { position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center", alignItems: "center", width: 38, height: 38, borderRadius: 19, backgroundColor: "#128c7e", alignSelf: "center" },
  selectedBubble: { borderWidth: 2, borderColor: "#128c7e", opacity: 0.88 },
  sentBubble: { alignSelf: "flex-end", backgroundColor: "#d9fdd3", borderTopRightRadius: 2 }, receivedBubble: { alignSelf: "flex-start", backgroundColor: "#fff", borderTopLeftRadius: 2 },
  messageText: { color: "#111b21", fontSize: 15, lineHeight: 21 }, messageMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 2 },
  timeText: { color: "#667781", fontSize: 10 }, editedText: { color: "#667781", fontSize: 9, marginRight: 3 },
  replyQuote: { borderLeftWidth: 3, paddingLeft: 7, marginBottom: 5, paddingVertical: 2 }, sentQuote: { borderLeftColor: "#128c7e" }, receivedQuote: { borderLeftColor: "#7c5db0" },
  quoteName: { color: "#128c7e", fontSize: 11, fontWeight: "700" }, quoteText: { color: "#54656f", fontSize: 12 },
  welcomeNote: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff8c6", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 20, maxWidth: "90%" },
  welcomeText: { color: "#54656f", fontSize: 12, textAlign: "center" }, composerArea: { backgroundColor: "#f0f2f5" },
  composerBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, paddingTop: 7, paddingBottom: 7, gap: 8 },
  inputShell: { flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: "#fff", borderRadius: 22, justifyContent: "center", paddingHorizontal: 15 },
  input: { color: "#111b21", fontSize: 16, paddingTop: 9, paddingBottom: 9, maxHeight: 104, textAlignVertical: "center" }, sendButton: { width: 43, height: 43, borderRadius: 22, backgroundColor: "#128c7e", alignItems: "center", justifyContent: "center", marginBottom: 1 },
  sendButtonDisabled: { backgroundColor: "#8eaaa5" }, replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, gap: 9 }, replyBarAccent: { width: 3, height: 34, borderRadius: 2, backgroundColor: "#128c7e" },
  replyBarCopy: { flex: 1 }, replyBarTitle: { color: "#128c7e", fontSize: 12, fontWeight: "700" }, replyBarBody: { color: "#54656f", fontSize: 12, marginTop: 2 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 10 }, emptyTitle: { color: "#25332f", fontSize: 18, fontWeight: "700" }, emptyCopy: { color: "#667781", fontSize: 14, textAlign: "center", lineHeight: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "#0008", alignItems: "center", justifyContent: "center", padding: 24 }, editCard: { width: "100%", backgroundColor: "#fff", borderRadius: 16, padding: 18 },
  sheetBackdrop: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" }, sheetScrim: { ...StyleSheet.absoluteFill, backgroundColor: "#0007" }, actionSheet: { backgroundColor: "#fbfdfc", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26, elevation: 14 },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#d4ddda", marginBottom: 16 }, sheetTitle: { color: "#24332e", fontSize: 19, fontWeight: "700" }, sheetPreview: { color: "#6b7974", fontSize: 13, lineHeight: 18, marginTop: 5, marginBottom: 10 },
  actionRow: { flexDirection: "row", alignItems: "center", minHeight: 64, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e6ece9", gap: 12 }, actionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#e8f4ef" }, deleteActionIcon: { backgroundColor: "#fceeee" }, actionCopy: { flex: 1 }, actionTitle: { color: "#25332f", fontSize: 14, fontWeight: "600" }, actionHint: { color: "#89958f", fontSize: 11, marginTop: 2 }, deleteActionTitle: { color: "#bc4646", fontSize: 14, fontWeight: "600" },
  sheetCancelButton: { marginTop: 12, height: 46, borderRadius: 15, backgroundColor: "#edf3f0", alignItems: "center", justifyContent: "center" }, sheetCancelText: { color: "#53645d", fontSize: 14, fontWeight: "600" },
  confirmCard: { width: "100%", backgroundColor: "#fff", borderRadius: 22, padding: 22, alignItems: "center" }, confirmIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#fff0f0", justifyContent: "center", alignItems: "center", marginBottom: 13 }, confirmTitle: { color: "#25332f", fontSize: 18, fontWeight: "700" }, confirmCopy: { color: "#718078", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7 }, confirmActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 22 }, confirmCancel: { flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#eef3f0" }, confirmCancelText: { color: "#506159", fontSize: 13, fontWeight: "600" }, confirmDelete: { flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#bd4b4b" }, confirmDeleteText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  infoCard: { width: "100%", maxHeight: "78%", backgroundColor: "#fff", borderRadius: 20, padding: 20, elevation: 8 }, infoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }, infoTitle: { color: "#25332f", fontSize: 20, fontWeight: "700" }, infoSubtitle: { color: "#7c8b85", fontSize: 13, marginTop: 3 },
  infoList: { flexGrow: 0 }, infoMessage: { backgroundColor: "#f5f8f6", borderRadius: 13, padding: 13, marginBottom: 10 }, infoMessageBody: { color: "#25332f", fontSize: 14, lineHeight: 20, marginBottom: 11 }, infoTimeRow: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 7 }, infoTimeLabel: { flex: 1, color: "#54656f", fontSize: 12, fontWeight: "600" }, infoTimeValue: { color: "#25332f", fontSize: 11, textAlign: "right" }, infoPending: { color: "#9aa5a2" },
  infoDoneButton: { alignSelf: "flex-end", backgroundColor: "#e8f3ef", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 5 }, infoDoneText: { color: "#075e54", fontSize: 14, fontWeight: "700" },
  editTitle: { color: "#25332f", fontSize: 17, fontWeight: "700", marginBottom: 12 }, editInput: { minHeight: 70, maxHeight: 150, color: "#111b21", fontSize: 16, borderWidth: 1, borderColor: "#d8e0dc", borderRadius: 10, padding: 10, textAlignVertical: "top" },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 24, marginTop: 16 }, cancelText: { color: "#667781", fontSize: 15 }, saveText: { color: "#128c7e", fontSize: 15, fontWeight: "700" },
});

export default ChatScreen;

function mergeRows(existing: MessageRow[], incoming: MessageRow[]) {
  const byId = new Map(existing.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, { ...byId.get(row.id), ...row });
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
