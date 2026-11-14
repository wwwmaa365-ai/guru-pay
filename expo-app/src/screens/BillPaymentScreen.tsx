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
import { FetchedBill, Operator, ServiceCategory, TransactionRecord } from '../types';

type Route = RouteProp<RootStackParamList, 'BillPayment'>;

const BILL_CATEGORIES: { key: Exclude<ServiceCategory, 'mobile' | 'dth'>; label: string }[] = [
  { key: 'electricity', label: 'Electricity' },
  { key: 'broadband', label: 'Broadband' },
  { key: 'water', label: 'Water' },
  { key: 'gas', label: 'Piped Gas' },
];

export const BillPaymentScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { setUserDirect, refreshUser } = useAuth();
  const [category, setCategory] = useState<Exclude<ServiceCategory, 'mobile' | 'dth'>>(
    route.params?.initialCategory || 'electricity'
  );
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOp, setSelectedOp] = useState<Operator | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [fetchedBill, setFetchedBill] = useState<FetchedBill | null>(null);
  const [fetching, setFetching] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransactionRecord | null>(null);

  useEffect(() => {
    (async () => {
      setFetchedBill(null);
      setError(null);
      const res = await api.getOperators(category).catch(() => ({ operators: [] }));
      setOperators(res.operators);
      setSelectedOp(res.operators[0] || null);
    })();
  }, [category]);

  const handleFetchBill = async () => {
    if (!selectedOp) return;
    setError(null);
    setFetching(true);
    try {
      const res = await api.fetchBill(selectedOp.id, accountNumber.trim());
      setFetchedBill(res.bill);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to fetch bill.');
    } finally {
      setFetching(false);
    }
  };

  const handlePayBill = async () => {
    if (!fetchedBill) return;
    setError(null);
    setPaying(true);
    try {
      const res = await api.payUtilityBill({
        operatorId: fetchedBill.operatorId,
        accountNumber: fetchedBill.accountNumber,
        amount: fetchedBill.amount,
        billNumber: fetchedBill.billNumber,
      });
      setUserDirect(res.user);
      await refreshUser();
      setReceipt(res.transaction);
      setFetchedBill(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await triggerLocalPaymentNotification(
        'Utility Bill Paid',
        `₹${res.transaction.amount.toFixed(2)} paid to ${fetchedBill.operatorName}.`
      );
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {BILL_CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={[styles.catBtn, active && styles.catBtnActive]}
            >
              <Text style={[styles.catText, active && styles.catTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>Select Biller</Text>
      <View style={styles.opList}>
        {operators.map((op) => {
          const active = selectedOp?.id === op.id;
          return (
            <TouchableOpacity
              key={op.id}
              onPress={() => {
                setSelectedOp(op);
                setFetchedBill(null);
              }}
              style={[styles.opCard, active && styles.opCardActive]}
            >
              <Text style={styles.opName}>{op.name}</Text>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={active ? palette.accentPrimary : palette.inkMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedOp && (
        <View style={styles.card}>
          <Text style={styles.inputLabel}>{selectedOp.accountLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={selectedOp.accountPlaceholder}
            placeholderTextColor={palette.inkMuted}
            value={accountNumber}
            onChangeText={setAccountNumber}
          />
          <TouchableOpacity
            onPress={handleFetchBill}
            disabled={fetching}
            style={styles.fetchBtn}
          >
            {fetching ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.fetchBtnText}>Fetch Bill Details</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {fetchedBill && (
        <View style={styles.billCard}>
          <Text style={styles.billHeader}>Bill Summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billKey}>Consumer</Text>
            <Text style={styles.billVal}>{fetchedBill.consumerName}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billKey}>Bill Number</Text>
            <Text style={styles.billVal}>{fetchedBill.billNumber}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billKey}>Due Date</Text>
            <Text style={styles.billVal}>{fetchedBill.dueDate}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billKey}>Amount Due</Text>
            <Text style={styles.billAmount}>₹{fetchedBill.amount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            onPress={handlePayBill}
            disabled={paying}
            style={styles.payBtn}
          >
            {paying ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.payBtnText}>
                Pay ₹{fetchedBill.amount.toFixed(2)} Now
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={Boolean(receipt)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={48} color={palette.accentPrimary} />
            <Text style={styles.modalTitle}>Bill Paid Successfully</Text>
            <Text style={styles.modalAmount}>₹{receipt?.amount.toFixed(2)}</Text>
            <Text style={styles.modalRef}>Ref: {receipt?.referenceId}</Text>
            <TouchableOpacity onPress={() => setReceipt(null)} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Close</Text>
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
  catRow: { gap: 8, paddingBottom: 14 },
  catBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: palette.bgSurface,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    justifyContent: 'center',
  },
  catBtnActive: {
    backgroundColor: palette.inkPrimary,
    borderColor: palette.inkPrimary,
  },
  catText: { fontSize: 13, fontWeight: '600', color: palette.inkPrimary },
  catTextActive: { color: palette.white },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.inkPrimary,
    marginBottom: 8,
  },
  opList: { gap: 8, marginBottom: spacing.lg },
  opCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: palette.bgSurface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
  },
  opCardActive: { borderColor: palette.accentPrimary },
  opName: { fontSize: 14, fontWeight: '600', color: palette.inkPrimary },
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.inkSecondary,
    marginBottom: 6,
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
  fetchBtn: {
    minHeight: 48,
    backgroundColor: palette.inkPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  fetchBtnText: { color: palette.white, fontWeight: '700', fontSize: 14 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.dangerSoft,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: 12,
  },
  errorText: { fontSize: 13, color: palette.danger, flex: 1 },
  billCard: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.accentPrimary,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  billHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.inkPrimary,
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  billKey: { fontSize: 13, color: palette.inkMuted },
  billVal: { fontSize: 13, fontWeight: '600', color: palette.inkPrimary },
  billAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  payBtn: {
    minHeight: 50,
    backgroundColor: palette.accentPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  payBtnText: { color: palette.white, fontWeight: '700', fontSize: 15 },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.inkPrimary,
    marginTop: 10,
  },
  modalAmount: { fontSize: 30, fontWeight: '800', color: palette.inkPrimary, marginTop: 6 },
  modalRef: { fontSize: 12, color: palette.inkMuted, marginTop: 4 },
  modalBtn: {
    width: '100%',
    minHeight: 48,
    backgroundColor: palette.inkPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  modalBtnText: { color: palette.white, fontWeight: '700' },
});
