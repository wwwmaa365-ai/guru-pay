import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { palette, radii, spacing } from '../theme/tokens';
import { AppNotification } from '../types';

export const NotificationsScreen: React.FC = () => {
  const { setUnreadCount } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setItems(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // handled silently
    }
  }, [setUnreadCount]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id).catch(() => undefined);
    await load();
  };

  const handleMarkAll = async () => {
    await api.markAllNotificationsRead().catch(() => undefined);
    await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAll} style={styles.markAllBtn}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
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
            <Text style={styles.emptyText}>No alerts right now.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleMarkRead(item.id)}
            style={[styles.card, !item.read && styles.cardUnread]}
            activeOpacity={0.85}
          >
            <View style={styles.iconBox}>
              <Ionicons
                name={
                  item.category === 'promo'
                    ? 'megaphone-outline'
                    : item.category === 'wallet'
                      ? 'wallet-outline'
                      : 'notifications-outline'
                }
                size={20}
                color={item.read ? palette.inkMuted : palette.accentPrimary}
              />
            </View>
            <View style={styles.bodyCol}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody}>{item.body}</Text>
              <Text style={styles.itemMeta}>
                {item.category.toUpperCase()} · {item.read ? 'Read' : 'Unread'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bgCanvas },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: palette.inkPrimary },
  markAllBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  markAllText: { fontSize: 13, fontWeight: '700', color: palette.accentPrimary },
  listContent: { padding: spacing.lg, gap: 10 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
  },
  cardUnread: {
    borderColor: palette.accentPrimary,
    backgroundColor: palette.accentSoft,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyCol: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: palette.inkPrimary },
  itemBody: { fontSize: 13, color: palette.inkSecondary, marginTop: 4, lineHeight: 18 },
  itemMeta: { fontSize: 11, color: palette.inkMuted, marginTop: 8 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: palette.inkMuted },
});
