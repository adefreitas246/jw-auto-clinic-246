// context/BookingContext.tsx
// Wraps the booking stack and holds wizard draft state across all 7 screens.
import axios from 'axios';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

import { Package, packageDuration, packagePrice, Service } from '@/types/catalog';
import {
  Booking,
  BookingDraft,
  BusinessLocation,
  EMPTY_DRAFT,
  LocationType,
  PaymentMethod,
} from '@/types/booking';
import { Vehicle } from '@/types/vehicle';

interface BookingContextValue {
  draft:           BookingDraft;
  // Wizard step setters
  setVehicle:      (v: Vehicle | null) => void;
  setServices:     (pkg: Package | null, addonQty: Record<string, number>, services: Service[]) => void;
  setDateTime:     (date: string, time: string) => void;
  setLocation:     (type: LocationType, bay?: BusinessLocation | null, address?: string, lat?: number | null, lng?: number | null) => void;
  setPaymentMethod:(m: PaymentMethod) => void;
  setNotes:        (n: string) => void;
  setCoupon:       (code: string, discountAmount: number) => void;
  setReferralCode: (code: string, discountAmount: number) => void;
  clearDiscount:   () => void;
  // API actions
  submitBooking:   () => Promise<{ bookingId: string; paymentUrl: string | null }>;
  confirmPayment:  (reference: string) => Promise<Booking>;
  reset:           () => void;
}

const BookingContext = createContext<BookingContextValue>({} as BookingContextValue);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT);

  const setVehicle = useCallback((v: Vehicle | null) => {
    setDraft(d => ({ ...d, vehicle: v }));
  }, []);

  const setServices = useCallback(
    (pkg: Package | null, addonQty: Record<string, number>, allServices: Service[]) => {
      const pkgTotal    = pkg ? packagePrice(pkg) : 0;
      const pkgDuration = pkg ? packageDuration(pkg) : 0;

      let addonTotal    = 0;
      let addonDuration = 0;
      for (const [id, qty] of Object.entries(addonQty)) {
        if (qty > 0) {
          const svc = allServices.find(s => s._id === id);
          if (svc) {
            addonTotal    += svc.price    * qty;
            addonDuration += svc.duration * qty;
          }
        }
      }

      setDraft(d => ({
        ...d,
        selectedPackage: pkg,
        addonQty,
        totalPrice:      pkgTotal    + addonTotal,
        durationMinutes: pkgDuration + addonDuration,
      }));
    },
    []
  );

  const setDateTime = useCallback((date: string, time: string) => {
    setDraft(d => ({ ...d, appointmentDate: date, appointmentTime: time }));
  }, []);

  const setLocation = useCallback(
    (type: LocationType, bay?: BusinessLocation | null, address?: string, lat?: number | null, lng?: number | null) => {
      setDraft(d => ({
        ...d,
        locationType:  type,
        bay:           bay   ?? d.bay,
        mobileAddress: address ?? d.mobileAddress,
        mobileLat:     lat   ?? d.mobileLat,
        mobileLng:     lng   ?? d.mobileLng,
      }));
    },
    []
  );

  const setPaymentMethod = useCallback((m: PaymentMethod) => {
    setDraft(d => ({ ...d, paymentMethod: m }));
  }, []);

  const setNotes = useCallback((n: string) => {
    setDraft(d => ({ ...d, notes: n }));
  }, []);

  const setCoupon = useCallback((code: string, discountAmount: number) => {
    setDraft(d => ({
      ...d,
      couponCode:     code,
      referralCode:   '',
      discountAmount,
      couponValid:    true,
    }));
  }, []);

  const setReferralCode = useCallback((code: string, discountAmount: number) => {
    setDraft(d => ({
      ...d,
      referralCode:   code,
      couponCode:     '',
      discountAmount,
      couponValid:    discountAmount > 0,
    }));
  }, []);

  const clearDiscount = useCallback(() => {
    setDraft(d => ({
      ...d,
      couponCode:    '',
      referralCode:  '',
      discountAmount: 0,
      couponValid:   false,
    }));
  }, []);

  const submitBooking = useCallback(async (): Promise<{ bookingId: string; paymentUrl: string | null }> => {
    const d = draft; // snapshot

    const pkg = d.selectedPackage;
    const addonServiceIds: string[]   = [];
    const addonServiceNames: string[] = [];

    // Note: the consumer passes `allServices` via setServices, but at submit time
    // we reconstruct names from the stored addonQty keys. The server validates ids.
    for (const [id, qty] of Object.entries(d.addonQty)) {
      if (qty > 0) {
        for (let i = 0; i < qty; i++) addonServiceIds.push(id);
      }
    }

    const serviceLabel =
      [pkg?.name, addonServiceIds.length ? `+ ${addonServiceIds.length} add-on(s)` : null]
        .filter(Boolean)
        .join(' ') || 'Custom Service';

    const payload = {
      vehicleId:    d.vehicle?._id ?? null,
      vehicleLabel: d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}${d.vehicle.licensePlate ? ` · ${d.vehicle.licensePlate}` : ''}` : '',
      packageId:    pkg?._id ?? null,
      packageName:  pkg?.name ?? '',
      addonServiceIds,
      addonServiceNames,
      serviceLabel,
      totalPrice:      d.totalPrice - d.discountAmount,
      durationMinutes: d.durationMinutes,
      appointmentDate: d.appointmentDate,
      appointmentTime: d.appointmentTime,
      locationType:    d.locationType,
      bayLabel:        d.bay?.label    ?? '',
      bayAddress:      d.bay?.address  ?? '',
      mobileAddress:   d.mobileAddress,
      mobileLat:       d.mobileLat,
      mobileLng:       d.mobileLng,
      paymentMethod:   d.paymentMethod,
      notes:           d.notes,
      couponCode:      d.couponCode   || undefined,
      referralCode:    d.referralCode || undefined,
    };

    const res = await axios.post<{ booking: Booking; paymentUrl: string | null }>('/api/bookings', payload);
    const { booking, paymentUrl } = res.data;

    setDraft(prev => ({ ...prev, bookingId: booking._id, paymentUrl }));
    return { bookingId: booking._id, paymentUrl };
  }, [draft]);

  const confirmPayment = useCallback(async (reference: string): Promise<Booking> => {
    const { bookingId } = draft;
    if (!bookingId) throw new Error('No active booking to confirm.');
    const res = await axios.patch<Booking>(`/api/bookings/${bookingId}/confirm`, { paymentReference: reference });
    return res.data;
  }, [draft]);

  const reset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
  }, []);

  return (
    <BookingContext.Provider value={{
      draft,
      setVehicle, setServices, setDateTime, setLocation,
      setPaymentMethod, setNotes,
      setCoupon, setReferralCode, clearDiscount,
      submitBooking, confirmPayment, reset,
    }}>
      {children}
    </BookingContext.Provider>
  );
}

export const useBooking = () => useContext(BookingContext);
