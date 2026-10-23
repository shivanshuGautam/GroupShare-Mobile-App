import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DocumentCard({
  doc,
  onOpen,
  onDelete,
  onDeleteForMe,
  onDeleteForEveryone,
  baseUrl = '',
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Format file size
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Check if file is an image
  const isImageFile = (mimeType, originalName = '', fileName = '') => {
    const ext = (originalName || fileName).split('.').pop().toLowerCase();
    return (
      mimeType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)
    );
  };

  const isImage = isImageFile(doc.mimeType, doc.originalName, doc.fileName);

  // Determine full URL for the image
  const getFullImageUrl = () => {
    if (doc.fileUrl) {
      if (doc.fileUrl.startsWith('http://') || doc.fileUrl.startsWith('https://')) {
        return doc.fileUrl;
      }
      return `${baseUrl}${doc.fileUrl}`;
    }
    if (doc.fileName) {
      return `${baseUrl}/uploads/${doc.fileName}`;
    }
    return '';
  };

  const imageUrl = getFullImageUrl();

  // Get file type styling and label
  const getFileMeta = (mimeType, originalName = '') => {
    const ext = originalName.split('.').pop().toLowerCase();
    if (mimeType?.includes('pdf') || ext === 'pdf') {
      return { label: 'PDF', color: '#DC2626', icon: 'document-text', bgColor: '#FEF2F2' };
    }
    if (
      mimeType?.includes('word') ||
      mimeType?.includes('officedocument') ||
      ext === 'docx' ||
      ext === 'doc'
    ) {
      return { label: 'DOCX', color: '#2563EB', icon: 'document', bgColor: '#EFF6FF' };
    }
    if (mimeType?.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      const imgLabel = ext ? ext.toUpperCase() : 'PHOTO';
      return { label: imgLabel, color: '#059669', icon: 'image', bgColor: '#ECFDF5' };
    }
    return { label: 'FILE', color: '#4F46E5', icon: 'document-attach', bgColor: '#EEF2FF' };
  };

  const fileMeta = getFileMeta(doc.mimeType, doc.originalName);

  const canDeleteForEveryone =
    doc.canDeleteForEveryone !== undefined ? doc.canDeleteForEveryone : doc.canDelete;

  // Handle Delete for Me
  const handleDeleteForMeAction = () => {
    setMenuVisible(false);
    if (typeof onDeleteForMe === 'function') {
      onDeleteForMe(doc.id);
    }
  };

  // Handle Delete for Everyone with confirmation dialog
  const handleDeleteForEveryoneAction = () => {
    setMenuVisible(false);
    Alert.alert(
      'Delete for Everyone?',
      `Are you sure you want to permanently delete "${doc.title}" for all members of this group?\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for Everyone',
          style: 'destructive',
          onPress: () => {
            if (typeof onDeleteForEveryone === 'function') {
              onDeleteForEveryone(doc.id);
            } else if (typeof onDelete === 'function') {
              onDelete(doc.id);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.96}
      onLongPress={() => setMenuVisible(true)}
      delayLongPress={350}
    >
      <View style={styles.headerRow}>
        <View style={[styles.fileIconBox, { backgroundColor: fileMeta.bgColor }]}>
          <Ionicons name={fileMeta.icon} size={22} color={fileMeta.color} />
          <Text style={[styles.fileExtLabel, { color: fileMeta.color }]}>{fileMeta.label}</Text>
        </View>

        <View style={styles.titleInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {doc.title}
          </Text>
          <Text style={styles.originalName} numberOfLines={1}>
            {doc.originalName} • {formatBytes(doc.size)}
          </Text>
        </View>

        {/* Three-dot context menu button */}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.moreButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Actual Image Preview Thumbnail if document is an image */}
      {isImage && imageUrl && !imageError ? (
        <TouchableOpacity
          style={styles.imagePreviewContainer}
          onPress={() => setImageModalVisible(true)}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.imagePreview}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
          <View style={styles.imageOverlayBadge}>
            <Ionicons name="expand-outline" size={14} color="#FFF" />
            <Text style={styles.imageOverlayBadgeText}>View Photo</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {doc.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {doc.description}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.uploaderInfo}>
          <Ionicons name="person-circle-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.uploaderText}>
            {doc.uploaderName || 'Member'} • {formatDate(doc.createdAt)}
          </Text>
        </View>

        <View
          style={[
            styles.permBadge,
            doc.accessPermission === 'admin_only'
              ? styles.adminOnlyBadge
              : styles.allMembersBadge,
          ]}
        >
          <Ionicons
            name={doc.accessPermission === 'admin_only' ? 'lock-closed' : 'people'}
            size={11}
            color={doc.accessPermission === 'admin_only' ? '#B45309' : '#059669'}
          />
          <Text
            style={[
              styles.permText,
              doc.accessPermission === 'admin_only'
                ? styles.adminOnlyText
                : styles.allMembersText,
            ]}
          >
            {doc.accessPermission === 'admin_only' ? 'Admins Only' : 'All Members'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.openButton}
        onPress={() => onOpen(doc)}
        activeOpacity={0.8}
      >
        <Ionicons name={isImage ? "eye-outline" : "download-outline"} size={16} color={theme.colors.primary} />
        <Text style={styles.openButtonText}>
          {isImage ? 'View & Share Photo' : 'View & Share File'}
        </Text>
      </TouchableOpacity>

      {/* WhatsApp-Style Deletion Context Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuModalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />

            {/* Document Header in Menu */}
            <View style={styles.menuHeader}>
              <View style={[styles.menuFileIcon, { backgroundColor: fileMeta.bgColor }]}>
                <Ionicons name={fileMeta.icon} size={20} color={fileMeta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle} numberOfLines={1}>
                  {doc.title}
                </Text>
                <Text style={styles.menuSubtitle} numberOfLines={1}>
                  {doc.originalName} • {formatBytes(doc.size)}
                </Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Option A: Delete for Me */}
            <TouchableOpacity
              style={styles.menuOption}
              onPress={handleDeleteForMeAction}
              activeOpacity={0.7}
            >
              <View style={[styles.menuOptionIconBox, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="eye-off-outline" size={20} color={theme.colors.textPrimary} />
              </View>
              <View style={styles.menuOptionContent}>
                <Text style={styles.menuOptionTitle}>Delete for Me</Text>
                <Text style={styles.menuOptionDesc}>
                  Removes this file from your view only. Other group members can still access it.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option B: Delete for Everyone (Admin or Uploader) */}
            {canDeleteForEveryone ? (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleDeleteForEveryoneAction}
                activeOpacity={0.7}
              >
                <View style={[styles.menuOptionIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </View>
                <View style={styles.menuOptionContent}>
                  <Text style={[styles.menuOptionTitle, { color: '#DC2626' }]}>
                    Delete for Everyone
                  </Text>
                  <Text style={styles.menuOptionDesc}>
                    Permanently deletes this file from the group for all members.
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.menuCancelBtn}
              onPress={() => setMenuVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-Screen Image Viewer Modal */}
      {isImage && imageUrl ? (
        <Modal
          visible={imageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View style={styles.fullImageModal}>
            <View style={styles.fullImageHeader}>
              <Text style={styles.fullImageTitle} numberOfLines={1}>
                {doc.title}
              </Text>
              <TouchableOpacity
                onPress={() => setImageModalVisible(false)}
                style={styles.closeFullImageBtn}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.fullImageBody}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.fullImageView}
                resizeMode="contain"
              />
            </View>

            <View style={styles.fullImageFooter}>
              <Text style={styles.fullImageSub}>
                {doc.originalName} • {formatBytes(doc.size)}
              </Text>
              <TouchableOpacity
                style={styles.fullImageShareBtn}
                onPress={() => {
                  setImageModalVisible(false);
                  onOpen(doc);
                }}
              >
                <Ionicons name="share-outline" size={16} color="#FFF" />
                <Text style={styles.fullImageShareBtnText}>Share Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  fileExtLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  titleInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  originalName: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  uploaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  uploaderText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  permBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  allMembersBadge: {
    backgroundColor: theme.colors.successLight,
  },
  allMembersText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  adminOnlyBadge: {
    backgroundColor: theme.colors.warningLight,
  },
  adminOnlyText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  openButton: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 9,
    borderRadius: theme.borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  openButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  imagePreviewContainer: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  imagePreview: {
    width: '100%',
    height: 160,
    backgroundColor: '#1E293B',
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageOverlayBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  // WhatsApp-Style Deletion Modal Styles
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  menuHandle: {
    width: 38,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
  },
  menuFileIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 12,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  menuOptionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionContent: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  menuOptionDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  menuCancelBtn: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  fullImageModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  fullImageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  fullImageTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  closeFullImageBtn: {
    padding: 6,
  },
  fullImageBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageView: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  fullImageFooter: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullImageSub: {
    color: '#94A3B8',
    fontSize: 12,
    flex: 1,
  },
  fullImageShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  fullImageShareBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
