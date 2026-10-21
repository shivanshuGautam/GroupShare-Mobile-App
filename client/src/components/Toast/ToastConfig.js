import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

/**
 * Custom Toast Item Renderer
 */
const CustomToastItem = ({
  iconName,
  iconColor,
  iconBgColor,
  borderColor,
  title,
  message,
  onPress,
  onClose,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[styles.toastCard, { borderLeftColor: borderColor }]}
    >
      {/* Icon Badge */}
      <View style={[styles.iconBadge, { backgroundColor: iconBgColor }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>

      {/* Text Content */}
      <View style={styles.textContainer}>
        {title ? (
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text style={styles.messageText} numberOfLines={3}>
            {message}
          </Text>
        ) : null}
      </View>

      {/* Dismiss Button */}
      {onClose ? (
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onClose}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

export const toastConfig = {
  success: ({ text1, text2, onPress, hide }) => (
    <CustomToastItem
      iconName="checkmark-circle"
      iconColor={theme.colors.success}
      iconBgColor={theme.colors.successLight}
      borderColor={theme.colors.success}
      title={text1 || 'Success'}
      message={text2}
      onPress={onPress}
      onClose={hide}
    />
  ),

  error: ({ text1, text2, onPress, hide }) => (
    <CustomToastItem
      iconName="alert-circle"
      iconColor={theme.colors.danger}
      iconBgColor={theme.colors.dangerLight}
      borderColor={theme.colors.danger}
      title={text1 || 'Error'}
      message={text2}
      onPress={onPress}
      onClose={hide}
    />
  ),

  warning: ({ text1, text2, onPress, hide }) => (
    <CustomToastItem
      iconName="warning"
      iconColor={theme.colors.warning}
      iconBgColor={theme.colors.warningLight}
      borderColor={theme.colors.warning}
      title={text1 || 'Attention'}
      message={text2}
      onPress={onPress}
      onClose={hide}
    />
  ),

  info: ({ text1, text2, onPress, hide }) => (
    <CustomToastItem
      iconName="information-circle"
      iconColor={theme.colors.primary}
      iconBgColor={theme.colors.primaryLight}
      borderColor={theme.colors.primary}
      title={text1 || 'Information'}
      message={text2}
      onPress={onPress}
      onClose={hide}
    />
  ),
};

const styles = StyleSheet.create({
  toastCard: {
    width: '100%',
    minHeight: 58,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderTopColor: theme.colors.border,
    borderRightColor: theme.colors.border,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 6,
  },
  titleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 2,
  },
});
