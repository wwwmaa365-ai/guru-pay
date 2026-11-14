import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AdminScreen } from '../screens/AdminScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { BillPaymentScreen } from '../screens/BillPaymentScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { RechargeScreen } from '../screens/RechargeScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { palette } from '../theme/tokens';
import { ServiceCategory } from '../types';

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  Recharge: { initialCategory?: 'mobile' | 'dth' } | undefined;
  BillPayment: { initialCategory?: Exclude<ServiceCategory, 'mobile' | 'dth'> } | undefined;
  Wallet: undefined;
  Admin: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Notifications: undefined;
  WalletTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { unreadCount } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.accentPrimary,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarStyle: {
          backgroundColor: palette.bgSurface,
          borderTopColor: palette.borderHairline,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'History') iconName = focused ? 'receipt' : 'receipt-outline';
          if (route.name === 'Notifications')
            iconName = focused ? 'notifications' : 'notifications-outline';
          if (route.name === 'WalletTab') iconName = focused ? 'wallet' : 'wallet-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="WalletTab" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: palette.accentPrimary, fontSize: 10 },
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: palette.bgCanvas,
        }}
      >
        <ActivityIndicator size="large" color={palette.accentPrimary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: palette.bgSurface },
          headerTintColor: palette.inkPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Recharge"
              component={RechargeScreen}
              options={{ title: 'Mobile & DTH Recharge' }}
            />
            <Stack.Screen
              name="BillPayment"
              component={BillPaymentScreen}
              options={{ title: 'Pay Utility Bills' }}
            />
            <Stack.Screen
              name="Wallet"
              component={WalletScreen}
              options={{ title: 'PayPulse Wallet' }}
            />
            {user.role === 'admin' && (
              <Stack.Screen
                name="Admin"
                component={AdminScreen}
                options={{ title: 'Admin Console' }}
              />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
