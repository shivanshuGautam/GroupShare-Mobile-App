import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  LogBox,
} from 'react-native';
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
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/components/Toast/ToastConfig';

function MainApp() {
  const { user, isLoading, unreadCount } = useAuth();
  const [currentTab, setCurrentTab] = useState('groups'); // 'groups' | 'notifications' | 'profile'
  const [selectedGroup, setSelectedGroup] = useState(null);

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
          onBack={() => setSelectedGroup(null)}
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

      {/* Screen Body */}
      <View style={styles.body}>
        {currentTab === 'groups' && (
          <GroupsScreen onSelectGroup={(group) => setSelectedGroup(group)} />
        )}
        {currentTab === 'notifications' && <NotificationsScreen />}
        {currentTab === 'profile' && <ProfileScreen />}
      </View>

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
      <MainApp />
      <Toast config={toastConfig} />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
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
