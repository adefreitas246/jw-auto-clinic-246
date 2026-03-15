// app/(customer)/vehicles/[id].tsx
// Re-uses the shared AddEditVehicleScreen in "edit" mode
import AddEditVehicleScreen from './_form';
export default function EditVehicleScreen() {
  return <AddEditVehicleScreen mode="edit" />;
}
