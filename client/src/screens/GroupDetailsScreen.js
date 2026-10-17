import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../theme';
import DocumentCard from '../components/DocumentCard';
import { groupsApi, documentsApi } from '../services/api';

export default function GroupDetailsScreen({ group, onBack }) {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'members'
  const [groupDetails, setGroupDetails] = useState(group);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docPermission, setDocPermission] = useState('all'); // 'all' | 'admin_only'
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Invite Modal State (Admins only)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const isAdmin = (groupDetails.myRole || group.myRole) === 'admin';

  // Fetch full details and documents
  const loadData = useCallback(async () => {
    try {
      const [detailsRes, docsRes] = await Promise.all([
        groupsApi.getGroupDetails(group.id),
        documentsApi.getDocuments(group.id),
      ]);

      if (detailsRes.group) {
        setGroupDetails(detailsRes.group);
      }
      if (docsRes.documents) {
        setDocuments(docsRes.documents);
      }
    } catch (err) {
      console.warn('Error loading group details:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Pick Document (PDF, JPEG/JPG, DOCX)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        if (!docTitle) {
          // Default title from file name without extension
          const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          setDocTitle(cleanName);
        }
      }
    } catch (err) {
      Alert.alert('File Picker Error', err.message);
    }
  };

  // Submit Upload
  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      Alert.alert('Missing File', 'Please pick a PDF, JPEG/JPG, or DOCX document.');
      return;
    }
    if (!docTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for this document.');
      return;
    }

    setUploading(true);
    try {
      await documentsApi.uploadDocument(
        group.id,
        selectedFile,
        docTitle.trim(),
        docDesc.trim(),
        docPermission
      );

      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setDocTitle('');
      setDocDesc('');
      setDocPermission('all');
      loadData();
      Alert.alert('Success', 'Document uploaded! Group members have been notified.');
    } catch (err) {
      Alert.alert('Upload Failed', err.message || 'Unable to upload file.');
    } finally {
      setUploading(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId) => {
    try {
      await documentsApi.deleteDocument(docId);
      loadData();
      Alert.alert('Deleted', 'Document was deleted successfully.');
    } catch (err) {
      Alert.alert('Delete Failed', err.message || 'Could not delete document.');
    }
  };

  // View / Share Document
  const handleOpenDocument = async (doc) => {
    try {
      await documentsApi.viewOrShareDocument(doc);
    } catch (err) {
      Alert.alert('View Error', 'Unable to open or share this document: ' + err.message);
    }
  };

  // Send Email Invite (Admin only)
  const handleInviteSubmit = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Missing Email', 'Please enter the email address to invite.');
      return;
    }

    setInviting(true);
    try {
      const res = await groupsApi.inviteMember(group.id, inviteEmail.trim());
      setIsInviteModalOpen(false);
      setInviteEmail('');
      loadData();
      Alert.alert('Invitation Sent', res.message || 'Member invitation processed successfully.');
    } catch (err) {
      Alert.alert('Invite Error', err.message || 'Failed to send invite.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Group Header Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerNav}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{groupDetails.category || 'General'}</Text>
          </View>
        </View>

        <View style={styles.bannerTitleRow}>
          <Text style={styles.groupTitle} numberOfLines={2}>
            {groupDetails.name}
          </Text>
          <View
            style={[
              styles.roleChip,
              isAdmin ? styles.adminRoleChip : styles.memberRoleChip,
            ]}
          >
            <Ionicons
              name={isAdmin ? 'shield-checkmark' : 'person'}
              size={12}
              color={isAdmin ? '#B45309' : '#4338CA'}
            />
            <Text
              style={[
                styles.roleChipText,
                isAdmin ? styles.adminRoleText : styles.memberRoleText,
              ]}
            >
              {isAdmin ? 'Admin' : 'Member'}
            </Text>
          </View>
        </View>

        {groupDetails.description ? (
          <Text style={styles.groupDesc}>{groupDetails.description}</Text>
        ) : null}

        {/* Tab Toggle */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'documents' && styles.tabItemActive]}
            onPress={() => setActiveTab('documents')}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={activeTab === 'documents' ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'documents' && styles.tabItemTextActive,
              ]}
            >
              Documents ({documents.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'members' && styles.tabItemActive]}
            onPress={() => setActiveTab('members')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={activeTab === 'members' ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.tabItemText,
                activeTab === 'members' && styles.tabItemTextActive,
              ]}
            >
              Members ({groupDetails.members?.length || 1})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      ) : activeTab === 'documents' ? (
        <View style={{ flex: 1 }}>
          {/* Action Row */}
          <View style={styles.actionRow}>
            <Text style={styles.sectionHeader}>Group Documents</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setIsUploadModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload" size={16} color="#FFF" />
              <Text style={styles.actionButtonText}>Upload Document</Text>
            </TouchableOpacity>
          </View>

          {/* Document List */}
          <FlatList
            data={documents}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <DocumentCard
                doc={item}
                onOpen={handleOpenDocument}
                onDelete={handleDeleteDocument}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-attach-outline" size={44} color={theme.colors.primary} />
                <Text style={styles.emptyTitle}>No Documents Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Upload PDFs, JPEG images, or Word documents (.docx) to share with this group.
                </Text>
                <TouchableOpacity
                  style={styles.uploadPromptBtn}
                  onPress={() => setIsUploadModalOpen(true)}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.uploadPromptBtnText}>Upload First Document</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      ) : (
        /* Members Tab */
        <View style={{ flex: 1 }}>
          <View style={styles.actionRow}>
            <Text style={styles.sectionHeader}>Group Members</Text>
            {isAdmin ? (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => setIsInviteModalOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="mail-outline" size={16} color="#FFF" />
                <Text style={styles.inviteButtonText}>Invite by Email</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={groupDetails.members || []}
            keyExtractor={(item, index) => item.userId || index.toString()}
            renderItem={({ item }) => {
              const isMemberAdmin = item.role === 'admin';
              return (
                <View style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {(item.name || item.email || 'U').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberEmail}>{item.email}</Text>
                    {item.jobTitle ? (
                      <Text style={styles.memberRoleSub}>
                        {item.jobTitle} • {item.department || 'General'}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.roleBadgeSmall,
                      isMemberAdmin ? styles.adminBadgeSmall : styles.memberBadgeSmall,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeSmallText,
                        isMemberAdmin ? styles.adminTextSmall : styles.memberTextSmall,
                      ]}
                    >
                      {isMemberAdmin ? 'Admin' : 'Member'}
                    </Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      {/* Upload Document Modal */}
      <Modal
        visible={isUploadModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsUploadModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Upload Document</Text>
                  <Text style={styles.modalSubtitle}>PDF, JPEG/JPG, and DOCX supported</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsUploadModalOpen(false)}
                  style={styles.closeModalBtn}
                >
                  <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* File Selection Box */}
              <TouchableOpacity
                style={[styles.pickFileBox, selectedFile && styles.pickFileBoxSelected]}
                onPress={handlePickDocument}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={selectedFile ? 'document-attach' : 'cloud-upload-outline'}
                  size={32}
                  color={selectedFile ? theme.colors.success : theme.colors.primary}
                />
                {selectedFile ? (
                  <View style={{ alignItems: 'center', marginTop: 6 }}>
                    <Text style={styles.pickedFileName} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    <Text style={styles.pickedFileSize}>
                      {Math.round(selectedFile.size / 1024)} KB • Tap to change file
                    </Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', marginTop: 6 }}>
                    <Text style={styles.pickFileText}>Tap to select document</Text>
                    <Text style={styles.pickFileSub}>PDF, JPEG/JPG, or DOCX up to 25MB</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Document Title */}
              <Text style={styles.inputLabel}>Document Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Q4 Financial Projections"
                placeholderTextColor={theme.colors.textMuted}
                value={docTitle}
                onChangeText={setDocTitle}
              />

              {/* Document Description */}
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalInput, styles.descInput]}
                placeholder="Brief notes on what this document contains..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={2}
                value={docDesc}
                onChangeText={setDocDesc}
              />

              {/* Access Rights / Permissions Selection */}
              <Text style={styles.inputLabel}>Access Permission *</Text>
              <View style={styles.permChoiceRow}>
                <TouchableOpacity
                  style={[
                    styles.permChoice,
                    docPermission === 'all' && styles.permChoiceActive,
                  ]}
                  onPress={() => setDocPermission('all')}
                >
                  <Ionicons
                    name="people"
                    size={18}
                    color={docPermission === 'all' ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <View style={styles.permChoiceTextWrapper}>
                    <Text
                      style={[
                        styles.permChoiceTitle,
                        docPermission === 'all' && styles.permChoiceTitleActive,
                      ]}
                    >
                      All Members
                    </Text>
                    <Text style={styles.permChoiceSubtitle}>
                      Every group member can view and download
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.permChoice,
                    docPermission === 'admin_only' && styles.permChoiceActive,
                  ]}
                  onPress={() => setDocPermission('admin_only')}
                >
                  <Ionicons
                    name="lock-closed"
                    size={18}
                    color={docPermission === 'admin_only' ? '#B45309' : theme.colors.textSecondary}
                  />
                  <View style={styles.permChoiceTextWrapper}>
                    <Text
                      style={[
                        styles.permChoiceTitle,
                        docPermission === 'admin_only' && { color: '#B45309' },
                      ]}
                    >
                      Admins Only
                    </Text>
                    <Text style={styles.permChoiceSubtitle}>
                      Restricted to group administrators
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={handleUploadSubmit}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Upload & Notify Group</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Invite Member Modal (Admins only) */}
      <Modal
        visible={isInviteModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsInviteModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Invite Member</Text>
                <Text style={styles.modalSubtitle}>Dispatch email invitation to join this group</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsInviteModalOpen(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.adminTipBox}>
              <Ionicons name="shield-checkmark" size={18} color="#B45309" />
              <Text style={styles.adminTipText}>
                As a Group Admin, you can invite new or existing users. Existing users are added directly, and new users receive an activation invitation.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Member Email Address *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="colleague@company.com"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
            />

            <TouchableOpacity
              style={styles.submitModalBtn}
              onPress={handleInviteSubmit}
              disabled={inviting}
            >
              {inviting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitModalBtnText}>Send Invitation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  banner: {
    backgroundColor: theme.colors.surface,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bannerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  backBtn: {
    padding: 4,
  },
  categoryBadge: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  adminRoleChip: {
    backgroundColor: theme.colors.warningLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  memberRoleChip: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminRoleText: {
    color: '#B45309',
  },
  memberRoleText: {
    color: '#4338CA',
  },
  groupDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: theme.spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xs,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabItemTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    gap: 5,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    gap: 5,
  },
  inviteButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  uploadPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.md,
    gap: 4,
  },
  uploadPromptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  memberAvatarText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  memberEmail: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  memberRoleSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  roleBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adminBadgeSmall: {
    backgroundColor: theme.colors.warningLight,
  },
  memberBadgeSmall: {
    backgroundColor: theme.colors.primaryLight,
  },
  roleBadgeSmallText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminTextSmall: {
    color: '#B45309',
  },
  memberTextSmall: {
    color: '#4338CA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 4,
  },
  pickFileBox: {
    borderWidth: 2,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFF',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  pickFileBoxSelected: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successLight,
    borderStyle: 'solid',
  },
  pickFileText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  pickFileSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  pickedFileName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  pickedFileSize: {
    fontSize: 12,
    color: theme.colors.success,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  descInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  permChoiceRow: {
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  permChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    gap: 12,
  },
  permChoiceActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  permChoiceTextWrapper: {
    flex: 1,
  },
  permChoiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  permChoiceTitleActive: {
    color: theme.colors.primary,
  },
  permChoiceSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  adminTipBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.warningLight,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  adminTipText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  submitModalBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  submitModalBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
