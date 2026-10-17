import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function NotificationCard({ notification, onPress }) {
  const isDoc = notification.type === 'doc_uploaded';

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        !notification.isRead && styles.unreadCard,
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          isDoc ? styles.docIconBg : styles.inviteIconBg,
        ]}
      >
        <Ionicons
          name={isDoc ? 'cloud-upload' : 'mail'}
          size={20}
          color={isDoc ? theme.colors.primary : theme.colors.accent}
        />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.time}>{formatTime(notification.createdAt)}</Text>
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>

        {notification.groupName ? (
          <View style={styles.groupTag}>
            <Ionicons name="folder-outline" size={11} color={theme.colors.textMuted} />
            <Text style={styles.groupTagText}>{notification.groupName}</Text>
          </View>
        ) : null}
      </View>

      {!notification.isRead ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unreadCard: {
    backgroundColor: '#F8FAFF',
    borderColor: '#C7D2FE',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  docIconBg: {
    backgroundColor: theme.colors.primaryLight,
  },
  inviteIconBg: {
    backgroundColor: '#E0F2FE',
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  time: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  message: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  groupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginLeft: theme.spacing.xs,
    marginTop: 4,
  },
});
