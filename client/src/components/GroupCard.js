import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function GroupCard({ group, onPress }) {
  const isAdmin = group.myRole === 'admin';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(group)}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{group.category || 'General'}</Text>
        </View>

        <View
          style={[
            styles.roleBadge,
            isAdmin ? styles.adminBadge : styles.memberBadge,
          ]}
        >
          <Ionicons
            name={isAdmin ? 'shield-checkmark' : 'person'}
            size={12}
            color={isAdmin ? '#B45309' : '#4338CA'}
          />
          <Text
            style={[
              styles.roleText,
              isAdmin ? styles.adminText : styles.memberText,
            ]}
          >
            {isAdmin ? 'Admin' : 'Member'}
          </Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {group.name}
      </Text>

      {group.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {group.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.memberCount}>
          <Ionicons name="people-outline" size={15} color={theme.colors.textSecondary} />
          <Text style={styles.memberCountText}>
            {group.memberCount || 1} {group.memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>

        <View style={styles.arrowIcon}>
          <Text style={styles.viewText}>Open</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  categoryBadge: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  adminBadge: {
    backgroundColor: theme.colors.warningLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  memberBadge: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminText: {
    color: '#B45309',
  },
  memberText: {
    color: '#4338CA',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 6,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceSubtle,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  memberCountText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  arrowIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});
