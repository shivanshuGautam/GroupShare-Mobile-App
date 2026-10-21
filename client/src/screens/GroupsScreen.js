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
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../theme';
import GroupCard from '../components/GroupCard';
import { groupsApi } from '../services/api';
import showToast from '../services/toast';
import { readAssetAsBase64, isUserCancellation } from '../utils/fileUtils';

export default function GroupsScreen({ onSelectGroup }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Create Group Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('General');
  const [newGroupAvatar, setNewGroupAvatar] = useState('');
  const [creating, setCreating] = useState(false);

  const categories = ['All', 'Engineering', 'Marketing', 'Design', 'Legal', 'General'];

  const fetchGroups = useCallback(async () => {
    try {
      const res = await groupsApi.getGroups();
      if (res.groups) {
        setGroups(res.groups);
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[GroupsScreen] Failed to fetch groups:', err?.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handlePickGroupPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
        copyToCacheDirectory: true,
      });

      // Handle user cancellation silently
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      if (!file?.uri) {
        showToast.error('Photo Selection', "Couldn't select photo. Please try again.");
        return;
      }

      const { dataUri } = await readAssetAsBase64(file);
      setNewGroupAvatar(dataUri);
      showToast.success('Photo Selected', 'Group icon attached.');
    } catch (err) {
      if (__DEV__) {
        console.log('[GroupsScreen] Group photo pick error:', err);
      }
      if (!isUserCancellation(err)) {
        showToast.error('Photo Selection', "Couldn't select photo. Please try again.");
      }
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      showToast.warning('Required Field', 'Please enter a group name.');
      return;
    }

    setCreating(true);
    try {
      await groupsApi.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        category: newGroupCategory,
        avatar: newGroupAvatar,
      });

      setIsModalVisible(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupCategory('General');
      setNewGroupAvatar('');
      fetchGroups();
      showToast.success('Workspace Created', 'You are the administrator of this group.');
    } catch (err) {
      showToast.error('Create Group Failed', err);
    } finally {
      setCreating(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'All' || g.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={styles.container}>
      {/* Search & Actions Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.createButtonText}>New Group</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter Pills */}
      <View style={styles.categoryScroll}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryPill,
                selectedCategory === item && styles.categoryPillActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === item && styles.categoryPillTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
        />
      </View>

      {/* Groups List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your groups...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <GroupCard group={item} onPress={onSelectGroup} />
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
              <View style={styles.emptyIconBox}>
                <Ionicons name="folder-open-outline" size={48} color={theme.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Groups Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedCategory !== 'All'
                  ? 'Try adjusting your search query or category filters.'
                  : 'Create your first group to start sharing documents with team members.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyCreateButton}
                onPress={() => setIsModalVisible(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                <Text style={styles.emptyCreateButtonText}>Create a Group</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Create Group Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create New Group</Text>
                <Text style={styles.modalSubtitle}>You will be the group Administrator</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Group Photo (Optional)</Text>
            <View style={styles.groupAvatarPickerRow}>
              <TouchableOpacity
                style={styles.groupAvatarBox}
                onPress={handlePickGroupPhoto}
                activeOpacity={0.8}
              >
                {newGroupAvatar ? (
                  <Image source={{ uri: newGroupAvatar }} style={styles.newGroupAvatarImg} />
                ) : (
                  <View style={styles.groupAvatarPlaceholder}>
                    <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
                    <Text style={styles.groupAvatarPlaceholderText}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.groupAvatarInfo}>
                {newGroupAvatar ? (
                  <TouchableOpacity
                    style={styles.removeGroupAvatarBtn}
                    onPress={() => setNewGroupAvatar('')}
                  >
                    <Ionicons name="trash-outline" size={14} color={theme.colors.danger} />
                    <Text style={styles.removeGroupAvatarText}>Remove Photo</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.groupAvatarHelpText}>
                    Tap to add a photo or logo for your group (PNG, JPG)
                  </Text>
                )}
              </View>
            </View>

            <Text style={styles.inputLabel}>Group Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Design Systems 2026"
              placeholderTextColor={theme.colors.textMuted}
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.descInput]}
              placeholder="Describe the purpose of this group and document types..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryPickerRow}>
              {['Engineering', 'Design', 'Marketing', 'Legal', 'General'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChoice,
                    newGroupCategory === cat && styles.catChoiceActive,
                  ]}
                  onPress={() => setNewGroupCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catChoiceText,
                      newGroupCategory === cat && styles.catChoiceTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.submitModalBtn}
              onPress={handleCreateGroup}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitModalBtnText}>Create Group & Become Admin</Text>
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
  topBar: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryScroll: {
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceSubtle,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  categoryPillTextActive: {
    color: '#FFF',
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
    paddingVertical: 60,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.lg,
    gap: 6,
  },
  emptyCreateButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
    height: 70,
    textAlignVertical: 'top',
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.lg,
  },
  catChoice: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catChoiceActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  catChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  catChoiceTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
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
  groupAvatarPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  groupAvatarBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  newGroupAvatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  groupAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarPlaceholderText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 2,
  },
  groupAvatarInfo: {
    flex: 1,
  },
  removeGroupAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  removeGroupAvatarText: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: '600',
  },
  groupAvatarHelpText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
});
