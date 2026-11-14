import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { palette, radii, spacing } from '../theme/tokens';
import { TransactionRecord } from '../types';

export const HistoryScreen: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'RECHARGE' | 'BILL_PAY' | 'WALLET_TOPUP'>(
    'ALL'
  );
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<TransactionRecord | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getTransactions();
      setTransactions(res.transactions);
    } catch {
      // handled silently
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered =
    filter === 'ALL' ? transactions : transactions.filter((t) => t.type === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
        <View style={styles.filterRow}>
          {(['ALL', 'RECHARGE', 'BILL_PAY', 'WALLET_TOPUP'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            >
              <Text
                style={[styles.filterText, filter === f && styles.filterTextActive]}
              >
                {f === 'ALL'
                  ? 'All'
                  : f === 'RECHARGE'
                    ? 'Recharge'
                    : f === 'BILL_PAY'
                      ? 'Bills'
                      : 'Top-Up'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accentPrimary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions match this filter.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isCredit = item.type === 'WALLET_TOPUP' || item.type === 'REFUND';
          return (
            <TouchableOpacity
              onPress={() => setSelected(item)}
              style={styles.rowCard}
              activeOpacity={0.85}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{item.operatorName}</Text>
                <Text style={styles.rowMeta}>
                  {item.accountNumber} · {item.status} · {item.referenceId}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  { color: isCredit ? palette.accentPrimary : palette.inkPrimary },
                ]}
              >
                {isCredit ? '+' : '-'}₹{item.amount.toFixed(2)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={Boolean(selected)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receipt Details</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={palette.inkPrimary} />
              </TouchableOpacity>
            </View>
            {selected && (
              <>
                <Text style={styles.receiptAmt}>₹{selected.amount.toFixed(2)}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Reference</Text>
                  <Text style={styles.detailVal}>{selected.referenceId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Operator</Text>
                  <Text style={styles.detailVal}>{selected.operatorName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Account</Text>
                  <Text style={styles.detailVal}>{selected.accountNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Status</Text>
                  <Text style={styles.detailVal}>{selected.status}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Cashback</Text>
                  <Text style={styles.detailVal}>₹{selected.cashback.toFixed(2)}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bgCanvas },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: palette.inkPrimary, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: palette.bgSurface,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: palette.inkPrimary,
    borderColor: palette.inkPrimary,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: palette.inkSecondary },
  filterTextActive: { color: palette.white },
  listContent: { padding: spacing.lg, gap: 10 },
  rowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
  },
  rowLeft: { flex: 1, marginRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: palette.inkPrimary },
  rowMeta: { fontSize: 12, color: palette.inkMuted, marginTop: 4 },
  rowAmount: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: palette.inkMuted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: palette.inkPrimary },
  receiptAmt: {
    fontSize: 30,
    fontWeight: '800',
    color: palette.inkPrimary,
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: palette.borderHairline,
  },
  detailKey: { fontSize: 13, color: palette.inkMuted },
  detailVal: { fontSize: 13, fontWeight: '600', color: palette.inkPrimary },
});
