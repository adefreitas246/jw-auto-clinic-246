// app/(customer)/rate/[bookingId].tsx — Rate a specific wash
// Deep-linkable. Sent via push notification after a job is finished.
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

// ── Constants ─────────────────────────────────────────────────────────────────

const TAGS        = ['Great service', 'Very clean', 'Fast', 'Friendly staff'] as const;
const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingSummary = {
  serviceLabel:    string;
  appointmentDate: string;
  appointmentTime: string;
  technicianName?: string;
  vehicleLabel?:   string;
};

// ── Animated star ─────────────────────────────────────────────────────────────

function AnimatedStar({
  value,
  filled,
  onPress,
}: {
  value:   number;
  filled:  boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    scale.value = withSpring(1.45, { damping: 4, stiffness: 280 }, () => {
      scale.value = withSpring(1, { damping: 7, stiffness: 220 });
    });
    onPress();
  }

  return (
    <Pressable onPress={handlePress} hitSlop={6}>
      <Animated.View style={animStyle}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={48}
          color={filled ? Colors.warning : Colors.border}
        />
      </Animated.View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RateBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking,    setBooking]    = useState<BookingSummary | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState('');
  const [tags,       setTags]       = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Fetch booking summary for the header card
  useEffect(() => {
    if (!bookingId) return;
    axios.get<BookingSummary>(`/api/bookings/${bookingId}`)
      .then(res => setBooking(res.data))
      .catch(() => {})
      .finally(() => setLoadingBook(false));
  }, [bookingId]);

  function toggleTag(tag: string) {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
    if (rating === 0) return;
    setError(null);
    try {
      setSubmitting(true);
      await axios.post('/api/reviews', { bookingId, rating, comment, tags });
      setSubmitted(true);
      setTimeout(() => router.back(), 1800);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={st.safe}>
        <Animated.View entering={FadeIn.duration(300)} style={st.successScreen}>
          <Animated.View entering={ZoomIn.springify()} style={st.successIconWrap}>
            <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
          </Animated.View>
          <Text style={st.successTitle}>Thanks for your review!</Text>
          <Text style={st.successSub}>Your feedback helps us serve you better.</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      <ScreenHeader title="Rate Your Wash" backButton />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={IS_IOS ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={st.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Booking summary ── */}
          {!loadingBook && booking && (
            <Animated.View entering={FadeInDown.delay(60).duration(280)} style={st.summaryCard}>
              <View style={st.summaryRow}>
                <View style={st.summaryIconWrap}>
                  <Ionicons name="car-sport-outline" size={18} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.summaryService} numberOfLines={1}>{booking.serviceLabel}</Text>
                  <Text style={st.summaryMeta}>
                    {booking.appointmentDate}
                    {booking.appointmentTime ? ` · ${booking.appointmentTime}` : ''}
                    {booking.technicianName  ? ` · ${booking.technicianName}`  : ''}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Star rating ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(280)} style={st.starsSection}>
            <Text style={st.sectionLabel}>Your Rating</Text>
            <View style={st.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <AnimatedStar
                  key={s}
                  value={s}
                  filled={s <= rating}
                  onPress={() => setRating(s)}
                />
              ))}
            </View>
            {rating > 0 && (
              <Animated.Text entering={FadeIn.duration(200)} style={st.starLabel}>
                {STAR_LABELS[rating]}
              </Animated.Text>
            )}
          </Animated.View>

          {/* ── Quick tags ── */}
          <Animated.View entering={FadeInDown.delay(180).duration(280)} style={st.section}>
            <Text style={st.sectionLabel}>Quick Highlights</Text>
            <View style={st.tagsRow}>
              {TAGS.map(tag => {
                const selected = tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[st.tagChip, selected && st.tagChipSelected]}
                    onPress={() => toggleTag(tag)}
                    android_ripple={{ color: Colors.accent + '20', borderless: false }}
                  >
                    <Text style={[st.tagText, selected && st.tagTextSelected]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Comment ── */}
          <Animated.View entering={FadeInDown.delay(240).duration(280)} style={st.section}>
            <Text style={st.sectionLabel}>Comments (optional)</Text>
            <TextInput
              style={st.commentInput}
              value={comment}
              onChangeText={t => setComment(t.slice(0, 500))}
              placeholder="Tell us about your experience..."
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
            />
            <Text style={st.charCount}>{comment.length}/500</Text>
          </Animated.View>

          {/* ── Error ── */}
          {error && (
            <View style={st.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={st.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Submit ── */}
          <Animated.View entering={FadeInDown.delay(300).duration(280)}>
            <Pressable
              style={[st.submitBtn, (submitting || rating === 0) && { opacity: 0.55 }]}
              onPress={handleSubmit}
              disabled={submitting || rating === 0}
              android_ripple={{ color: Colors.white + '30', borderless: false }}
            >
              {submitting
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={st.submitBtnText}>Submit Rating</Text>
              }
            </Pressable>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 100 },

  // Booking summary
  summaryCard:     { backgroundColor: Colors.surface, borderRadius: borderRadius.lg, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border, ...cardShadow },
  summaryRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  summaryService:  { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  summaryMeta:     { fontSize: 12, color: Colors.textMuted },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  section:      { marginBottom: 24 },

  // Stars
  starsSection: { alignItems: 'center', marginBottom: 28 },
  starsRow:     { flexDirection: 'row', gap: 6, marginBottom: 10 },
  starLabel:    { fontSize: 16, fontWeight: '600', color: Colors.warning },

  // Tags
  tagsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip:         { borderRadius: borderRadius.full, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  tagChipSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tagText:         { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  tagTextSelected: { color: Colors.white },

  // Comment
  commentInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: borderRadius.lg, padding: 14, fontSize: 14, color: Colors.textPrimary, minHeight: 110, backgroundColor: Colors.surface },
  charCount:    { textAlign: 'right', fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  // Error
  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  errorText: { fontSize: 13, color: Colors.error, flex: 1 },

  // Submit
  submitBtn:     { backgroundColor: Colors.accent, borderRadius: borderRadius.lg, paddingVertical: 16, alignItems: 'center', overflow: 'hidden', ...cardShadow },
  submitBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },

  // Success
  successScreen:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIconWrap: { marginBottom: 20 },
  successTitle:    { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  successSub:      { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
