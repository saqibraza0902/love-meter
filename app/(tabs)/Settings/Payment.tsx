import { useAppSelector } from "@/hooks/use-redux";
import { useToast } from "@/providers/toast-provider";
import { findMonthlyPackage, findYearlyPackage, configureRevenueCat, loadSubscriptionPackages, buySubscription, restoreSubscriptions, hasPremiumEntitlement } from "@/utils/revenuecat";
import { supabase } from "@/utils/supabase";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "@/navigation/router-compat";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

type Plan = "monthly" | "yearly";

const PaymentScreen = () => {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.user);
  const { toast } = useToast();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isPremium, setIsPremium] = useState(!!user?.paid);

  const monthlyPackage = useMemo(() => findMonthlyPackage(packages), [packages]);
  const yearlyPackage = useMemo(() => findYearlyPackage(packages), [packages]);
  const selectedPackage = selectedPlan === "yearly" ? yearlyPackage : monthlyPackage;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const customerInfo = await configureRevenueCat(user.id);
        const available = await loadSubscriptionPackages();
        if (mounted) {
          setPackages(available);
          setIsPremium(hasPremiumEntitlement(customerInfo) || !!user.paid);
          if (!findYearlyPackage(available) && findMonthlyPackage(available)) setSelectedPlan("monthly");
        }
      } catch (error: any) {
        if (mounted) toast(error.message || "Subscription options couldn't be loaded.");
      } finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [user?.id, user?.paid, toast]);

  const syncAccess = async () => {
    if (!user?.id) return false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data } = await supabase.from("entitlements").select("active").eq("user_id", user.id).maybeSingle();
      if (data?.active) return true;
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    }
    return false;
  };

  const purchase = async () => {
    if (!selectedPackage || purchasing) return;
    try {
      setPurchasing(true);
      const info = await buySubscription(selectedPackage);
      const active = hasPremiumEntitlement(info);
      setIsPremium(active);
      if (active) {
        const synced = await syncAccess();
        Alert.alert("You're a member", synced ? "Your membership perks are ready." : "Your purchase is confirmed. Membership access is syncing to your account.");
      }
    } catch (error: any) {
      if (!error?.userCancelled) toast(error?.message || "Purchase could not be completed.");
    } finally { setPurchasing(false); }
  };

  const restore = async () => {
    try {
      setRestoring(true);
      const info = await restoreSubscriptions();
      const active = hasPremiumEntitlement(info);
      setIsPremium(active);
      if (active) {
        await syncAccess();
        Alert.alert("Membership restored", "Your subscription is linked to this account.");
      } else toast("No active membership was found for this store account.");
    } catch (error: any) { toast(error?.message || "Purchases could not be restored."); }
    finally { setRestoring(false); }
  };

  const openSubscriptionSettings = async () => {
    const url = Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color="#554b43" /><Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <View style={styles.heroIcon}><Ionicons name="heart" size={27} color="#a65f65" /></View>
        <Text style={styles.title}>{isPremium ? "Your membership" : "Grow closer, together"}</Text>
        <Text style={styles.subtitle}>Every app feature is free. Membership is an optional way to support continued development.</Text>

        <View style={styles.perksCard}>
          <Text style={styles.perksHeading}>Available to everyone</Text>
          <Perk icon="images-outline" title="Picture quizzes" detail="Add image choices to your couple quizzes for free." />
          <Perk icon="sparkles-outline" title="Relationship guide" detail="Get thoughtful ideas grounded in shared context, when both of you opt in." />
        </View>

        {isPremium ? <View style={styles.memberCard}>
          <Ionicons name="checkmark-circle" size={25} color="#5f806b" />
          <View style={{ flex: 1, marginLeft: 11 }}><Text style={styles.memberTitle}>Thank you for your support</Text><Text style={styles.memberCopy}>All features are available to everyone.</Text></View>
          <TouchableOpacity onPress={openSubscriptionSettings}><Text style={styles.manageText}>Manage</Text></TouchableOpacity>
        </View> : <>
          <View style={styles.planHeading}><Text style={styles.perksHeading}>Choose your plan</Text><Text style={styles.storeNote}>Prices shown by your store</Text></View>
          <PlanOption title="Yearly" subtitle="Billed once a year" price={yearlyPackage?.product.priceString} selected={selectedPlan === "yearly"} onPress={() => setSelectedPlan("yearly")} />
          <PlanOption title="Monthly" subtitle="Billed monthly" price={monthlyPackage?.product.priceString} selected={selectedPlan === "monthly"} onPress={() => setSelectedPlan("monthly")} />
          {loading ? <ActivityIndicator color="#a65f65" style={{ marginVertical: 18 }} /> : !monthlyPackage && !yearlyPackage ?
            <Text style={styles.setupNote}>Subscription plans are not available yet. Please try again later.</Text> : null}
          <TouchableOpacity style={[styles.subscribeButton, (!selectedPackage || loading || purchasing) && styles.disabledButton]} onPress={purchase} disabled={!selectedPackage || loading || purchasing}>
            {purchasing ? <ActivityIndicator color="#fff" /> : <Text style={styles.subscribeText}>{selectedPackage ? `Continue Â· ${selectedPackage.product.priceString}` : "Choose a plan"}</Text>}
          </TouchableOpacity>
          <Text style={styles.renewalNote}>Payment is charged to your Apple or Google account. Subscriptions renew automatically unless canceled at least 24 hours before the current period ends. Manage or cancel in your store account.</Text>
        </>}

        <TouchableOpacity style={styles.restoreButton} onPress={restore} disabled={restoring || Platform.OS === "web"}>
          {restoring ? <ActivityIndicator color="#6c8173" size="small" /> : <Text style={styles.restoreText}>Restore purchases</Text>}
        </TouchableOpacity>
        <Text style={styles.legalText}>By subscribing, you agree to the appâ€™s Terms and Privacy Policy. AI relationship help is optional and requires both partnersâ€™ consent.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const Perk = ({ icon, title, detail }: { icon: string; title: string; detail: string }) => (
  <View style={styles.perkRow}><View style={styles.perkIcon}><Ionicons name={icon} size={19} color="#6d8777" /></View><View style={{ flex: 1 }}><Text style={styles.perkTitle}>{title}</Text><Text style={styles.perkDetail}>{detail}</Text></View></View>
);

const PlanOption = ({ title, subtitle, price, selected, onPress }: { title: string; subtitle: string; price?: string; selected: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} style={[styles.planCard, selected && styles.planCardSelected]}>
    <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
    <View style={{ flex: 1 }}><Text style={styles.planTitle}>{title}</Text><Text style={styles.planSubtitle}>{subtitle}</Text></View>
    <Text style={styles.planPrice}>{price || "â€”"}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f2eb" },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 34 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8, alignSelf: "flex-start" },
  backText: { color: "#554b43", fontSize: 14, fontWeight: "600" },
  heroIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#f0dfdc", justifyContent: "center", alignItems: "center", alignSelf: "center", marginTop: 18 },
  title: { color: "#3f3832", fontSize: 25, fontWeight: "700", textAlign: "center", marginTop: 15 },
  subtitle: { color: "#82766d", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, marginBottom: 22 },
  perksCard: { backgroundColor: "#fffdfa", borderRadius: 20, borderWidth: 1, borderColor: "#eee4d9", padding: 17, marginBottom: 22 },
  perksHeading: { color: "#4a413a", fontSize: 16, fontWeight: "700" },
  perkRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 11 },
  perkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#e8eee7", justifyContent: "center", alignItems: "center" },
  perkTitle: { color: "#4a413a", fontWeight: "600", fontSize: 14 },
  perkDetail: { color: "#82766d", fontSize: 12, lineHeight: 17, marginTop: 2 },
  planHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  storeNote: { color: "#988d82", fontSize: 11 },
  planCard: { backgroundColor: "#fffdfa", borderColor: "#e9dfd3", borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 9 },
  planCardSelected: { borderColor: "#a65f65", backgroundColor: "#fcf5f2" },
  radio: { width: 20, height: 20, borderRadius: 10, borderColor: "#b9afa5", borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginRight: 11 },
  radioSelected: { borderColor: "#a65f65" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#a65f65" },
  planTitle: { color: "#4a413a", fontSize: 14, fontWeight: "700" },
  planSubtitle: { color: "#887d73", fontSize: 11, marginTop: 3 },
  planPrice: { color: "#493e37", fontSize: 15, fontWeight: "700" },
  setupNote: { color: "#82766d", fontSize: 12, textAlign: "center", paddingVertical: 8 },
  subscribeButton: { minHeight: 50, borderRadius: 15, backgroundColor: "#a65f65", justifyContent: "center", alignItems: "center", marginTop: 10 },
  disabledButton: { opacity: 0.5 },
  subscribeText: { color: "#fffdfa", fontSize: 15, fontWeight: "700" },
  renewalNote: { color: "#8a7f75", fontSize: 10, textAlign: "center", lineHeight: 15, marginTop: 11 },
  restoreButton: { alignSelf: "center", paddingVertical: 15, paddingHorizontal: 18 },
  restoreText: { color: "#668071", fontSize: 13, fontWeight: "600" },
  legalText: { color: "#9a8e83", fontSize: 10, lineHeight: 15, textAlign: "center" },
  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#eaf0e9", borderRadius: 16, padding: 15, marginBottom: 10 },
  memberTitle: { color: "#48604f", fontWeight: "700", fontSize: 14 },
  memberCopy: { color: "#738274", fontSize: 12, marginTop: 3 },
  manageText: { color: "#52715f", fontWeight: "700", fontSize: 12 },
});

export default PaymentScreen;
