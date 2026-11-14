import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { api } from '../services/api';
import { palette, radii, spacing } from '../theme/tokens';
import { ServiceCategory, TransactionRecord } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const QUICK_SERVICES: {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: 'Recharge' | 'BillPayment';
  category: ServiceCategory;
}[] = [
  {
    id: 'mobile',
    label: 'Mobile',
    icon: 'phone-portrait-outline',
    color: '#059669',
    bg: '#ECFDF5',
    route: 'Recharge',
    category: 'mobile',
  },
  {
    id: 'dth',
    label: 'DTH TV',
    icon: 'tv-outline',
    color: '#0284C7',
    bg: '#F0F9FF',
    route: 'Recharge',
    category: 'dth',
  },
  {
    id: 'electricity',
    label: 'Electricity',
    icon: 'flash-outline',
    color: '#D97706',
    bg: '#FFFBEB',
    route: 'BillPayment',
    category: 'electricity',
  },
  {
    id: 'broadband',
    label: 'Broadband',
    icon: 'wifi-outline',
    color: '#4F46E5',
    bg: '#EEF2FF',
    route: 'BillPayment',
    category: 'broadband',
  },
  {
    id: 'water',
    label: 'Water',
    icon: 'water-outline',
    color: '#0891B2',
    bg: '#ECFEFF',
    route: 'BillPayment',
    category: 'water',
  },
  {
    id: 'gas',
    label: 'Piped Gas',
    icon: 'flame-outline',
    color: '#EA580C',
    bg: '#FFF7ED',
    route: 'BillPayment',
    category: 'gas',
  },
];

export const HomeScreen: React.FC = () => {
  const { user, signOut, refreshUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const [recentTxns, setRecentTxns] = useState<TransactionRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [txnRes] = await Promise.all([api.getTransactions(), refreshUser()]);
      setRecentTxns(txnRes.transactions.slice(0, 4));
    } catch {
      // handled silently
    }
  }, [refreshUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accentPrimary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.userName}>{user.fullName}</Text>
          </View>
          <View style={styles.headerActions}>
            {user.role === 'admin' && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Admin')}
                style={styles.adminChip}
              >
                <Ionicons name="shield-checkmark" size={16} color={palette.white} />
                <Text style={styles.adminChipText}>Admin</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={signOut} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={20} color={palette.inkPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <LinearGradient
          colors={[palette.navyCard, palette.navyCardEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View style={styles.walletTop}>
            <View>
              <Text style={styles.walletLabel}>PayPulse Wallet Balance</Text>
              <Text style={styles.walletAmount}>
                ₹{user.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Wallet')}
              style={styles.addMoneyBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={palette.inkPrimary} />
              <Text style={styles.addMoneyText}>Add Money</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.walletDivider} />

          <View style={styles.walletFooter}>
            <Text style={styles.walletMeta}>
              Cashback Earned: ₹{user.cashbackEarned.toFixed(2)}
            </Text>
            <Text style={styles.walletMeta}>KYC Verified</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Recharge & Bill Payments</Text>
        <View style={styles.grid}>
          {QUICK_SERVICES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.serviceTile}
              activeOpacity={0.8}
              onPress={() => {
                if (item.route === 'Recharge') {
                  navigation.navigate('Recharge', {
                    initialCategory: item.category as 'mobile' | 'dth',
                  });
                } else {
                  navigation.navigate('BillPayment', {
                    initialCategory: item.category as Exclude<
                      ServiceCategory,
                      'mobile' | 'dth'
                    >,
                  });
                }
              }}
            >
              <View style={[styles.serviceIconBox, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.serviceLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
        </View>

        {recentTxns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No transactions yet. Try a quick recharge.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {recentTxns.map((txn, idx) => {
              const isCredit = txn.type === 'WALLET_TOPUP' || txn.type === 'REFUND';
              return (
                <View
                  key={txn.id}
                  style={[
                    styles.txnRow,
                    idx < recentTxns.length - 1 && styles.txnBorder,
                  ]}
                >
                  <View style={styles.txnLeft}>
                    <View
                      style={[
                        styles.txnIcon,
                        {
                          backgroundColor: isCredit
                            ? palette.accentSoft
                            : palette.bgSubtle,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isCredit ? 'arrow-down' : 'flash-outline'}
                        size={18}
                        color={isCredit ? palette.accentPrimary : palette.inkPrimary}
                      />
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnTitle} numberOfLines={1}>
                        {txn.operatorName}
                      </Text>
                      <Text style={styles.txnSub} numberOfLines={1}>
                        {txn.accountNumber} · {txn.status}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.txnAmount,
                      { color: isCredit ? palette.accentPrimary : palette.inkPrimary },
                    ]}
                  >
                    {isCredit ? '+' : '-'}₹{txn.amount.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bgCanvas },
  container: { padding: spacing.lg, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: 13, color: palette.inkMuted },
  userName: { fontSize: 20, fontWeight: '800', color: palette.inkPrimary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.inkPrimary,
    paddingHorizontal: 12,
    minHeight: 40,
    borderRadius: radii.md,
  },
  adminChipText: { color: palette.white, fontSize: 13, fontWeight: '700' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    backgroundColor: palette.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  walletTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  walletAmount: {
    color: palette.white,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  addMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.white,
    paddingHorizontal: 14,
    minHeight: 42,
    borderRadius: radii.md,
  },
  addMoneyText: { color: palette.inkPrimary, fontWeight: '700', fontSize: 13 },
  walletDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: spacing.lg,
  },
  walletFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  walletMeta: { color: '#CBD5E1', fontSize: 12, fontWeight: '500' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.inkPrimary,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.xl,
  },
  serviceTile: {
    width: '31.3%',
    backgroundColor: palette.bgSurface,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  serviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceLabel: { fontSize: 13, fontWeight: '600', color: palette.inkPrimary },
  emptyCard: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: { color: palette.inkMuted, fontSize: 14 },
  listCard: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    paddingHorizontal: spacing.lg,
  },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  txnBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.borderHairline,
  },
  txnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnInfo: { flex: 1 },
  txnTitle: { fontSize: 14, fontWeight: '700', color: palette.inkPrimary },
  txnSub: { fontSize: 12, color: palette.inkMuted, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
