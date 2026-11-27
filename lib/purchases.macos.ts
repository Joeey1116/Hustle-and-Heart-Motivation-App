/**
 * Purchases — macOS variant (Metro resolves this file instead of
 * lib/purchases.ts for platform === 'macos'; iOS/Android/web are
 * untouched).
 *
 * react-native-iap has no react-native-macos build, so the IAP-backed
 * implementation cannot run on macOS. This variant exposes the EXACT
 * same module API with the store permanently disconnected: no
 * products load, purchase/restore report failure, and Haven Plus is
 * NEVER granted here — purchases stay an iOS/Android App Store /
 * Play flow. Every screen that reads useHavenPlus() therefore renders
 * its existing not-connected / free-plan state on Mac, unchanged.
 *
 * SKUs use the iOS product IDs: the Mac app ships under the same App
 * Store Connect record (universal purchase), so when Mac IAP support
 * lands, these are the product IDs it will query.
 *
 * MAINTENANCE: if lib/purchases.ts gains an export, add it here too.
 */
import type { Product, ProductSubscription } from 'react-native-iap';

// Product IDs from App Store Connect (same as lib/purchases.ts iOS).
const IOS_SKUS = [
  'HAVENMONTH299',
  'HAVEN3MONTH799',
  'HAVEN6MONTH1499',
  'HAVEN1YEAR1999',
];

export const SKUS = IOS_SKUS;

const IOS_IAP_SKUS = ['HAVENLIFETIME4999', 'HAVENSTREAKFREEZE099'];

export const IAP_SKUS = IOS_IAP_SKUS;

/** Lifetime Haven Plus (non-consumable) — Haven Plus forever, pay once. */
export const LIFETIME_SKU = 'HAVENLIFETIME4999';

/** Streak Freeze (consumable) — one freeze saves the streak for one missed day. */
export const FREEZE_SKU = 'HAVENSTREAKFREEZE099';

/** Friendly plan names per SKU (fallback when StoreKit gives no title). */
export const SKU_NAMES: Record<string, string> = {
  HAVENMONTH299: 'Monthly',
  HAVEN3MONTH799: '3 Months',
  HAVEN6MONTH1499: '6 Months',
  HAVEN1YEAR1999: 'Yearly',
  HAVENLIFETIME4999: 'Lifetime',
  HAVENSTREAKFREEZE099: 'Streak Freeze',
  havenplus_monthly: 'Monthly',
  havenplus_3month: '3 Months',
  havenplus_6month: '6 Months',
  havenplus_yearly: 'Yearly',
  havenplus_lifetime: 'Lifetime',
  havenplus_streak_freeze: 'Streak Freeze',
};

export function useHavenPlus() {
  return {
    subscriptions: [] as ProductSubscription[],
    /** One-time products (Lifetime + Streak Freeze), price ascending. */
    products: [] as Product[],
    /** Store never connects on macOS, so there is nothing to load. */
    productsLoading: false,
    /** No purchase sheet can ever be in flight on macOS. */
    purchasing: false,
    /** Purchases are unavailable on macOS — always resolves FALSE. */
    purchase: async (_sku: string): Promise<boolean> => false,
    /** One-time purchases are unavailable on macOS — always FALSE. */
    purchaseInApp: async (_sku: string): Promise<boolean> => false,
    /** Nothing to restore on macOS — always resolves FALSE. */
    restore: async (): Promise<boolean> => false,
    finishTransaction: async (_args: {
      purchase: unknown;
      isConsumable?: boolean;
    }): Promise<void> => undefined,
  };
}
