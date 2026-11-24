import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Glass } from '../components/Glass';
import { Colors, Radius, Spacing, Type } from '../lib/design';
import type { ThemePalette } from '../lib/themes';
import { useTheme } from '../lib/themeContext';
import { useStrings } from '../lib/i18n';
import { PACKS } from '../lib/packs';
import {
  acceptInvite,
  challengeToday,
  createInvite,
  fetchInbox,
  fetchPartner,
  getActiveChallenge,
  getMyInviteCode,
  markChallengeDay,
  markEncouragementRead,
  partnerMissedDay,
  sendEncouragement,
  socialStatus,
  startSharedChallenge,
  unlinkPartner,
  type ChallengeInfo,
  type Encouragement,
  type PartnerInfo,
  type SocialStatus,
} from '../lib/social';

/**
 * Together (3.0) — accountability partner, shared 7-day challenges,
 * and the encouragement inbox. Settings → Together.
 *
 * Honest states: if sign-in is not configured in this build, or the
 * user is signed out, the screen says so and points at Account /
 * Sign In. If the Supabase social tables were never applied, remote
 * calls fail with reason 'migration' and the screen says the one-time
 * setup is still needed instead of pretending the link worked.
 */
export default function SocialScreen() {
  const { palette } = useTheme();
  const { t } = useStrings();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [status, setStatus] = useState<SocialStatus | null>(null);
  const [myCode, setMyCode] = useState('');
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [selectedPack, setSelectedPack] = useState(PACKS[0].id);
  const [inbox, setInbox] = useState<Encouragement[]>([]);
  const [compose, setCompose] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const st = await socialStatus();
    setStatus(st);
    setMyCode(await getMyInviteCode());
    if (st === 'ready') {
      void createInvite();
      const p = await fetchPartner();
      setPartner(p);
      if (p) {
        setChallenge(await getActiveChallenge());
        const mail = await fetchInbox();
        setInbox(mail);
        for (const m of mail) {
          if (!m.read) void markEncouragementRead(m.id);
        }
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const showError = (message?: string) => {
    setNotice(message || t('social.errorGeneric'));
  };

  const onLink = async () => {
    setBusy(true);
    setNotice('');
    const res = await acceptInvite(codeInput);
    setBusy(false);
    if (!res.ok) {
      if (res.error === 'migration') setNotice(t('social.setupBody'));
      else showError(res.message);
      return;
    }
    setCodeInput('');
    setNotice(t('social.linked'));
    void refresh();
  };

  const onShareCode = async () => {
    await Share.share({ message: t('social.shareCodeMessage', { code: myCode }) });
  };

  const onUnlink = () => {
    Alert.alert(t('social.unlink'), t('social.unlinkConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('social.unlink'),
        style: 'destructive',
        onPress: async () => {
          await unlinkPartner();
          setPartner(null);
          setChallenge(null);
          setInbox([]);
          void refresh();
        },
      },
    ]);
  };

  const onStartChallenge = async () => {
    setBusy(true);
    setNotice('');
    const res = await startSharedChallenge(selectedPack);
    setBusy(false);
    if (!res.ok) {
      if (res.error === 'migration') setNotice(t('social.setupBody'));
      else showError(res.message);
      return;
    }
    setChallenge(res.data ?? null);
  };

  const onMarkDay = async () => {
    if (!challenge) return;
    setBusy(true);
    const res = await markChallengeDay(challenge.id, challengeToday(challenge));
    setBusy(false);
    if (!res.ok) {
      if (res.error === 'migration') setNotice(t('social.setupBody'));
      else showError(res.message);
      return;
    }
    setChallenge(await getActiveChallenge());
  };

  const onSend = async () => {
    if (!partner) return;
    setBusy(true);
    setNotice('');
    const res = await sendEncouragement(partner.id, compose);
    setBusy(false);
    if (!res.ok) {
      if (res.error === 'migration') setNotice(t('social.setupBody'));
      else showError(res.message);
      return;
    }
    setCompose('');
    setNotice(t('social.sent'));
  };

  const missed = partnerMissedDay(partner);
  const today = challenge ? challengeToday(challenge) : 1;

  if (status === null) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={palette.textDim} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.h1}>{t('social.title')}</Text>
        <Text style={styles.sub}>{t('social.subtitle')}</Text>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {status === 'off' ? (
          <Glass style={styles.card}>
            <Text style={styles.cardTitle}>{t('social.offTitle')}</Text>
            <Text style={styles.cardBody}>{t('social.offBody')}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push('/settings/account')}>
              <Text style={styles.primaryBtnText}>{t('social.offBtn')}</Text>
            </Pressable>
          </Glass>
        ) : status === 'signed-out' ? (
          <Glass style={styles.card}>
            <Text style={styles.cardTitle}>{t('social.signedOutTitle')}</Text>
            <Text style={styles.cardBody}>{t('social.signedOutBody')}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.push('/settings/signin')}>
              <Text style={styles.primaryBtnText}>{t('social.signedOutBtn')}</Text>
            </Pressable>
          </Glass>
        ) : (
          <>
            {/* Partner */}
            <Text style={styles.sectionTitle}>{t('social.partnerTitle')}</Text>
            {!partner ? (
              <Glass style={styles.card}>
                <Text style={styles.cardBody}>{t('social.noPartnerBody')}</Text>
                <Text style={styles.codeLabel}>{t('social.myCode')}</Text>
                <Text style={styles.code}>{myCode}</Text>
                <Pressable style={styles.secondaryBtn} onPress={onShareCode}>
                  <Text style={styles.secondaryBtnText}>{t('social.shareCode')}</Text>
                </Pressable>
                <TextInput
                  style={styles.input}
                  value={codeInput}
                  onChangeText={(v) => setCodeInput(v.toUpperCase())}
                  placeholder={t('social.enterCodePlaceholder')}
                  placeholderTextColor={palette.textDim}
                  autoCapitalize="characters"
                  maxLength={6}
                />
                <Pressable
                  style={[styles.primaryBtn, (busy || !codeInput.trim()) && styles.disabled]}
                  onPress={onLink}
                  disabled={busy || !codeInput.trim()}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy ? t('social.linking') : t('social.linkBtn')}
                  </Text>
                </Pressable>
              </Glass>
            ) : (
              <Glass style={styles.card}>
                <View style={styles.partnerRow}>
                  <Ionicons name="heart" size={22} color={Colors.danger} />
                  <Text style={styles.cardTitle}>{partner.name ?? t('social.partnerFallback')}</Text>
                </View>
                <Text style={styles.cardBody}>
                  {t('social.partnerStreak', { n: partner.streak })}
                  {partner.lastOpen ? ` · ${t('social.lastOpen', { date: partner.lastOpen })}` : ''}
                </Text>
                {missed ? (
                  <View style={styles.missedCard}>
                    <Text style={styles.missedText}>{t('social.missedDay')}</Text>
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() => setCompose(t('social.checkInDefault'))}
                    >
                      <Text style={styles.secondaryBtnText}>{t('social.checkOnThem')}</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable style={styles.dangerBtn} onPress={onUnlink}>
                  <Text style={styles.dangerBtnText}>{t('social.unlink')}</Text>
                </Pressable>
              </Glass>
            )}

            {/* Shared challenge */}
            {partner ? (
              <>
                <Text style={styles.sectionTitle}>{t('social.challengeTitle')}</Text>
                {!challenge ? (
                  <Glass style={styles.card}>
                    <Text style={styles.cardBody}>{t('social.noChallengeBody')}</Text>
                    <View style={styles.packRow}>
                      {PACKS.map((p) => (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelectedPack(p.id)}
                          style={[styles.packChip, selectedPack === p.id && styles.packChipActive]}
                        >
                          <Text
                            style={[
                              styles.packChipText,
                              selectedPack === p.id && styles.packChipTextActive,
                            ]}
                          >
                            {t(`packs.${p.id}.name`)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      style={[styles.primaryBtn, busy && styles.disabled]}
                      onPress={onStartChallenge}
                      disabled={busy}
                    >
                      <Text style={styles.primaryBtnText}>
                        {busy ? t('social.starting') : t('social.startChallenge')}
                      </Text>
                    </Pressable>
                  </Glass>
                ) : (
                  <Glass style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {t(`packs.${challenge.packId}.name`)}
                    </Text>
                    <Text style={styles.cardBody}>{t('social.dayOf', { n: today })}</Text>
                    <View style={styles.progressRow}>
                      <View style={styles.progressCol}>
                        <Text style={styles.progressLabel}>{t('social.you')}</Text>
                        <Text style={styles.progressValue}>
                          {challenge.myDays.length} / 7
                        </Text>
                      </View>
                      <View style={styles.progressCol}>
                        <Text style={styles.progressLabel}>{t('social.partner')}</Text>
                        <Text style={styles.progressValue}>
                          {challenge.partnerDays.length} / 7
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dots}>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <View
                          key={d}
                          style={[
                            styles.dot,
                            challenge.myDays.includes(d) && styles.dotDone,
                            d === today && !challenge.myDays.includes(d) && styles.dotToday,
                          ]}
                        />
                      ))}
                    </View>
                    <Pressable
                      style={[
                        styles.primaryBtn,
                        (busy || challenge.myDays.includes(today)) && styles.disabled,
                      ]}
                      onPress={onMarkDay}
                      disabled={busy || challenge.myDays.includes(today)}
                    >
                      <Text style={styles.primaryBtnText}>
                        {challenge.myDays.includes(today) ? t('social.done') : t('social.markDone')}
                      </Text>
                    </Pressable>
                  </Glass>
                )}
              </>
            ) : null}

            {/* Encouragement inbox */}
            {partner ? (
              <>
                <Text style={styles.sectionTitle}>{t('social.inboxTitle')}</Text>
                <Glass style={styles.card}>
                  <TextInput
                    style={styles.input}
                    value={compose}
                    onChangeText={setCompose}
                    placeholder={t('social.composePlaceholder')}
                    placeholderTextColor={palette.textDim}
                    multiline
                    maxLength={280}
                  />
                  <Pressable
                    style={[styles.primaryBtn, (busy || !compose.trim()) && styles.disabled]}
                    onPress={onSend}
                    disabled={busy || !compose.trim()}
                  >
                    <Text style={styles.primaryBtnText}>
                      {busy ? t('social.sending') : t('social.sendBtn')}
                    </Text>
                  </Pressable>
                </Glass>
                {inbox.length === 0 ? (
                  <Text style={styles.empty}>{t('social.inboxEmpty')}</Text>
                ) : (
                  inbox.map((m) => (
                    <Glass key={m.id} style={styles.card}>
                      <Text style={styles.cardBody}>{m.text}</Text>
                      <Text style={styles.meta}>
                        {m.fromName} · {m.date.slice(0, 10)}
                      </Text>
                    </Glass>
                  ))
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
    body: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1, paddingBottom: Spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    backRow: { paddingVertical: Spacing.xs },
    back: { color: p.textDim, fontSize: 17, fontWeight: '600' },
    h1: { ...Type.display, color: p.text },
    sub: { ...Type.body, color: p.textMuted },
    notice: { ...Type.body, color: p.text, backgroundColor: p.surface, borderRadius: Radius.md, padding: Spacing.md },
    sectionTitle: { ...Type.title, color: p.text, fontWeight: '800', marginTop: Spacing.sm },
    card: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
    cardTitle: { ...Type.title, color: p.text, fontWeight: '800' },
    cardBody: { ...Type.body, color: p.textDim },
    meta: { ...Type.caption, color: p.textDim },
    empty: { ...Type.body, color: p.textDim, textAlign: 'center', marginTop: Spacing.sm },
    primaryBtn: {
      backgroundColor: p.button,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    primaryBtnText: { ...Type.title, color: p.buttonText },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    secondaryBtnText: { ...Type.title, color: p.text },
    dangerBtn: {
      borderWidth: 1,
      borderColor: Colors.danger,
      borderRadius: Radius.md,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    dangerBtnText: { ...Type.title, color: Colors.danger },
    disabled: { opacity: 0.5 },
    codeLabel: { ...Type.eyebrow, color: p.textDim },
    code: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 6,
      color: p.text,
      textAlign: 'center',
    },
    input: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: Radius.md,
      padding: Spacing.md,
      color: p.text,
      fontSize: 16,
      backgroundColor: p.surface,
    },
    partnerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    missedCard: {
      backgroundColor: p.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    missedText: { ...Type.body, color: p.text },
    packRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    packChip: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    packChipActive: { backgroundColor: p.button, borderColor: p.button },
    packChipText: { fontSize: 15, color: p.textDim, fontWeight: '700' },
    packChipTextActive: { color: p.buttonText },
    progressRow: { flexDirection: 'row', gap: Spacing.md },
    progressCol: { flex: 1, alignItems: 'center', gap: 2 },
    progressLabel: { ...Type.caption, color: p.textDim },
    progressValue: { fontSize: 20, fontWeight: '800', color: p.text },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: 'transparent',
    },
    dotDone: { backgroundColor: p.button, borderColor: p.button },
    dotToday: { borderColor: p.text },
  });
}
