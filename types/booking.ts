// types/booking.ts
import { Package, Service } from './catalog';
import { Vehicle } from './vehicle';

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
export type LocationType  = 'bay' | 'mobile';
export type PaymentMethod = 'wipay' | 'bimpay' | 'cash';

export interface TimeSlot {
  time:      string;   // "HH:MM"
  available: boolean;
}

export interface BusinessLocation {
  label:   string;
  address: string;
  lat?:    number;
  lng?:    number;
  phone?:  string;
}

export interface Booking {
  _id:              string;
  businessId:       string;
  userId:           string;
  customerId:       string;
  vehicleId?:       string | null;
  vehicleLabel:     string;
  packageId?:       string | null;
  packageName:      string;
  addonServiceIds:  string[];
  addonServiceNames: string[];
  serviceLabel:     string;
  totalPrice:       number;
  durationMinutes:  number;
  appointmentDate:  string;  // YYYY-MM-DD
  appointmentTime:  string;  // HH:MM
  locationType:     LocationType;
  bayLabel:         string;
  bayAddress:       string;
  mobileAddress:    string;
  mobileLat?:       number | null;
  mobileLng?:       number | null;
  status:           BookingStatus;
  paymentMethod:    PaymentMethod;
  paymentReference: string;
  paidAt?:          string | null;
  expoPushToken:    string;
  reminderScheduled: boolean;
  notes:            string;
  createdAt:        string;
  updatedAt:        string;
}

// ─── Booking draft — shared state across the 7-step wizard ───────────────────
export interface BookingDraft {
  // Step 1 — Vehicle
  vehicle: Vehicle | null;

  // Step 2 — Services
  selectedPackage: Package | null;
  addonQty:        Record<string, number>;  // serviceId → qty
  totalPrice:      number;
  durationMinutes: number;

  // Step 3 — Date & time
  appointmentDate: string;   // YYYY-MM-DD
  appointmentTime: string;   // HH:MM

  // Step 4 — Location
  locationType:  LocationType;
  bay:           BusinessLocation | null;
  mobileAddress: string;
  mobileLat:     number | null;
  mobileLng:     number | null;

  // Step 5+ — Extras
  paymentMethod: PaymentMethod;
  notes:         string;

  // Coupon / referral discount applied at review step
  couponCode:      string;
  referralCode:    string;
  discountAmount:  number;
  couponValid:     boolean;

  // Set after POST /api/bookings
  bookingId:  string | null;
  paymentUrl: string | null;
}

export const EMPTY_DRAFT: BookingDraft = {
  vehicle:         null,
  selectedPackage: null,
  addonQty:        {},
  totalPrice:      0,
  durationMinutes: 30,
  appointmentDate: '',
  appointmentTime: '',
  locationType:    'bay',
  bay:             null,
  mobileAddress:   '',
  mobileLat:       null,
  mobileLng:       null,
  paymentMethod:   'wipay',
  notes:           '',
  couponCode:      '',
  referralCode:    '',
  discountAmount:  0,
  couponValid:     false,
  bookingId:       null,
  paymentUrl:      null,
};
