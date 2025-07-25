import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Image,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';

export default function SettingsScreen() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone?.trim() || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSavedAnim, setShowSavedAnim] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, email, phone, avatar, notificationsEnabled });
      Alert.alert('Saved', 'Your profile has been updated.');
      setEditing(false);
      setShowSavedAnim(true);
      setTimeout(() => setShowSavedAnim(false), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      {/* Profile Row */}
      <View style={styles.profileRow}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper} accessibilityLabel="Edit Profile Picture">
          <Image
            source={avatar ? { uri: avatar } : require('@/assets/images/avatar-placeholder.png')}
            style={styles.avatar}
            accessibilityLabel="Profile picture"
          />
        </TouchableOpacity>
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setEditing(!editing)}
          style={styles.editIcon}
          accessibilityLabel={editing ? 'Cancel editing' : 'Edit profile'}
        >
          <Ionicons name={editing ? 'close-outline' : 'create-outline'} size={24} color="#6a0dad" />
        </TouchableOpacity>
      </View>

      {/* ACCOUNT SECTION */}
      <Text style={styles.sectionTitle}>ACCOUNT</Text>

      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>Name</Text>
        {editing ? (
          <TextInput
            style={styles.itemInput}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect
            placeholder="Your full name"
          />
        ) : (
          <Text style={styles.itemValue}>{name || '—'}</Text>
        )}
      </View>

      {editing && <Text style={styles.helperText}>Used for profile display</Text>}

      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>Phone</Text>
        {editing ? (
          <TextInput
            style={styles.itemInput}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="e.g. (246) 123-4567"
          />
        ) : (
          <Text style={styles.itemValue}>{phone?.trim() ? phone : '—'}</Text>
        )}
      </View>

      <View style={styles.itemRow}>
        <Text style={styles.itemLabel}>Email</Text>
        {editing ? (
          <TextInput
            style={styles.itemInput}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
          />
        ) : (
          <Text style={styles.itemValue}>{email || '—'}</Text>
        )}
      </View>

      {/* Save Button */}
      {editing && (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Saved'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Save Animation */}
      {showSavedAnim && (
        <Animatable.Text
          animation="fadeInDown"
          duration={500}
          style={styles.savedMessage}
        >
          ✅ Changes Saved Successfully!
        </Animatable.Text>
      )}

      {/* Logout */}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 30,
  },
  avatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#6a0dad',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: Platform.OS === 'android' ? 0.2 : 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  profileText: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  editIcon: {
    padding: 6,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#999',
    marginBottom: 6,
    marginTop: 18,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: '#eee',
  },
  itemLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  itemValue: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
    flex: 1,
  },
  itemInput: {
    fontSize: 16,
    borderBottomWidth: 1,
    borderColor: '#6a0dad',
    backgroundColor: '#f7f2fc',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'right',
    flex: 1,
    color: '#000',
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginTop: -10,
    marginBottom: 8,
    textAlign: 'right',
  },

  saveButton: {
    backgroundColor: '#6a0dad',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 30,
  },
  saveText: {
    textAlign: 'center',
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  savedMessage: {
    marginTop: 16,
    fontSize: 14,
    color: 'green',
    textAlign: 'center',
    fontWeight: '500',
  },

  logoutButton: {
    marginTop: 50,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e53e3e',
  },
  logoutText: {
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: '600',
  },
});
