// app/(customer)/vehicles/add.tsx
// Re-uses the shared AddEditVehicleScreen in "add" mode
import AddEditVehicleScreen from './_form';
export default function AddVehicleScreen() {
  return <AddEditVehicleScreen mode="add" />;
}
