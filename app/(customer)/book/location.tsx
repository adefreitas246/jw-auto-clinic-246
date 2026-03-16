// app/(customer)/book/location.tsx — Step 4: Fixed bay or mobile address
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { Colors } from '@/constants/Colors';
import { useBooking } from '@/context/BookingContext';
import { BusinessLocation } from '@/types/booking';
import { IS_IOS } from '@/utils/platform';
import { borderRadius, cardShadow, SCREEN_PADDING } from '@/utils/platformStyles';

export default function BookLocationStep() {
  const { draft, setLocation } = useBooking();

  const [locType,     setLocType]     = useState<'bay' | 'mobile'>(draft.locationType);
  const [bays,        setBays]        = useState<BusinessLocation[]>([]);
  const [selBay,      setSelBay]      = useState<BusinessLocation | null>(draft.bay);
  const [address,     setAddress]     = useState(draft.mobileAddress);
  const [locating,    setLocating]    = useState(false);
  const [loadingBays, setLoadingBays] = useState(true);

  useEffect(() => {
    axios.get<{ locations: BusinessLocation[] }>('/api/profile/business')
      .then(res => setBays(res.data.locations ?? []))
      .catch(() => setBays([]))
      .finally(() => setLoadingBays(false));
  }, []);

  const useMyLocation = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'GPS location is not available on web. Please type your address.');
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for mobile service.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const formatted = [geo.streetNumber, geo.street, geo.city, geo.region]
        .filter(Boolean).join(', ');
      setAddress(formatted);
      setLocation('mobile', null, formatted, loc.coords.latitude, loc.coords.longitude);
    } catch {
      Alert.alert('Error', 'Could not retrieve your location.');
    } finally {
      setLocating(false);
    }
  };

  const canContinue =
    locType === 'bay'    ? selBay !== null :
    locType === 'mobile' ? address.trim().length > 3 : false;

  const handleNext = () => {
    if (locType === 'bay') {
      setLocation('bay', selBay!, '', null, null);
    } else {
      setLocation('mobile', null, address, draft.mobileLat, draft.mobileLng);
    }
    router.push('/(customer)/book/review');
  };

  const handleTypeSwitch = (type: 'bay' | 'mobile') => {
    Haptics.selectionAsync();
    setLocType(type);
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={4} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Type selector ── */}
        <View style={s.typeRow}>
          {(['bay', 'mobile'] as const).map(type => {
            const active = locType === type;
            return (
              <Pressable
                key={type}
                style={[s.typeBtn, active && s.typeBtnActive]}
                onPress={() => handleTypeSwitch(type)}
                android_ripple={{ color: Colors.accent + '12', borderless: false }}
              >
                <View style={[s.typeIconWrap, active && s.typeIconWrapActive]}>
                  <Ionicons
                    name={type === 'bay' ? 'business-outline' : 'car-outline'}
                    size={22}
                    color={active ? Colors.accent : Colors.textMuted}
                  />
                </View>
                <Text style={[s.typeBtnLabel, active && s.typeBtnLabelActive]}>
                  {type === 'bay' ? 'Visit Our Bay' : 'Mobile Service'}
                </Text>
                <Text style={[s.typeBtnSub, active && s.typeBtnSubActive]}>
                  {type === 'bay' ? 'Come to us' : 'We come to you'}
                </Text>
                {active && (
                  <View style={s.typeCheckmark}>
                    <Ionicons name="checkmark" size={12} color={Colors.white} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Bay list ── */}
        {locType === 'bay' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Choose a Location</Text>
            {loadingBays ? (
              <View style={s.loadingRow}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={s.loadingText}>Loading locations…</Text>
              </View>
            ) : bays.length === 0 ? (
              <View style={s.emptyBays}>
                <Ionicons name="business-outline" size={28} color={Colors.border} />
                <Text style={s.emptyBaysText}>No bay locations configured.</Text>
              </View>
            ) : (
              bays.map((bay, i) => {
                const isSel = selBay?.label === bay.label;
                return (
                  <Pressable
                    key={i}
                    style={[s.bayCard, isSel && s.bayCardSel]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelBay(bay);
                    }}
                    android_ripple={{ color: Colors.accent + '12', borderless: false }}
                  >
                    <View style={[s.bayIconWrap, isSel && s.bayIconWrapSel]}>
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color={isSel ? Colors.accent : Colors.textMuted}
                      />
                    </View>
                    <View style={s.bayBody}>
                      <Text style={[s.bayLabel, isSel && s.bayLabelSel]}>{bay.label}</Text>
                      {!!bay.address && (
                        <Text style={s.bayAddr} numberOfLines={1}>{bay.address}</Text>
                      )}
                      {!!bay.phone && (
                        <Text style={s.bayAddr}>{bay.phone}</Text>
                      )}
                    </View>
                    {isSel
                      ? <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                      : <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                    }
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* ── Mobile address ── */}
        {locType === 'mobile' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Your Address</Text>
            <Text style={s.sectionSub}>Enter the address where you'd like the service.</Text>
            <View style={[s.addressInputWrap, address.trim().length > 3 && s.addressInputWrapActive]}>
              <Ionicons
                name="location-outline"
                size={18}
                color={address.trim().length > 3 ? Colors.accent : Colors.textMuted}
                style={s.addressIcon}
              />
              <TextInput
                style={s.addressInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Street address, city…"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>
            {Platform.OS !== 'web' && (
              <Pressable
                style={({ pressed }) => [s.gpsBtn, (locating || pressed) && { opacity: 0.75 }]}
                onPress={useMyLocation}
                disabled={locating}
                android_ripple={{ color: Colors.accent + '12', borderless: false }}
              >
                {locating
                  ? <ActivityIndicator color={Colors.accent} size="small" />
                  : <Ionicons name="navigate-outline" size={16} color={Colors.accent} />
                }
                <Text style={s.gpsBtnText}>
                  {locating ? 'Getting location…' : 'Use my current location'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [
            s.nextBtn,
            !canContinue && s.nextBtnOff,
            pressed && canContinue && { opacity: 0.88 },
          ]}
          onPress={handleNext}
          disabled={!canContinue}
          android_ripple={{ color: Colors.accent + '12', borderless: false }}
        >
          <Text style={s.nextBtnText}>Next — Review</Text>
          <Ionicons name="arrow-forward" size={17} color={Colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.surfaceAlt },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 120 },

  // Type selector
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 6,
    ...cardShadow,
  },
  typeBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  typeIconWrapActive: {
    backgroundColor: Colors.accent + '25',
  },
  typeBtnLabel:       { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },
  typeBtnLabelActive: { color: Colors.accent },
  typeBtnSub:         { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  typeBtnSubActive:   { color: Colors.accentDark },
  typeCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  section:     { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  loadingRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText:  { fontSize: 13, color: Colors.textMuted },
  emptyBays:    { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyBaysText:{ fontSize: 14, color: Colors.textMuted },

  // Bay card
  bayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: Colors.transparent,
    gap: 12,
    ...cardShadow,
  },
  bayCardSel:    { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  bayIconWrap:   {
    width: 42,
    height: 42,
    borderRadius: borderRadius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bayIconWrapSel:{ backgroundColor: Colors.accent + '20' },
  bayBody:       { flex: 1 },
  bayLabel:      { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  bayLabelSel:   { color: Colors.accent },
  bayAddr:       { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Address input
  addressInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
  },
  addressInputWrapActive: { borderColor: Colors.accent },
  addressIcon: { marginTop: 2 },
  addressInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 60,
    lineHeight: 20,
  },

  // GPS button
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentMuted,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  gpsBtnText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: IS_IOS ? 36 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    ...(IS_IOS
      ? { shadowColor: Colors.shadow, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } }
      : { elevation: 8 }),
  },
  nextBtn: {
    backgroundColor: Colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnOff:  { opacity: 0.4 },
  nextBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
