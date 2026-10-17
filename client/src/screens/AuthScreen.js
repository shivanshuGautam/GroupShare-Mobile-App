import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getBaseUrl, setBaseUrl, testServerConnection } from '../services/api';

export default function AuthScreen() {
  const { login, register, verifyEmail, resendVerification } = useAuth();

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Backend connection state
  const [currentServerUrl, setCurrentServerUrl] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  useEffect(() => {
    getBaseUrl().then((url) => {
      setCurrentServerUrl(url);
      setTempServerUrl(url);
    });
  }, []);

  const handleSaveServerUrl = async (urlToSave) => {
    const target = urlToSave || tempServerUrl;
    if (!target) return;
    const clean = await setBaseUrl(target);
    setCurrentServerUrl(clean);
    setTempServerUrl(clean);
    setShowServerConfig(false);
    Alert.alert('Server URL Updated', `Backend API set to:\n${clean}`);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionMessage('');
    const res = await testServerConnection(tempServerUrl);
    setTestingConnection(false);
    if (res.success) {
      setConnectionStatus('ok');
      setConnectionMessage(`✅ Connected (${res.database})`);
    } else {
      setConnectionStatus('error');
      setConnectionMessage(`❌ ${res.message}`);
    }
  };

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state (5-6 profile fields)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regJobTitle, setRegJobTitle] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regBio, setRegBio] = useState('');

  // Verification step state
  const [showVerification, setShowVerification] = useState(false);
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [devCodeHint, setDevCodeHint] = useState('');

  // Handle Login
  const handleLogin = async () => {
    setErrorMessage('');
    const cleanEmail = loginEmail.toLowerCase().trim();
    if (!cleanEmail || !loginPassword) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(cleanEmail, loginPassword);
    } catch (err) {
      if (err.message?.includes('verify') || err.message?.includes('verification')) {
        setVerifyEmailAddress(cleanEmail);
        setShowVerification(true);
      } else {
        setErrorMessage(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async () => {
    setErrorMessage('');
    const cleanEmail = regEmail.toLowerCase().trim();
    if (!regName.trim() || !cleanEmail || !regPassword) {
      setErrorMessage('Name, email, and password are required.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        name: regName.trim(),
        email: cleanEmail,
        password: regPassword,
        phone: regPhone.trim(),
        jobTitle: regJobTitle.trim() || 'Team Member',
        department: regDepartment.trim() || 'General',
        bio: regBio.trim(),
      });

      setVerifyEmailAddress(res.email || cleanEmail);
      const codeFromRes = res.verificationCode || res.debugCode || res.code;
      if (codeFromRes) {
        setDevCodeHint(codeFromRes.toString());
      }
      setVerifyCode('');
      setShowVerification(true);
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Code Verification
  const handleVerify = async () => {
    setErrorMessage('');
    const cleanCode = verifyCode.trim();
    if (!cleanCode) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyEmail(verifyEmailAddress.toLowerCase().trim(), cleanCode);
    } catch (err) {
      setErrorMessage(err.message || 'Code verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend Code
  const handleResend = async () => {
    setLoading(true);
    try {
      const res = await resendVerification(verifyEmailAddress);
      setVerifyCode('');
      const codeFromRes = res?.verificationCode || res?.debugCode || res?.code;
      if (codeFromRes) {
        setDevCodeHint(codeFromRes.toString());
      }
      Alert.alert(
        'Code Dispatched',
        `A 6-digit verification code has been dispatched to ${verifyEmailAddress}.\n${
          codeFromRes ? `(Dev Code: ${codeFromRes})` : 'Please check your email inbox and spam folder.'
        }`
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  };

  // One-tap quick login for reviewers & testing
  const handleQuickDemo = async () => {
    setLoading(true);
    try {
      await login('admin@groupshare.local', 'password123');
    } catch (err) {
      setErrorMessage(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  if (showVerification) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.verifyIconBox}>
              <Ionicons name="mail-unread" size={36} color={theme.colors.primary} />
            </View>
            <Text style={styles.appTitle}>Verify Your Email</Text>
            <Text style={styles.tagline}>
              We sent a 6-digit confirmation code to{'\n'}
              <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>
                {verifyEmailAddress}
              </Text>
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formContainer}>
            {devCodeHint ? (
              <TouchableOpacity
                style={styles.devCodeBadge}
                onPress={() => setVerifyCode(devCodeHint)}
                activeOpacity={0.7}
              >
                <Ionicons name="key" size={16} color="#4F46E5" />
                <Text style={styles.devCodeText}>
                  Dev Code: <Text style={{ fontWeight: '800' }}>{devCodeHint}</Text> (Tap to auto-fill)
                </Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.inputLabel}>Enter 6-Digit Email Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="••••••"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={verifyCode}
              onChangeText={setVerifyCode}
              autoFocus
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <View style={styles.hintBox}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.hintText}>
                Check inbox & spam. In test mode, you can check server terminal or use code 123456.
              </Text>
            </View>

            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive the email? </Text>
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <Text style={styles.resendLink}>Resend Code</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelVerifyButton}
              onPress={() => setShowVerification(false)}
            >
              <Text style={styles.cancelVerifyText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Branding */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="folder-open" size={34} color="#FFF" />
          </View>
          <Text style={styles.appTitle}>GroupShare</Text>
          <Text style={styles.tagline}>Secure Mobile Group Document Sharing</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'login' && styles.activeTab]}
            onPress={() => {
              setActiveTab('login');
              setErrorMessage('');
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'login' && styles.activeTabText,
              ]}
            >
              Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'register' && styles.activeTab]}
            onPress={() => {
              setActiveTab('register');
              setErrorMessage('');
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'register' && styles.activeTabText,
              ]}
            >
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Server Connection Bar */}
        <View style={styles.serverPill}>
          <TouchableOpacity
            style={styles.serverPillBtn}
            onPress={() => setShowServerConfig(!showServerConfig)}
            activeOpacity={0.8}
          >
            <Ionicons name="server-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.serverPillText} numberOfLines={1}>
              API: <Text style={{ fontWeight: '700' }}>{currentServerUrl || 'Detecting...'}</Text>
            </Text>
            <Ionicons
              name={showServerConfig ? 'chevron-up' : 'settings-outline'}
              size={14}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigBox}>
              <Text style={styles.serverConfigLabel}>Express Backend URL (Port 4500):</Text>
              <TextInput
                style={styles.serverConfigInput}
                value={tempServerUrl}
                onChangeText={(t) => {
                  setTempServerUrl(t);
                  setConnectionStatus('idle');
                  setConnectionMessage('');
                }}
                placeholder="http://192.168.1.X:4500"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setTempServerUrl('http://10.0.2.2:4500');
                    setConnectionStatus('idle');
                    setConnectionMessage('');
                  }}
                >
                  <Text style={styles.presetChipText}>Emulator (10.0.2.2)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => {
                    setTempServerUrl('http://localhost:4500');
                    setConnectionStatus('idle');
                    setConnectionMessage('');
                  }}
                >
                  <Text style={styles.presetChipText}>Localhost</Text>
                </TouchableOpacity>
              </View>

              {connectionMessage ? (
                <Text
                  style={[
                    styles.connStatusText,
                    connectionStatus === 'ok' ? styles.connOk : styles.connErr,
                  ]}
                >
                  {connectionMessage}
                </Text>
              ) : null}

              <View style={styles.serverActionRow}>
                <TouchableOpacity
                  style={styles.testBtn}
                  onPress={handleTestConnection}
                  disabled={testingConnection}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.testBtnText}>Test Ping</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={() => handleSaveServerUrl(tempServerUrl)}
                >
                  <Text style={styles.applyBtnText}>Apply URL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Error Alert */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Forms */}
        {activeTab === 'login' ? (
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@company.com"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
            />

            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              value={loginPassword}
              onChangeText={setLoginPassword}
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Quick Demo Button */}
            <View style={styles.demoDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>QUICK DEMO</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={handleQuickDemo}
              disabled={loading}
            >
              <Ionicons name="flash" size={16} color="#4F46E5" />
              <Text style={styles.demoButtonText}>One-Tap Demo Login (Admin)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alex Morgan"
              placeholderTextColor={theme.colors.textMuted}
              value={regName}
              onChangeText={setRegName}
            />

            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="alex@company.com"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={regEmail}
              onChangeText={setRegEmail}
            />

            <Text style={styles.inputLabel}>Password * (min 6 chars)</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              value={regPassword}
              onChangeText={setRegPassword}
            />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555-0145"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
              value={regPhone}
              onChangeText={setRegPhone}
            />

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Job Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Analyst"
                  placeholderTextColor={theme.colors.textMuted}
                  value={regJobTitle}
                  onChangeText={setRegJobTitle}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Department</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Finance"
                  placeholderTextColor={theme.colors.textMuted}
                  value={regDepartment}
                  onChangeText={setRegDepartment}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Short Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Brief summary of your role or expertise..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              value={regBio}
              onChangeText={setRegBio}
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Register & Send Code</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  tagline: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  activeTab: {
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  formContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  bioInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 14,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  demoDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    paddingHorizontal: 8,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 11,
    borderRadius: theme.borderRadius.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  demoButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerLight,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    flex: 1,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    gap: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  hintText: {
    color: theme.colors.primary,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  devCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  devCodeText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  resendText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  cancelVerifyButton: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  cancelVerifyText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  serverPill: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  serverPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  serverPillText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  serverConfigBox: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  serverConfigLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  serverConfigInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  connStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  connOk: {
    color: '#059669',
  },
  connErr: {
    color: theme.colors.danger,
  },
  serverActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
});
