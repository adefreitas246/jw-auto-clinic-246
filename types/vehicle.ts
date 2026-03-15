// types/vehicle.ts
export type VehicleSize = 'Sedan' | 'SUV' | 'Truck' | 'Van' | 'Other';

export interface Vehicle {
  _id: string;
  userId: string;
  businessId: string;
  make: string;
  model: string;
  licensePlate: string;
  color: string;
  size: VehicleSize;
  notes: string;
  platePhotoUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleForm {
  make: string;
  model: string;
  licensePlate: string;
  color: string;
  size: VehicleSize;
  notes: string;
  platePhotoUrl: string;
}

export const VEHICLE_SIZES: VehicleSize[] = ['Sedan', 'SUV', 'Truck', 'Van', 'Other'];

export const EMPTY_VEHICLE_FORM: VehicleForm = {
  make: '',
  model: '',
  licensePlate: '',
  color: '',
  size: 'Sedan',
  notes: '',
  platePhotoUrl: '',
};
