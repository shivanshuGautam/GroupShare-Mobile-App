import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function PendingInvitationBanner({ count, onPress }) {
  if (!count || count <= 0) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="mail-unread" size={20} color="#FFF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {count === 1 ? '1 Pending Group Invitation' : `${count} Pending Group Invitations`}
        </Text>
        <Text style={styles.subtitle}>Tap here to view and accept your workspace invitation</Text>
      </View>
      <View style={styles.arrowBox}>
        <Ionicons name="chevron-forward" size={18} color="#4F46E5" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#312E81',
  },
  subtitle: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 2,
  },
  arrowBox: {
    marginLeft: 8,
  },
});
