import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { palette, radii, spacing } from '../theme/tokens';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : 'Unable to authenticate.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (role: 'user' | 'admin') => {
    setMode('login');
    setError(null);
    if (role === 'admin') {
      setEmail('admin@paypulse.app');
      setPassword('Admin@2026');
    } else {
      setEmail('user@paypulse.app');
      setPassword('PayPulse@2026');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandBlock}>
            <View style={styles.logoMark}>
              <Ionicons name="flash" size={24} color={palette.white} />
            </View>
            <Text style={styles.brandTitle}>PayPulse</Text>
            <Text style={styles.brandSubtitle}>
              Instant mobile recharge, DTH & utility bill payments
            </Text>
          </View>

          <View style={styles.segmentWrap}>
            <TouchableOpacity
              onPress={() => {
                setMode('login');
                setError(null);
              }}
              style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]}
            >
              <Text
                style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMode('register');
                setError(null);
              }}
              style={[styles.segmentBtn, mode === 'register' && styles.segmentBtnActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'register' && styles.segmentTextActive,
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {mode === 'register' && (
              <>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Aarav Mehta"
                  placeholderTextColor={palette.inkMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
                <Text style={styles.label}>Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={palette.inkMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </>
            )}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor={palette.inkMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Minimum 6 characters"
                placeholderTextColor={palette.inkMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={palette.inkMuted}
                />
              </TouchableOpacity>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={palette.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.primaryBtn, submitting && styles.btnDisabled]}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'login' ? 'Sign In Securely' : 'Create PayPulse Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Quick Test Credentials</Text>
            <View style={styles.demoActions}>
              <TouchableOpacity
                onPress={() => fillDemo('user')}
                style={styles.demoBtn}
              >
                <Text style={styles.demoBtnText}>Customer Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => fillDemo('admin')}
                style={styles.demoBtn}
              >
                <Text style={styles.demoBtnText}>Admin Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bgCanvas },
  flex: { flex: 1 },
  container: { padding: spacing.xl, justifyContent: 'center', flexGrow: 1 },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: palette.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brandTitle: { fontSize: 26, fontWeight: '800', color: palette.inkPrimary },
  brandSubtitle: {
    fontSize: 14,
    color: palette.inkMuted,
    marginTop: 4,
    textAlign: 'center',
  },
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
  segmentBtnActive: {
    backgroundColor: palette.bgSurface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: palette.inkMuted },
  segmentTextActive: { color: palette.inkPrimary },
  card: {
    backgroundColor: palette.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    padding: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.inkSecondary,
    marginBottom: 6,
    marginTop: 10,
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
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  eyeBtn: { position: 'absolute', right: 14 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.dangerSoft,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: 14,
  },
  errorText: { fontSize: 13, color: palette.danger, flex: 1 },
  primaryBtn: {
    minHeight: 50,
    backgroundColor: palette.accentPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: palette.white, fontSize: 15, fontWeight: '700' },
  demoBox: { marginTop: spacing.xl, alignItems: 'center' },
  demoTitle: { fontSize: 12, color: palette.inkMuted, marginBottom: 8 },
  demoActions: { flexDirection: 'row', gap: 10 },
  demoBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderHairline,
    backgroundColor: palette.bgSurface,
    justifyContent: 'center',
  },
  demoBtnText: { fontSize: 13, fontWeight: '600', color: palette.inkPrimary },
});
