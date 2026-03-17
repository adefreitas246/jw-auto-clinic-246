// app/(customer)/rate/[bookingId].tsx
// Deep-linkable rating screen. Sent via push notification after a job is finished.
// Deep link: /(customer)/rate/<bookingId>
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { SCROLL_PADDING_BOTTOM } from '@/constants/Layout';
import { IS_IOS } from '@/utils/platform';
import { SCREEN_PADDING } from '@/utils/platformStyles';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function RateScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { token }     = useAuth();
  const router        = useRouter();

  const [stars,        setStars]        = useState(0);
  const [hovered,      setHovered]      = useState(0);
  const [comment,      setComment]      = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [checking,     setChecking]     = useState(true);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!bookingId) return;
    axios.get(`/api/reviews/booking/${bookingId}`, { headers })
      .then(res => {
        if (res.data) {
          setAlreadyRated(true);
          setExistingRating(res.data.stars);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [bookingId]);

  async function handleSubmit() {
    if (stars === 0) { Alert.alert('Select a rating', 'Please tap a star to rate.'); return; }

    try {
      setSubmitting(true);
      await axios.post('/api/reviews', { bookingId, stars, comment }, { headers });
      Alert.alert(
        '⭐ Thanks for your review!',
        'Your feedback helps us improve.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Failed to submit review.';
      if (msg.includes('already')) {
        setAlreadyRated(true);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <SafeAreaView style={st.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (alreadyRated) {
    return (
      <SafeAreaView style={st.center}>
        <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center' }}>
          <Text style={st.alreadyEmoji}>⭐</Text>
          <Text style={st.alreadyTitle}>Already Reviewed</Text>
          {existingRating && (
            <View style={st.existingStars}>
              {[1, 2, 3, 4, 5].map(s => (
                <Ionicons key={s} name={s <= existingRating ? 'star' : 'star-outline'} size={28} color={Colors.warning} />
              ))}
            </View>
          )}
          <Text style={st.alreadySub}>You've already submitted a review for this booking.</Text>
          <Pressable
            style={st.doneBtn}
            onPress={() => router.back()}
            android_ripple={{ color: Colors.white + '30' }}
          >
            <Text style={st.doneBtnText}>Go Back</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const displayStars = hovered || stars;

  return (
    <SafeAreaView style={st.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
        {/* Header */}
        <View style={st.header}>
          <Pressable
            onPress={() => router.back()}
            style={st.backBtn}
            hitSlop={8}
            android_ripple={{ color: Colors.accent + '20', borderless: true }}
          >
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={st.headerTitle}>Rate Your Experience</Text>
          <View style={{ width: 36 }} />
        </View>

        <Animated.ScrollView
          entering={FadeIn.duration(300)}
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Wash icon */}
          <View style={st.iconWrap}>
            <Ionicons name="car-sport" size={48} color={Colors.accent} />
          </View>
          <Text style={st.title}>How was your wash?</Text>
          <Text style={st.subtitle}>Your feedback helps us serve you better.</Text>

          {/* Star picker */}
          <View style={st.starsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <Pressable
                key={s}
                onPress={() => setStars(s)}
                onPressIn={() => setHovered(s)}
                onPressOut={() => setHovered(0)}
                hitSlop={6}
              >
                <Ionicons
                  name={s <= displayStars ? 'star' : 'star-outline'}
                  size={48}
                  color={s <= displayStars ? Colors.warning : Colors.border}
                />
              </Pressable>
            ))}
          </View>

          {displayStars > 0 && (
            <Text style={st.starLabel}>{STAR_LABELS[displayStars]}</Text>
          )}

          {/* Comment box */}
          <TextInput
            style={st.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment (optional)…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={st.charCount}>{comment.length}/500</Text>

          {/* Submit */}
          <Pressable
            style={[st.submitBtn, (submitting || stars === 0) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting || stars === 0}
            android_ripple={{ color: Colors.white + '30' }}
          >
            {submitting
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={st.submitBtnText}>Submit Review</Text>
            }
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={st.skipBtn}
            android_ripple={{ color: Colors.accent + '20', borderless: false }}
          >
            <Text style={st.skipBtnText}>Skip for now</Text>
          </Pressable>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 24 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN_PADDING, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  content:   { alignItems: 'center', paddingHorizontal: SCREEN_PADDING, paddingTop: 32, paddingBottom: SCROLL_PADDING_BOTTOM },
  iconWrap:  { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.accentMuted, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title:     { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  subtitle:  { fontSize: 14, color: Colors.textSecondary, marginBottom: 28 },

  starsRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  starLabel: { fontSize: 16, fontWeight: '600', color: Colors.warning, marginBottom: 24 },

  commentInput: { width: '100%', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 14, color: Colors.textPrimary, minHeight: 100, marginBottom: 4, backgroundColor: Colors.surface },
  charCount:    { width: '100%', textAlign: 'right', fontSize: 11, color: Colors.textMuted, marginBottom: 20 },

  submitBtn:     { width: '100%', backgroundColor: Colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  skipBtn:       { padding: 12 },
  skipBtnText:   { color: Colors.textMuted, fontSize: 13 },

  alreadyEmoji:  { fontSize: 56, marginBottom: 12 },
  alreadyTitle:  { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  alreadySub:    { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 10, marginBottom: 24 },
  existingStars: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  doneBtn:       { backgroundColor: Colors.accent, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10, overflow: 'hidden' },
  doneBtnText:   { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
