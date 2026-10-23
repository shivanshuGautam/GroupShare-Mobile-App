import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  LogBox,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

LogBox.ignoreLogs(['Response.blob() is using React Native']);

import { theme } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import Header from './src/components/Header';
import AuthScreen from './src/screens/AuthScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import GroupDetailsScreen from './src/screens/GroupDetailsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import InvitationAcceptModal from './src/components/InvitationAcceptModal';
import PendingInvitationBanner from './src/components/PendingInvitationBanner';
import { invitationsApi } from './src/services/api';
import showToast from './src/services/toast';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/components/Toast/ToastConfig';

function MainApp() {
  const { user, isLoading, unreadCount } = useAuth();
  const [currentTab, setCurrentTab] = useState('groups'); // 'groups' | 'notifications' | 'profile'
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Invitation handling
  const [userInvitations, setUserInvitations] = useState([]);
  const [activeInviteModal, setActiveInviteModal] = useState(null);
  const [groupsRefreshKey, setGroupsRefreshKey] = useState(0);

  // Load user pending invitations
  const loadUserInvitations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await invitationsApi.getUserPendingInvitations();
      if (res.invitations) {
        setUserInvitations(res.invitations);
      }
    } catch (e) {
      // ignore
    }
  }, [user]);

  // Deep Link Handling
  const handleDeepLinkUrl = useCallback(
    async (url) => {
      if (!url) return;
      try {
        let token = null;
        if (url.includes('/invite/')) {
          const parts = url.split('/invite/');
          if (parts[1]) token = parts[1].split('?')[0].split('#')[0].split('/')[0];
        } else if (url.includes('token=')) {
          const match = url.match(/[?&]token=([^&]+)/);
          if (match) token = match[1];
        }

        if (token) {
          await AsyncStorage.setItem('@groupshare_pending_invite', token.trim());
          const invRes = await invitationsApi.getInvitationByToken(token.trim());
          if (invRes.invitation) {
            setActiveInviteModal(invRes.invitation);
          }
        }
      } catch (err) {
        if (__DEV__) {
          console.log('[DeepLink] Parse error:', err);
        }
      }
    },
    []
  );

  useEffect(() => {
    // Initial deep link check on app startup
    Linking.getInitialURL().then(handleDeepLinkUrl);
    const sub = Linking.addEventListener('url', (event) => handleDeepLinkUrl(event.url));
    return () => sub?.remove?.();
  }, [handleDeepLinkUrl]);

  // Check pending invites when user is authenticated
  useEffect(() => {
    if (user) {
      loadUserInvitations();

      // Check if there was a preserved deep link invite token
      AsyncStorage.getItem('@groupshare_pending_invite').then(async (savedToken) => {
        if (savedToken) {
          try {
            const res = await invitationsApi.getInvitationByToken(savedToken.trim());
            if (res.invitation) {
              setActiveInviteModal(res.invitation);
            }
          } catch (_) {
            await AsyncStorage.removeItem('@groupshare_pending_invite');
          }
        }
      });
    }
  }, [user, loadUserInvitations]);

  // Accept Invitation Handler
  const handleAcceptInvitation = async (invitationId) => {
    try {
      const res = await invitationsApi.acceptInvitation(invitationId);
      await AsyncStorage.removeItem('@groupshare_pending_invite');
      setActiveInviteModal(null);
      showToast.success('Workspace Joined', res.message || 'You joined the group successfully!');
      loadUserInvitations();
      if (res.group) {
        setSelectedGroup(res.group);
      }
    } catch (err) {
      showToast.error('Join Error', err);
    }
  };

  // Decline Invitation Handler
  const handleDeclineInvitation = async (invitationId) => {
    try {
      await invitationsApi.declineInvitation(invitationId);
      await AsyncStorage.removeItem('@groupshare_pending_invite');
      setActiveInviteModal(null);
      showToast.info('Invitation Dismissed', 'The invitation was declined.');
      loadUserInvitations();
    } catch (err) {
      showToast.error('Action Failed', err);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoBadge}>
          <Ionicons name="folder-open" size={40} color="#FFF" />
        </View>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Starting GroupShare...</Text>
      </View>
    );
  }

  // Not logged in -> Show Authentication Flow
  if (!user) {
    return (
      <View style={styles.safeArea}>
        <StatusBar style="dark" />
        <AuthScreen />
        {/* If user clicked deep link while logged out, show preview modal or preserve token */}
        {activeInviteModal ? (
          <InvitationAcceptModal
            visible={!!activeInviteModal}
            invitation={activeInviteModal}
            currentUserEmail={null}
            onAccept={() => {
              showToast.info('Account Required', 'Please register or log in with the invited email to join.');
            }}
            onClose={() => setActiveInviteModal(null)}
          />
        ) : null}
      </View>
    );
  }

  // If viewing a specific group's documents & members
  if (selectedGroup) {
    return (
      <View style={styles.safeArea}>
        <StatusBar style="dark" />
        <GroupDetailsScreen
          group={selectedGroup}
          onBack={() => {
            setSelectedGroup(null);
            setGroupsRefreshKey((prev) => prev + 1);
            loadUserInvitations();
          }}
        />
      </View>
    );
  }

  // Header Title mapping
  const getHeaderTitle = () => {
    switch (currentTab) {
      case 'groups':
        return 'Workspaces';
      case 'notifications':
        return 'Activity Alerts';
      case 'profile':
        return 'Account & Profile';
      default:
        return 'GroupShare';
    }
  };

  const getHeaderSubtitle = () => {
    switch (currentTab) {
      case 'groups':
        return 'Document sharing groups';
      case 'notifications':
        return `${unreadCount} unread updates`;
      case 'profile':
        return user.email;
      default:
        return '';
    }
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* Global App Header */}
      <Header
        title={getHeaderTitle()}
        subtitle={getHeaderSubtitle()}
        onOpenNotifications={() => setCurrentTab('notifications')}
        onOpenProfile={() => setCurrentTab('profile')}
      />

      {/* Pending Invitation Alert Banner */}
      {userInvitations && userInvitations.length > 0 && currentTab !== 'profile' ? (
        <PendingInvitationBanner
          count={userInvitations.length}
          onPress={() => setActiveInviteModal(userInvitations[0])}
        />
      ) : null}

      {/* Screen Body */}
      <View style={styles.body}>
        {currentTab === 'groups' && (
          <GroupsScreen
            key={groupsRefreshKey}
            onSelectGroup={(group) => setSelectedGroup(group)}
          />
        )}
        {currentTab === 'notifications' && <NotificationsScreen />}
        {currentTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Invitation Accept Modal */}
      <InvitationAcceptModal
        visible={!!activeInviteModal}
        invitation={activeInviteModal}
        currentUserEmail={user?.email}
        onAccept={handleAcceptInvitation}
        onDecline={handleDeclineInvitation}
        onClose={() => setActiveInviteModal(null)}
      />

      {/* Sleek Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('groups')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentTab === 'groups' ? 'folder' : 'folder-outline'}
            size={22}
            color={currentTab === 'groups' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'groups' && styles.navLabelActive,
            ]}
          >
            Groups
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('notifications')}
          activeOpacity={0.7}
        >
          <View style={styles.iconWithBadge}>
            <Ionicons
              name={currentTab === 'notifications' ? 'notifications' : 'notifications-outline'}
              size={22}
              color={currentTab === 'notifications' ? theme.colors.primary : theme.colors.textMuted}
            />
            {unreadCount > 0 ? (
              <View style={styles.navBadge}>
                <Text style={styles.navBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[
              styles.navLabel,
              currentTab === 'notifications' && styles.navLabelActive,
            ]}
          >
            Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('profile')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={currentTab === 'profile' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'profile' && styles.navLabelActive,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <View style={styles.outerContainer}>
        <View style={styles.appContainer}>
          <MainApp />
          <Toast config={toastConfig} />
        </View>
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#F1F5F9' : theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    backgroundColor: theme.colors.surface,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
  },
  body: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  bottomBar: {
    height: 60,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 6,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  navLabelActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  iconWithBadge: {
    position: 'relative',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: theme.colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  navBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
