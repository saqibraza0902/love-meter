import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import Config from "react-native-config";

export const PREMIUM_ENTITLEMENT = "premium";

let configured = false;

function getPublicKey() {
  if (Platform.OS === "ios") return Config.REVENUECAT_IOS_KEY;
  if (Platform.OS === "android") return Config.REVENUECAT_ANDROID_KEY;
  return undefined;
}

export async function configureRevenueCat(userId: string) {
  if (Platform.OS === "web") throw new Error("Subscriptions are available in the iOS and Android apps.");
  const apiKey = getPublicKey();
  if (!apiKey) throw new Error("Add your RevenueCat iOS and Android public SDK keys to the app environment.");

  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
  return Purchases.getCustomerInfo();
}

export async function loadSubscriptionPackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages || [];
}

export function findMonthlyPackage(packages: PurchasesPackage[]) {
  return packages.find((item) => item.packageType === Purchases.PACKAGE_TYPE.MONTHLY)
    || packages.find((item) => /month/i.test(item.identifier));
}

export function findYearlyPackage(packages: PurchasesPackage[]) {
  return packages.find((item) => item.packageType === Purchases.PACKAGE_TYPE.ANNUAL)
    || packages.find((item) => /annual|year/i.test(item.identifier));
}

export function hasPremiumEntitlement(info: Awaited<ReturnType<typeof Purchases.getCustomerInfo>>) {
  return Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT]);
}

export async function buySubscription(packageToBuy: PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
  return customerInfo;
}

export function restoreSubscriptions() {
  return Purchases.restorePurchases();
}
