import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getBaseUrl, setBaseUrl } from '../services/api';
import showToast from '../services/toast';
import { readAssetAsBase64, isUserCancellation } from '../utils/fileUtils';

export default function ProfileScreen() {
  const { user, updateProfile, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // 5-6 Profile Fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || 'Team Member');
  const [department, setDepartment] = useState(user?.department || 'General');
  const [bio, setBio] = useState(user?.bio || '');

  // Server URL settings
  const [serverUrl, setServerUrlState] = useState('');
  const [isEditingServer, setIsEditingServer] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setJobTitle(user.jobTitle || 'Team Member');
      setDepartment(user.department || 'General');
      setBio(user.bio || '');
    }
    const loadUrl = async () => {
      const url = await getBaseUrl();
      setServerUrlState(url);
    };
    loadUrl();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast.warning('Required Field', 'Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        department: department.trim(),
        bio: bio.trim(),
      });
      setIsEditing(false);
      showToast.success('Profile Updated', 'Profile updated successfully!');
    } catch (err) {
      showToast.error('Update Failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/*'],
        copyToCacheDirectory: true,
      });

      // Handle user cancellation silently (Requirement 8)
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      if (!file?.uri) {
        showToast.error('Photo Selection', "Couldn't select photo. Please try again.");
        return;
      }

      setUploadingPhoto(true);

      // Robust cross-platform base64 file reading (handles Android content://, SAF, and iOS file://)
      const { dataUri } = await readAssetAsBase64(file);

      await updateProfile({ avatar: dataUri });
      showToast.success('Photo Updated', 'Profile photo updated successfully!');
    } catch (err) {
      // Diagnostic in dev console without triggering LogBox overlay
      if (__DEV__) {
        console.log('[ProfileScreen] Photo pick/upload error:', err);
      }

      // If user intentional cancellation, do not show error popup
      if (!isUserCancellation(err)) {
        showToast.error('Photo Selection', "Couldn't select photo. Please try again.");
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingPhoto(true);
              await updateProfile({ avatar: '' });
              showToast.success('Photo Removed', 'Profile photo removed.');
            } catch (err) {
              showToast.error('Error', 'Could not remove photo. Please try again.');
            } finally {
              setUploadingPhoto(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrl.trim()) return;
    try {
      const clean = await setBaseUrl(serverUrl.trim());
      setServerUrlState(clean);
      setIsEditingServer(false);
      showToast.success('Server URL Updated', `API endpoint set to: ${clean}`);
    } catch (err) {
      showToast.error('URL Error', err);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of GroupShare?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card Header with Photo */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {(user?.name || 'U').substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.8}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="camera" size={15} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Photo Action Buttons */}
          <View style={styles.photoActionRow}>
            <TouchableOpacity
              style={styles.photoActionBtn}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
            >
              <Ionicons name="image-outline" size={13} color={theme.colors.primary} />
              <Text style={styles.photoActionText}>
                {user?.avatar ? 'Change Photo' : 'Upload Photo'}
              </Text>
            </TouchableOpacity>

            {user?.avatar ? (
              <TouchableOpacity
                style={[styles.photoActionBtn, styles.photoRemoveBtn]}
                onPress={handleRemovePhoto}
                disabled={uploadingPhoto}
              >
                <Ionicons name="trash-outline" size={13} color={theme.colors.danger} />
                <Text style={[styles.photoActionText, { color: theme.colors.danger }]}>
                  Remove Photo
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.profileName}>{user?.name || 'User Profile'}</Text>
          <Text style={styles.profileEmailSub}>{user?.email || ''}</Text>
          <View style={styles.verifiedChip}>
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
            <Text style={styles.verifiedChipText}>Verified Account</Text>
          </View>
        </View>

        {/* 6 Basic Profile Fields */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Profile Details</Text>
            <TouchableOpacity
              onPress={() => {
                if (isEditing) {
                  // Cancel edits
                  setName(user?.name || '');
                  setPhone(user?.phone || '');
                  setJobTitle(user?.jobTitle || 'Team Member');
                  setDepartment(user?.department || 'General');
                  setBio(user?.bio || '');
                  setIsEditing(false);
                } else {
                  setIsEditing(true);
                }
              }}
            >
              <Text style={styles.editToggleText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          {/* 1. Full Name */}
          <Text style={styles.fieldLabel}>Full Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.name || 'Not provided'}</Text>
          )}

          {/* 2. Email Address (Non-editable for identity integrity) */}
          <Text style={styles.fieldLabel}>Email Address</Text>
          <View style={styles.emailRow}>
            <Text style={styles.fieldValue}>{user?.email || 'user@example.com'}</Text>
            <Ionicons name="shield-checkmark" size={16} color={theme.colors.success} />
          </View>

          {/* 3. Phone Number */}
          <Text style={styles.fieldLabel}>Phone Number</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555-0100"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.phone || 'None added'}</Text>
          )}

          {/* 4. Job Title */}
          <Text style={styles.fieldLabel}>Job Title / Role</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholder="e.g. Lead Engineer"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.jobTitle || 'Member'}</Text>
          )}

          {/* 5. Department */}
          <Text style={styles.fieldLabel}>Department</Text>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={department}
              onChangeText={setDepartment}
              placeholder="e.g. Engineering"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.department || 'General'}</Text>
          )}

          {/* 6. Bio / Summary */}
          <Text style={styles.fieldLabel}>Bio</Text>
          {isEditing ? (
            <TextInput
              style={[styles.fieldInput, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="A brief bio..."
              multiline
              numberOfLines={3}
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.bio || 'No bio written yet.'}</Text>
          )}

          {isEditing ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Server & Connectivity Settings */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Backend Connection</Text>
          <Text style={styles.settingsSub}>
            Configure the Express backend API address for Android emulators or physical devices.
          </Text>

          {isEditingServer ? (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={styles.fieldInput}
                value={serverUrl}
                onChangeText={setServerUrlState}
                placeholder="http://10.0.2.2:4500"
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.saveButton, { flex: 1 }]}
                  onPress={handleSaveServerUrl}
                >
                  <Text style={styles.saveButtonText}>Apply URL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtn, { flex: 1 }]}
                  onPress={() => setIsEditingServer(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.serverRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serverUrlText} numberOfLines={1}>
                  {serverUrl}
                </Text>
                <Text style={styles.serverHint}>
                  {Platform.OS === 'android' ? 'Default: 10.0.2.2:4500 (Android Emulator)' : 'Default: localhost:4500'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditingServer(true)}
                style={styles.editServerBtn}
              >
                <Ionicons name="settings-outline" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
    padding: theme.spacing.md,
    paddingBottom: 30,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarFallbackText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  photoRemoveBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  photoActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  profileEmailSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 6,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    gap: 4,
  },
  verifiedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.success,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  editToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    paddingVertical: 2,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  bioInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  settingsSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
    lineHeight: 16,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  serverUrlText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  serverHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  editServerBtn: {
    padding: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dangerLight,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  logoutButtonText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
