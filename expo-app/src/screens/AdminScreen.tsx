import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { palette, radii, spacing } from '../theme/tokens';
import { AdminOverview, TransactionStatus } from '../types';

export const AdminScreen: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getAdminOverview();
      setOverview(res);
    } finally {
      setLoading(false);
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

  const handleStatusUpdate = async (id: string, status: TransactionStatus) => {
    await api.updateTransactionStatus(id, status);
    await load();
  };

  const handleToggleOperator = async (id: string) => {
    await api.toggleOperator(id);
    await load();
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    await api.broadcastNotification({
      title: broadcastTitle.trim(),
      body: broadcastBody.trim(),
      category: 'system',
    });
    setBroadcastTitle('');
    setBroadcastBody('');
    setFeedback('Broadcast notification delivered to all users.');
  };

  if (loading || !overview) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.accentPrimary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Gross Volume</Text>
          <Text style={styles.kpiValue}>
            ₹{overview.metrics.grossVolume.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Commission</Text>
          <Text style={styles.kpiValue}>
            ₹{overview.metrics.totalCommission.toFixed(2)}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Success Rate</Text>
          <Text style={styles.kpiValue}>{overview.metrics.successRate}%</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending Orders</Text>
          <Text style={styles.kpiValue}>{overview.metrics.pendingCount}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Broadcast Alert</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Alert title"
          placeholderTextColor={palette.inkMuted}
          value={broadcastTitle}
          onChangeText={setBroadcastTitle}
        />
        <TextInput
          style={[styles.input, { minHeight: 74, textAlignVertical: 'top', paddingTop: 12 }]}
          placeholder="Announcement message for all mobile users"
          placeholderTextColor={palette.inkMuted}
          value={broadcastBody}
          onChangeText={setBroadcastBody}
          multiline
        />
        {feedback && <Text style={styles.feedbackText}>{feedback}</Text>}
        <TouchableOpacity onPress={handleBroadcast} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Send Broadcast</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Transaction Moderation</Text>
      {overview.transactions.slice(0, 8).map((txn) => (
        <View key={txn.id} style={styles.txnCard}>
          <View style={styles.txnTop}>
            <Text style={styles.txnTitle}>
              {txn.operatorName} · ₹{txn.amount.toFixed(2)}
            </Text>
            <Text style={styles.txnStatus}>{txn.status}</Text>
          </View>
          <Text style={styles.txnMeta}>
            {txn.userName} · {txn.referenceId}
          </Text>
          {txn.status === 'PENDING' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => handleStatusUpdate(txn.id, 'SUCCESS')}
                style={[styles.smallBtn, { backgroundColor: palette.accentPrimary }]}
              >
                <Text style={styles.smallBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleStatusUpdate(txn.id, 'REFUNDED')}
                style={[styles.smallBtn, { backgroundColor: palette.danger }]}
              >
                <Text style={styles.smallBtnText}>Refund</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Operator Gateways</Text>
      <View style={styles.card}>
        {overview.operators.map((op) => (
          <View key={op.id} style={styles.opRow}>
            <View>
              <Text style={styles.opName}>{op.name}</Text>
              <Text style={styles.opMeta}>
                {op.category.toUpperCase()} · Margin {(op.commissionRate * 100).toFixed(1)}%
              </Text>
            </View>
            <Switch
              value={op.active}
              onValueChange={() => handleToggleOperator(op.id)}
              trackColor={{ false: '#CBD5E1', true: '#6EE7B7' }}
              thumbColor={op.active ? palette.accentPrimary : '#F1F5F9'}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, backgroundColor: palette.bgCanvas },
  container: { padding: spacing.lg, paddingBottom: 40 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.xl },
  kpiCard: {
    width: '48.3%',
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
  },
  kpiLabel: { fontSize: 12, color: palette.inkMuted },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.inkPrimary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.inkPrimary,
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: 10,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: palette.inkPrimary,
    backgroundColor: palette.bgCanvas,
  },
  feedbackText: { fontSize: 13, color: palette.accentPrimary, fontWeight: '600' },
  primaryBtn: {
    minHeight: 46,
    backgroundColor: palette.inkPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: palette.white, fontWeight: '700', fontSize: 14 },
  txnCard: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
    marginBottom: 10,
  },
  txnTop: { flexDirection: 'row', justifyContent: 'space-between' },
  txnTitle: { fontSize: 14, fontWeight: '700', color: palette.inkPrimary },
  txnStatus: { fontSize: 12, fontWeight: '700', color: palette.inkMuted },
  txnMeta: { fontSize: 12, color: palette.inkMuted, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  smallBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { color: palette.white, fontWeight: '700', fontSize: 13 },
  opRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  opName: { fontSize: 14, fontWeight: '600', color: palette.inkPrimary },
  opMeta: { fontSize: 12, color: palette.inkMuted, marginTop: 2 },
});
