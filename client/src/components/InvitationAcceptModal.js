import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function InvitationAcceptModal({
  visible,
  invitation,
  currentUserEmail,
  onAccept,
  onDecline,
  onClose,
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!invitation) return null;

  const isEmailMatch =
    !currentUserEmail ||
    !invitation.email ||
    currentUserEmail.toLowerCase().trim() === invitation.email.toLowerCase().trim();

  const isExpired =
    invitation.isExpired ||
    invitation.status === 'expired' ||
    (invitation.expiresAt && new Date() > new Date(invitation.expiresAt));

  const isCancelled = invitation.status === 'cancelled';
  const isAccepted = invitation.status === 'accepted';

  const canAccept = isEmailMatch && !isExpired && !isCancelled && !isAccepted;

  const handleAcceptPress = async () => {
    if (!canAccept || submitting) return;
    setSubmitting(true);
    try {
      await onAccept(invitation.id || invitation._id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclinePress = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onDecline(invitation.id || invitation._id);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-open" size={28} color={theme.colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Group Info Box */}
          <View style={styles.content}>
            <Text style={styles.title}>Group Invitation</Text>
            <Text style={styles.subtitle}>
              You have been invited to collaborate in a workspace.
            </Text>

            <View style={styles.groupInfoBox}>
              <View style={styles.groupBadge}>
                <Ionicons name="folder" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.groupName}>{invitation.groupName || 'Workspace'}</Text>
                <Text style={styles.groupCategory}>{invitation.groupCategory || 'General'} Team</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Invited By</Text>
                <Text style={styles.metaValue}>{invitation.inviterName || 'Team Admin'}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Expires</Text>
                <Text style={styles.metaValue}>{formatDate(invitation.expiresAt)}</Text>
              </View>
            </View>

            {/* Status alerts */}
            {!isEmailMatch ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.warningText}>
                  This invitation was sent to <Text style={{ fontWeight: '700' }}>{invitation.email}</Text>. Please log in with that account to accept.
                </Text>
              </View>
            ) : isExpired ? (
              <View style={styles.warningBox}>
                <Ionicons name="time" size={18} color="#DC2626" />
                <Text style={styles.warningText}>
                  This invitation has expired. Please ask the group administrator to resend an invitation.
                </Text>
              </View>
            ) : isCancelled ? (
              <View style={styles.warningBox}>
                <Ionicons name="close-circle" size={18} color="#DC2626" />
                <Text style={styles.warningText}>
                  This invitation was cancelled by the group administrator.
                </Text>
              </View>
            ) : isAccepted ? (
              <View style={[styles.warningBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={[styles.warningText, { color: '#065F46' }]}>
                  You have already accepted this invitation.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {canAccept ? (
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAcceptPress}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.acceptButtonText}>Accept & Join Group</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            {onDecline && canAccept ? (
              <TouchableOpacity
                style={styles.declineButton}
                onPress={handleDeclinePress}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.declineButtonText}>Decline Invitation</Text>
              </TouchableOpacity>
            ) : null}

            {!canAccept ? (
              <TouchableOpacity style={styles.dismissButton} onPress={onClose}>
                <Text style={styles.dismissButtonText}>Close</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 18,
  },
  groupInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  groupBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginTop: 6,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  declineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
  },
  declineButtonText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
  },
  dismissButtonText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 14,
  },
});
