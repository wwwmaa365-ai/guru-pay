import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../services/api';
import { triggerLocalPaymentNotification } from '../services/notifications';
import { palette, radii, spacing } from '../theme/tokens';

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];
const METHODS: ('UPI' | 'CARD' | 'NETBANKING')[] = ['UPI', 'CARD', 'NETBANKING'];

export const WalletScreen: React.FC = () => {
  const { user, setUserDirect, refreshUser } = useAuth();
  const [amount, setAmount] = useState('1000');
  const [method, setMethod] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTopUp = async () => {
    setError(null);
    setMessage(null);
    const val = Number(amount);
    if (!Number.isFinite(val) || val < 50 || val > 50000) {
      setError('Enter an amount between ₹50 and ₹50,000.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.topUpWallet(val, method);
      setUserDirect(res.user);
      await refreshUser();
      setMessage(`₹${val.toFixed(2)} added via ${method}.`);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await triggerLocalPaymentNotification(
        'Wallet Credited',
        `₹${val.toFixed(2)} added to your PayPulse Wallet.`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Top-up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Wallet</Text>

        <LinearGradient
          colors={[palette.navyCard, palette.navyCardEnd]}
          style={styles.heroCard}
        >
          <Text style={styles.heroLabel}>Available Balance</Text>
          <Text style={styles.heroValue}>
            ₹{user.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.heroSub}>
            Total Cashback Earned: ₹{user.cashbackEarned.toFixed(2)}
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add Money to Wallet</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Enter amount (₹)"
            placeholderTextColor={palette.inkMuted}
          />

          <View style={styles.presetRow}>
            {PRESET_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => setAmount(String(val))}
                style={[
                  styles.presetBtn,
                  Number(amount) === val && styles.presetBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    Number(amount) === val && styles.presetTextActive,
                  ]}
                >
                  +₹{val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.methodLabel}>Payment Rail</Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMethod(m)}
                style={[styles.methodBtn, method === m && styles.methodBtnActive]}
              >
                <Text
                  style={[styles.methodText, method === m && styles.methodTextActive]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={palette.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {message && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color={palette.accentPrimary} />
              <Text style={styles.successText}>{message}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleTopUp}
            disabled={submitting}
            style={styles.addBtn}
          >
            {submitting ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.addBtnText}>Proceed to Add Money</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bgCanvas },
  container: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.inkPrimary,
    marginBottom: spacing.lg,
  },
  heroCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  heroLabel: { color: '#94A3B8', fontSize: 13 },
  heroValue: {
    color: palette.white,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroSub: { color: '#CBD5E1', fontSize: 13, marginTop: 10 },
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.inkPrimary,
    marginBottom: 12,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: palette.inkPrimary,
    backgroundColor: palette.bgCanvas,
  },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  presetBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.sm,
    backgroundColor: palette.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnActive: { backgroundColor: palette.accentSoft },
  presetText: { fontSize: 13, fontWeight: '600', color: palette.inkSecondary },
  presetTextActive: { color: palette.accentPrimary },
  methodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.inkSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBtnActive: {
    borderColor: palette.inkPrimary,
    backgroundColor: palette.inkPrimary,
  },
  methodText: { fontSize: 12, fontWeight: '700', color: palette.inkSecondary },
  methodTextActive: { color: palette.white },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.dangerSoft,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: 14,
  },
  errorText: { fontSize: 13, color: palette.danger },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.accentSoft,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: 14,
  },
  successText: { fontSize: 13, color: palette.accentPrimaryDark, fontWeight: '600' },
  addBtn: {
    minHeight: 50,
    backgroundColor: palette.accentPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  addBtnText: { color: palette.white, fontSize: 15, fontWeight: '700' },
});
