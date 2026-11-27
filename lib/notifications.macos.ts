/**
 * Notifications — macOS variant (Metro resolves this file instead of
 * lib/notifications.ts for platform === 'macos'; iOS/Android/web are
 * untouched).
 *
 * Motivation's notifications are LOCAL scheduled notifications via
 * expo-notifications, which has no react-native-macos build. This
 * variant exposes the EXACT same module API as inert no-ops: the
 * handler is never installed, permission always reports denied,
 * scheduling/cancelling do nothing. The Mac app simply has no daily
 * 8 AM / 9 PM quote notifications; every caller already treats a
 * non-granted permission as "skip scheduling", so behavior degrades
 * exactly the way it does on a phone where the user said no.
 *
 * MAINTENANCE: if lib/notifications.ts gains an export, add it here
 * too.
 */
import type { NotificationPermissionsStatus } from 'expo-notifications';
import type { Language, TrackId } from './brand';

export const DAILY_HOUR = 8; // 8:00 AM local (iOS/Android only)
export const EVENING_HOUR = 21; // 9:00 PM local — wind-down quote (3.0)
export const SCHEDULE_AHEAD_DAYS = 14;

/** No-op on macOS: there is no notification handler to install. */
export function initNotificationHandler(): void {}

const DENIED = {
  status: 'denied',
  granted: false,
  canAskAgain: false,
  expires: 'never',
} as unknown as NotificationPermissionsStatus;

export async function getPermissionStatus(): Promise<NotificationPermissionsStatus> {
  return DENIED;
}

/** Always FALSE on macOS — no permission prompt exists to show. */
export async function requestPermission(): Promise<boolean> {
  return false;
}

/** No-op on macOS: local quote notifications are phone-only. */
export async function ensureDailyQuotesScheduled(
  _lang: Language,
  _tracks: TrackId[],
): Promise<void> {}

/** No-op on macOS: nothing was ever scheduled. */
export async function cancelDailyQuotes(): Promise<void> {}
