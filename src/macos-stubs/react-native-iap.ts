/**
 * react-native-iap stub for macOS bundles ONLY (wired up in
 * metro.config.js; iOS/Android resolve the real package).
 *
 * react-native-iap (StoreKit / Play Billing) ships no react-native-macos
 * build, so the module cannot resolve for the macos platform. Nothing on
 * macOS calls into this stub in practice — lib/purchases.macos.ts
 * replaces the whole purchases module with a store-disconnected
 * implementation that never imports react-native-iap. This stub is a
 * safety net for any shared file that names the module: every export
 * is inert, useIAP reports "not connected", and listeners return a
 * removable no-op — exactly the semantics lib/purchases.ts already
 * handles as its not-connected state.
 */

export type Product = { productId: string; price?: number };
export type ProductSubscription = { productId: string; price?: number };
export type Purchase = { productId: string };
export type PurchaseError = { code?: string; message?: string };

const remove = () => ({ remove: () => {} });

export function useIAP() {
  return {
    connected: false,
    products: [] as Product[],
    subscriptions: [] as ProductSubscription[],
    requestPurchase: async () => undefined,
    finishTransaction: async () => undefined,
    fetchProducts: async () => undefined,
  };
}

export function purchaseUpdatedListener(_cb: (p: Purchase) => void) {
  return remove();
}

export function purchaseErrorListener(_cb: (e: PurchaseError) => void) {
  return remove();
}

export async function getAvailablePurchases(): Promise<Purchase[]> {
  return [];
}

export function isUserCancelledError(_e: unknown): boolean {
  return false;
}

export default {};
