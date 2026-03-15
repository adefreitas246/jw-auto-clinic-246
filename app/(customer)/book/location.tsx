// app/(customer)/book/location.tsx — Step 4: Fixed bay or mobile address
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingProgressBar } from './_layout';
import { useBooking } from '@/context/BookingContext';
import { BusinessLocation } from '@/types/booking';

export default function BookLocationStep() {
  const { draft, setLocation } = useBooking();

  const [locType,   setLocType]   = useState<'bay' | 'mobile'>(draft.locationType);
  const [bays,      setBays]      = useState<BusinessLocation[]>([]);
  const [selBay,    setSelBay]    = useState<BusinessLocation | null>(draft.bay);
  const [address,   setAddress]   = useState(draft.mobileAddress);
  const [locating,  setLocating]  = useState(false);
  const [loadingBays, setLoadingBays] = useState(true);

  useEffect(() => {
    // Fetch business locations from the Business settings
    axios.get<{ locations: BusinessLocation[] }>('/api/profile/business')
      .then(res => setBays(res.data.locations ?? []))
      .catch(() => setBays([]))
      .finally(() => setLoadingBays(false));
  }, []);

  const useMyLocation = async () => {
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

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <BookingProgressBar step={4} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Type selector */}
        <View style={s.typeRow}>
          {(['bay', 'mobile'] as const).map(type => (
            <Pressable
              key={type}
              style={[s.typeBtn, locType === type && s.typeBtnActive]}
              onPress={() => setLocType(type)}
            >
              <Ionicons
                name={type === 'bay' ? 'business' : 'car'}
                size={20}
                color={locType === type ? '#6a0dad' : '#888'}
              />
              <Text style={[s.typeBtnText, locType === type && s.typeBtnTextActive]}>
                {type === 'bay' ? 'Visit our bay' : 'Mobile service'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Bay list */}
        {locType === 'bay' && (
          <View>
            <Text style={s.sectionTitle}>Choose a location</Text>
            {loadingBays ? (
              <ActivityIndicator color="#6a0dad" />
            ) : bays.length === 0 ? (
              <Text style={s.hint}>No bay locations configured for this business.</Text>
            ) : (
              bays.map((bay, i) => {
                const isSel = selBay?.label === bay.label;
                return (
                  <Pressable
                    key={i}
                    style={[s.bayCard, isSel && s.bayCardSel]}
                    onPress={() => setSelBay(bay)}
                  >
                    <View style={s.bayIconWrap}>
                      <Ionicons name="location" size={22} color={isSel ? '#6a0dad' : '#888'} />
                    </View>
                    <View style={s.bayBody}>
                      <Text style={[s.bayLabel, isSel && { color: '#6a0dad' }]}>{bay.label}</Text>
                      {!!bay.address && <Text style={s.bayAddr}>{bay.address}</Text>}
                      {!!bay.phone  && <Text style={s.bayAddr}>{bay.phone}</Text>}
                    </View>
                    {isSel && <Ionicons name="checkmark-circle" size={20} color="#6a0dad" />}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* Mobile address */}
        {locType === 'mobile' && (
          <View>
            <Text style={s.sectionTitle}>Your address</Text>
            <TextInput
              style={s.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Street address, city…"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
            <Pressable
              style={[s.gpsBtn, locating && { opacity: 0.6 }]}
              onPress={useMyLocation}
              disabled={locating}
            >
              {locating
                ? <ActivityIndicator color="#6a0dad" size="small" />
                : <Ionicons name="navigate" size={16} color="#6a0dad" />
              }
              <Text style={s.gpsBtnText}>Use my current location</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          style={[s.nextBtn, !canContinue && s.nextBtnOff]}
          onPress={handleNext}
          disabled={!canContinue}
        >
          <Text style={s.nextBtnText}>Next — Review</Text>
          <Ionicons name="arrow-forward" size={17} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f7f7fb' },
  content: { padding: 20, paddingBottom: 120 },

  typeRow:         { flexDirection: 'row', gap: 12, marginBottom: 24 },
  typeBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, borderWidth: 2, borderColor: '#eee' },
  typeBtnActive:   { borderColor: '#6a0dad', backgroundColor: '#fdf8ff' },
  typeBtnText:     { fontSize: 13, fontWeight: '600', color: '#888' },
  typeBtnTextActive: { color: '#6a0dad' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1f1f1f', marginBottom: 12 },
  hint:         { fontSize: 13, color: '#aaa', fontStyle: 'italic' },

  bayCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }) },
  bayCardSel: { borderColor: '#6a0dad', backgroundColor: '#fdf8ff' },
  bayIconWrap:{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3eafd', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bayBody:    { flex: 1 },
  bayLabel:   { fontSize: 14, fontWeight: '700', color: '#1f1f1f' },
  bayAddr:    { fontSize: 12, color: '#888', marginTop: 1 },

  addressInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', padding: 12, fontSize: 14, minHeight: 72, marginBottom: 12, color: '#1f1f1f' },
  gpsBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#f3eafd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  gpsBtnText: { fontSize: 13, color: '#6a0dad', fontWeight: '600' },

  footer:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, borderTopWidth: 1, borderTopColor: '#f0f0f0', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 6 } }) },
  nextBtn:    { backgroundColor: '#6a0dad', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnOff: { opacity: 0.4 },
  nextBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
});
