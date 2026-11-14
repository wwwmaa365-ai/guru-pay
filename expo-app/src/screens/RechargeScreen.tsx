import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { api, ApiError } from '../services/api';
import { triggerLocalPaymentNotification } from '../services/notifications';
import { palette, radii, spacing } from '../theme/tokens';
import { Operator, RechargePlan, TransactionRecord } from '../types';

type Route = RouteProp<RootStackParamList, 'Recharge'>;
const CIRCLES = ['All India', 'Karnataka', 'Maharashtra', 'Delhi NCR', 'Tamil Nadu'];

export const RechargeScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { user, setUserDirect, refreshUser } = useAuth();
  const [category, setCategory] = useState<'mobile' | 'dth'>(
    route.params?.initialCategory || 'mobile'
  );
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOp, setSelectedOp] = useState<Operator | null>(null);
  const [plans, setPlans] = useState<RechargePlan[]>([]);
  const [accountNumber, setAccountNumber] = useState('');
  const [circle, setCircle] = useState('All India');
  const [selectedPlan, setSelectedPlan] = useState<RechargePlan | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransactionRecord | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.getOperators(category);
        setOperators(res.operators);
        const first = res.operators[0] || null;
        setSelectedOp(first);
        setSelectedPlan(null);
        if (first) {
          const pRes = await api.getPlans(first.id);
          setPlans(pRes.plans);
        } else {
          setPlans([]);
        }
      } catch {
        setError('Unable to load operators.');
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  const handleSelectOperator = async (op: Operator) => {
    setSelectedOp(op);
    setSelectedPlan(null);
    const pRes = await api.getPlans(op.id).catch(() => ({ plans: [] }));
    setPlans(pRes.plans);
  };

  const handleRecharge = async () => {
    if (!selectedOp) return;
    setError(null);
    const amount = selectedPlan ? selectedPlan.amount : Number(customAmount);
    if (!accountNumber.trim()) {
      setError(`Please enter ${selectedOp.accountLabel}.`);
      return;
    }
    if (!Number.isFinite(amount) || amount < 10) {
      setError('Select a plan or enter an amount of at least ₹10.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.executeRecharge({
        operatorId: selectedOp.id,
        accountNumber: accountNumber.trim(),
        circle: category === 'mobile' ? circle : undefined,
        planId: selectedPlan?.id,
        amount,
      });
      setUserDirect(res.user);
      await refreshUser();
      setReceipt(res.transaction);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await triggerLocalPaymentNotification(
        'Recharge Confirmed',
        `₹${res.transaction.amount.toFixed(2)} ${selectedOp.name} succeeded.`
      );
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : 'Recharge failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.segmentWrap}>
        {(['mobile', 'dth'] as const).map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => {
              setCategory(cat);
              setError(null);
            }}
            style={[styles.segmentBtn, category === cat && styles.segmentBtnActive]}
          >
            <Text
              style={[
                styles.segmentText,
                category === cat && styles.segmentTextActive,
              ]}
            >
              {cat === 'mobile' ? 'Mobile Recharge' : 'DTH Recharge'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Select Operator</Text>
      {loading ? (
        <ActivityIndicator color={palette.accentPrimary} style={{ marginVertical: 20 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.opRow}
        >
          {operators.map((op) => {
            const active = selectedOp?.id === op.id;
            return (
              <TouchableOpacity
                key={op.id}
                onPress={() => handleSelectOperator(op)}
                style={[styles.opChip, active && styles.opChipActive]}
              >
                <Text style={[styles.opChipText, active && styles.opChipTextActive]}>
                  {op.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {selectedOp && (
        <View style={styles.card}>
          <Text style={styles.inputLabel}>{selectedOp.accountLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={selectedOp.accountPlaceholder}
            placeholderTextColor={palette.inkMuted}
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
          />

          {category === 'mobile' && (
            <>
              <Text style={styles.inputLabel}>Telecom Circle</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.circleRow}
              >
                {CIRCLES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCircle(c)}
                    style={[styles.circleBtn, circle === c && styles.circleBtnActive]}
                  >
                    <Text
                      style={[
                        styles.circleText,
                        circle === c && styles.circleTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={styles.inputLabel}>Or Enter Custom Amount (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 299"
            placeholderTextColor={palette.inkMuted}
            value={selectedPlan ? String(selectedPlan.amount) : customAmount}
            onChangeText={(txt) => {
              setSelectedPlan(null);
              setCustomAmount(txt);
            }}
            keyboardType="numeric"
          />
        </View>
      )}

      <Text style={styles.sectionLabel}>Recommended Plans</Text>
      {plans.map((plan) => {
        const isSelected = selectedPlan?.id === plan.id;
        return (
          <TouchableOpacity
            key={plan.id}
            onPress={() => {
              setSelectedPlan(plan);
              setCustomAmount(String(plan.amount));
            }}
            style={[styles.planCard, isSelected && styles.planCardActive]}
            activeOpacity={0.85}
          >
            <View style={styles.planTop}>
              <Text style={styles.planAmount}>₹{plan.amount}</Text>
              <Text style={styles.planMeta}>
                {plan.validity} · {plan.data}
              </Text>
            </View>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planDesc}>{plan.description}</Text>
          </TouchableOpacity>
        );
      })}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleRecharge}
        disabled={submitting || !selectedOp}
        style={[styles.payBtn, submitting && { opacity: 0.6 }]}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color={palette.white} />
        ) : (
          <Text style={styles.payBtnText}>
            Pay ₹
            {(selectedPlan?.amount || Number(customAmount) || 0).toFixed(2)} via Wallet (
            Bal: ₹{user?.walletBalance.toFixed(2)})
          </Text>
        )}
      </TouchableOpacity>

      <Modal visible={Boolean(receipt)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={28} color={palette.accentPrimary} />
            </View>
            <Text style={styles.modalTitle}>Recharge Successful</Text>
            <Text style={styles.modalAmount}>₹{receipt?.amount.toFixed(2)}</Text>
            <Text style={styles.modalMeta}>
              {receipt?.operatorName} · {receipt?.accountNumber}
            </Text>
            <Text style={styles.modalRef}>Ref: {receipt?.referenceId}</Text>
            <Text style={styles.modalCashback}>
              Cashback Credited: ₹{receipt?.cashback.toFixed(2)}
            </Text>
            <TouchableOpacity
              onPress={() => setReceipt(null)}
              style={styles.modalBtn}
            >
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: palette.bgCanvas },
  container: { padding: spacing.lg, paddingBottom: 40 },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: palette.bgSubtle,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  segmentBtnActive: { backgroundColor: palette.bgSurface },
  segmentText: { fontSize: 14, fontWeight: '600', color: palette.inkMuted },
  segmentTextActive: { color: palette.inkPrimary },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.inkPrimary,
    marginBottom: 10,
    marginTop: 6,
  },
  opRow: { gap: 8, paddingBottom: 12 },
  opChip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: palette.bgSurface,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    justifyContent: 'center',
  },
  opChipActive: {
    backgroundColor: palette.inkPrimary,
    borderColor: palette.inkPrimary,
  },
  opChipText: { fontSize: 13, fontWeight: '600', color: palette.inkPrimary },
  opChipTextActive: { color: palette.white },
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.inkSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: palette.inkPrimary,
    backgroundColor: palette.bgCanvas,
  },
  circleRow: { gap: 8, paddingVertical: 4 },
  circleBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: palette.bgSubtle,
    justifyContent: 'center',
  },
  circleBtnActive: { backgroundColor: palette.accentSoft },
  circleText: { fontSize: 12, fontWeight: '600', color: palette.inkSecondary },
  circleTextActive: { color: palette.accentPrimary },
  planCard: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
    marginBottom: 10,
  },
  planCardActive: {
    borderColor: palette.accentPrimary,
    backgroundColor: palette.accentSoft,
  },
  planTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  planMeta: { fontSize: 12, fontWeight: '600', color: palette.inkMuted },
  planTitle: { fontSize: 14, fontWeight: '700', color: palette.inkPrimary },
  planDesc: { fontSize: 12, color: palette.inkSecondary, marginTop: 4, lineHeight: 17 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.dangerSoft,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: 10,
  },
  errorText: { fontSize: 13, color: palette.danger, flex: 1 },
  payBtn: {
    minHeight: 52,
    backgroundColor: palette.accentPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  payBtnText: { color: palette.white, fontSize: 15, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: palette.inkPrimary },
  modalAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: palette.inkPrimary,
    marginVertical: 8,
  },
  modalMeta: { fontSize: 14, color: palette.inkSecondary },
  modalRef: { fontSize: 12, color: palette.inkMuted, marginTop: 4 },
  modalCashback: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.accentPrimary,
    marginTop: 10,
  },
  modalBtn: {
    width: '100%',
    minHeight: 48,
    backgroundColor: palette.inkPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalBtnText: { color: palette.white, fontWeight: '700', fontSize: 15 },
});
