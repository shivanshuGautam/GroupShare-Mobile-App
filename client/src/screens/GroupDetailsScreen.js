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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../theme';
import DocumentCard from '../components/DocumentCard';
import { groupsApi, documentsApi, getBaseUrl, DEFAULT_SERVER_URL } from '../services/api';
import showToast from '../services/toast';
import { isUserCancellation } from '../utils/fileUtils';

export default function GroupDetailsScreen({ group, onBack }) {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'members'
  const [groupDetails, setGroupDetails] = useState(group);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_SERVER_URL);

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
  const [inviteRole, setInviteRole] = useState('member'); // 'member' | 'admin'
  const [inviting, setInviting] = useState(false);
  const [groupInvitations, setGroupInvitations] = useState([]);

  const targetGroupId = groupDetails?.id || groupDetails?._id || group?.id || group?._id;
  const isAdmin = (groupDetails?.myRole || group?.myRole) === 'admin';
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Fetch full details and documents
  const loadData = useCallback(async () => {
    const idToFetch = groupDetails?.id || groupDetails?._id || group?.id || group?._id;
    if (!idToFetch) return;
    try {
      const [detailsRes, docsRes] = await Promise.all([
        groupsApi.getGroupDetails(idToFetch),
        documentsApi.getDocuments(idToFetch),
      ]);

      if (detailsRes.group) {
        setGroupDetails(detailsRes.group);
        if (detailsRes.group.invitations) {
          setGroupInvitations(detailsRes.group.invitations);
        }
      }
      if (docsRes.documents) {
        setDocuments(docsRes.documents);
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[GroupDetailsScreen] Error loading group details:', err?.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [group?.id, group?._id]);

  // Confirm and Delete Group (Admin only)
  const confirmDeleteGroup = () => {
    const groupName = groupDetails?.name || group?.name || 'this group';
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${groupName}"?\n\nWARNING: This will permanently delete the group, all uploaded documents, invitations, and data for ALL members. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Group',
          style: 'destructive',
          onPress: handleDeleteGroup,
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteGroup = async () => {
    if (deletingGroup) return;
    const currentGroupId = groupDetails?.id || groupDetails?._id || group?.id || group?._id;
    if (!currentGroupId) {
      showToast.error('Delete Error', 'Group identifier could not be determined.');
      return;
    }

    setDeletingGroup(true);
    try {
      const res = await groupsApi.deleteGroup(currentGroupId);
      showToast.success('Group Deleted', res?.message || 'Workspace was deleted successfully.');
      if (typeof onBack === 'function') {
        onBack({ deletedGroupId: currentGroupId });
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[GroupDetailsScreen] Delete group error:', err);
      }
      showToast.error('Delete Failed', err);
      setDeletingGroup(false);
    }
  };

  useEffect(() => {
    loadData();
    getBaseUrl().then((url) => {
      if (url) setBaseUrlState(url);
    });
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Pick Document (PDF, Images, DOCX)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/jpg',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      // User cancellation handled silently
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setSelectedFile(file);
      if (!docTitle) {
        const rawName = file.name || 'document';
        const cleanName = rawName.includes('.')
          ? rawName.substring(0, rawName.lastIndexOf('.'))
          : rawName;
        setDocTitle(cleanName);
      }
      showToast.info('File Selected', file.name || 'Document ready for upload');
    } catch (err) {
      if (__DEV__) {
        console.log('[GroupDetailsScreen] File pick error:', err);
      }
      if (!isUserCancellation(err)) {
        showToast.error('File Selection', "Couldn't select file. Please try again.");
      }
    }
  };

  // Submit Upload
  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      showToast.warning('Missing File', 'Please pick a PDF, JPEG/JPG, or document to upload.');
      return;
    }
    if (!docTitle.trim()) {
      showToast.warning('Missing Title', 'Please enter a title for this document.');
      return;
    }

    const currentGroupId = groupDetails?.id || groupDetails?._id || group?.id || group?._id;
    if (!currentGroupId) {
      showToast.error('Upload Error', 'Group ID could not be identified.');
      return;
    }

    setUploading(true);
    try {
      const res = await documentsApi.uploadDocument(
        currentGroupId,
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
      await loadData();
      showToast.success('Upload Complete', res?.message || 'Document uploaded! Group members have been notified.');
    } catch (err) {
      if (__DEV__) {
        console.log('[GroupDetailsScreen] Upload error:', err);
      }
      showToast.error('Upload Failed', err);
    } finally {
      setUploading(false);
    }
  };

  // Delete Document for Me (WhatsApp-style: hides for current user only)
  const handleDeleteDocumentForMe = async (docId) => {
    try {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      await documentsApi.deleteForMe(docId);
      showToast.success('Hidden For You', 'This file has been removed from your list.');
    } catch (err) {
      showToast.error('Action Failed', err);
      loadData();
    }
  };

  // Delete Document for Everyone (Admin or Uploader only)
  const handleDeleteDocumentForEveryone = async (docId) => {
    try {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      await documentsApi.deleteForEveryone(docId);
      showToast.success('Deleted For Everyone', 'Document was permanently deleted for all members.');
    } catch (err) {
      showToast.error('Delete Failed', err);
      loadData();
    }
  };

  // Backward-compatible alias
  const handleDeleteDocument = handleDeleteDocumentForEveryone;

  // View / Share Document
  const handleOpenDocument = async (doc) => {
    try {
      await documentsApi.viewOrShareDocument(doc);
    } catch (err) {
      showToast.error('Document Viewer', 'Unable to open or share this document.');
    }
  };

  // Send Email Invite (Admin only)
  const handleInviteSubmit = async () => {
    if (!inviteEmail.trim()) {
      showToast.warning('Missing Email', 'Please enter the email address to invite.');
      return;
    }

    setInviting(true);
    try {
      const res = await groupsApi.inviteMember(targetGroupId, inviteEmail.trim(), inviteRole);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('member');
      await loadData();
      if (res.action === 'added_directly') {
        showToast.success('Member Added', res.message || 'Friend added to the group successfully.');
      } else {
        showToast.success('Invitation Dispatched', res.message || 'Invitation email sent successfully!');
      }
    } catch (err) {
      showToast.error('Invite Error', err);
    } finally {
      setInviting(false);
    }
  };

  // Resend Invitation
  const handleResendInvite = async (invitationId) => {
    try {
      const res = await groupsApi.resendInvitation(targetGroupId, invitationId);
      showToast.success('Invitation Resent', res.message || 'A fresh invitation email has been sent.');
      await loadData();
    } catch (err) {
      showToast.error('Resend Failed', err);
    }
  };

  // Cancel Invitation
  const handleCancelInvite = (invitationId, email) => {
    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation sent to "${email}"?`,
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel Invitation',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupsApi.cancelInvitation(targetGroupId, invitationId);
              showToast.info('Cancelled', 'Invitation has been cancelled.');
              await loadData();
            } catch (err) {
              showToast.error('Cancel Failed', err);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Group Header Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerNav}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{groupDetails.category || 'General'}</Text>
            </View>
            {isAdmin ? (
              <TouchableOpacity
                onPress={confirmDeleteGroup}
                style={styles.deleteHeaderBtn}
                disabled={deletingGroup}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {deletingGroup ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <View style={styles.deleteHeaderBtnInner}>
                    <Ionicons name="trash-outline" size={15} color="#DC2626" />
                    <Text style={styles.deleteHeaderBtnText}>Delete Group</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.bannerTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
            {groupDetails.avatar ? (
              <Image source={{ uri: groupDetails.avatar }} style={styles.groupBannerAvatar} />
            ) : null}
            <Text style={styles.groupTitle} numberOfLines={2}>
              {groupDetails.name}
            </Text>
          </View>
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
                onDelete={handleDeleteDocumentForEveryone}
                onDeleteForMe={handleDeleteDocumentForMe}
                onDeleteForEveryone={handleDeleteDocumentForEveryone}
                baseUrl={baseUrl}
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
            ListFooterComponent={
              isAdmin ? (
                <View>
                  {/* Pending Invitations Section */}
                  {groupInvitations && groupInvitations.length > 0 ? (
                    <View style={styles.invitationsSection}>
                      <View style={styles.invitationsHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="mail" size={16} color={theme.colors.primary} />
                          <Text style={styles.invitationsSectionTitle}>
                            Pending Invitations ({groupInvitations.length})
                          </Text>
                        </View>
                        <TouchableOpacity onPress={loadData} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="refresh" size={16} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>

                      {groupInvitations.map((inv) => {
                        const isPending =
                          inv.status === 'pending_registration' || inv.status === 'pending_acceptance';
                        const isExpired = inv.status === 'expired';
                        const isAccepted = inv.status === 'accepted';
                        const isCancelled = inv.status === 'cancelled';

                        const statusColor = isAccepted
                          ? '#059669'
                          : isPending
                          ? '#4F46E5'
                          : isExpired
                          ? '#DC2626'
                          : '#64748B';

                        const statusBg = isAccepted
                          ? '#ECFDF5'
                          : isPending
                          ? '#EEF2FF'
                          : isExpired
                          ? '#FEF2F2'
                          : '#F1F5F9';

                        const statusLabel =
                          inv.status === 'pending_registration'
                            ? 'Pending Registration'
                            : inv.status === 'pending_acceptance'
                            ? 'Pending Acceptance'
                            : inv.status === 'accepted'
                            ? 'Accepted'
                            : inv.status === 'declined'
                            ? 'Declined'
                            : inv.status === 'expired'
                            ? 'Expired'
                            : 'Cancelled';

                        const formattedExpiry = inv.expiresAt
                          ? new Date(inv.expiresAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '';

                        return (
                          <View key={inv.id || inv._id} style={styles.inviteCard}>
                            <View style={styles.inviteCardTop}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.inviteEmail}>{inv.email}</Text>
                                <Text style={styles.inviteMeta}>
                                  Role: {inv.role || 'member'} &bull; Expires: {formattedExpiry}
                                  {inv.resendCount ? ` &bull; Resent ${inv.resendCount}x` : ''}
                                </Text>
                              </View>
                              <View style={[styles.statusChip, { backgroundColor: statusBg }]}>
                                <Text style={[styles.statusChipText, { color: statusColor }]}>
                                  {statusLabel}
                                </Text>
                              </View>
                            </View>

                            {/* Resend and Cancel Buttons for Active / Expired Invites */}
                            {!isAccepted && !isCancelled ? (
                              <View style={styles.inviteActionsRow}>
                                <TouchableOpacity
                                  style={styles.resendBtn}
                                  onPress={() => handleResendInvite(inv.id || inv._id)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="paper-plane-outline" size={13} color={theme.colors.primary} />
                                  <Text style={styles.resendBtnText}>Resend Email</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.cancelBtn}
                                  onPress={() => handleCancelInvite(inv.id || inv._id, inv.email)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="close-circle-outline" size={13} color={theme.colors.danger} />
                                  <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}

                  {/* Danger Zone */}
                  <View style={styles.adminDangerCard}>
                    <View style={styles.adminDangerHeader}>
                      <Ionicons name="warning-outline" size={20} color="#DC2626" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.adminDangerTitle}>Administrator Controls</Text>
                        <Text style={styles.adminDangerSub}>
                          Deleting this group permanently deletes all documents, invitations, and notifications for all members.
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.adminDeleteGroupBtn}
                      onPress={confirmDeleteGroup}
                      disabled={deletingGroup}
                      activeOpacity={0.8}
                    >
                      {deletingGroup ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="trash" size={16} color="#FFF" />
                          <Text style={styles.adminDeleteGroupBtnText}>Delete This Group</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null
            }
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
                {selectedFile ? (
                  (selectedFile.mimeType?.startsWith('image/') ||
                  /\.(jpg|jpeg|png|webp|gif)$/i.test(selectedFile.name || '')) ? (
                    <View style={styles.pickedImageWrapper}>
                      <Image
                        source={{ uri: selectedFile.uri }}
                        style={styles.pickedImageThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.pickedImageMeta}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickedFileName} numberOfLines={1}>
                            {selectedFile.name}
                          </Text>
                          <Text style={styles.pickedFileSize}>
                            {selectedFile.size ? `${Math.round(selectedFile.size / 1024)} KB` : 'Photo ready'} • Tap to change photo
                          </Text>
                        </View>
                        <View style={styles.photoReadyBadge}>
                          <Ionicons name="checkmark-circle" size={15} color="#059669" />
                          <Text style={styles.photoReadyBadgeText}>Photo Ready</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', width: '100%' }}>
                      <Ionicons
                        name="document-attach"
                        size={32}
                        color={theme.colors.success}
                      />
                      <Text style={styles.pickedFileName} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.pickedFileSize}>
                        {selectedFile.size ? `${Math.round(selectedFile.size / 1024)} KB` : 'File ready'} • Tap to change file
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={36}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.pickFileText}>Tap to select photo or document</Text>
                    <Text style={styles.pickFileSub}>Photos (PNG, JPG, WEBP), PDF, DOCX up to 25MB</Text>
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

            <Text style={styles.inputLabel}>Role in Group</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                style={[
                  styles.roleChoiceBtn,
                  inviteRole === 'member' && styles.roleChoiceBtnActive,
                ]}
                onPress={() => setInviteRole('member')}
              >
                <Text
                  style={[
                    styles.roleChoiceBtnText,
                    inviteRole === 'member' && styles.roleChoiceBtnTextActive,
                  ]}
                >
                  Member (Standard)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleChoiceBtn,
                  inviteRole === 'admin' && styles.roleChoiceBtnActive,
                ]}
                onPress={() => setInviteRole('admin')}
              >
                <Text
                  style={[
                    styles.roleChoiceBtnText,
                    inviteRole === 'admin' && styles.roleChoiceBtnTextActive,
                  ]}
                >
                  Group Admin
                </Text>
              </TouchableOpacity>
            </View>

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
  groupBannerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pickedImageWrapper: {
    width: '100%',
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  pickedImageThumb: {
    width: '100%',
    height: 140,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#0F172A',
  },
  pickedImageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  photoReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  photoReadyBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
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
  deleteHeaderBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteHeaderBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteHeaderBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  adminDangerCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: '#FEF2F2',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  adminDangerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  adminDangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  adminDangerSub: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 16,
  },
  adminDeleteGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    gap: 8,
  },
  adminDeleteGroupBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  invitationsSection: {
    marginTop: theme.spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: theme.spacing.md,
  },
  invitationsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  invitationsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  inviteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 8,
  },
  inviteCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteEmail: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  inviteMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inviteActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  resendBtnText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  cancelBtnText: {
    fontSize: 11,
    color: theme.colors.danger,
    fontWeight: '600',
  },
  roleChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  roleChoiceBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#EEF2FF',
  },
  roleChoiceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  roleChoiceBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
