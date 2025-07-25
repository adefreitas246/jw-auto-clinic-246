import { useAuth } from '@/context/AuthContext';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';

interface Employee {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  hourlyRate?: number;
  clockedIn: boolean;
}

export default function EmployeesScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [role, setRole] = useState('Staff');
  const [openRole, setOpenRole] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('http://192.168.1.29:5000/api/employees', {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error('Error fetching employees', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleAddEmployee = async () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }
  
    try {
      const res = await fetch('http://192.168.1.29:5000/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          role,
          hourlyRate: hourlyRate ? parseFloat(hourlyRate) : 0,
          password: '', // 👈 required to trigger default in Mongoose schema
        }),
      });
  
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Failed to add employee');
      }
  
      // Refresh list and reset form
      fetchEmployees();
      setName('');
      setEmail('');
      setPhone('');
      setRole('Staff');
      setHourlyRate('');
    } catch (err) {
      console.error(err);
      alert('Error adding employee');
    }
  };
  
  

  const handleClockInOut = async (emp: Employee) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString();

    try {
      if (!emp.clockedIn) {
        await fetch('http://192.168.1.29:5000/api/shifts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            employee: emp.name,
            date: dateStr,
            clockIn: timeStr,
          }),
        });
      } else {
        const res = await fetch(`http://192.168.1.29:5000/api/shifts/last/${emp.name}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        const activeShift = await res.json();

        const clockInTime = new Date(`1970-01-01T${activeShift.clockIn}`);
        const hoursWorked = ((now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

        await fetch(`http://192.168.1.29:5000/api/shifts/${activeShift._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            clockOut: timeStr,
            hours: hoursWorked,
            status: 'Completed',
          }),
        });
      }

      await fetch(`http://192.168.1.29:5000/api/employees/${emp._id}/clock`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      fetchEmployees();
    } catch (err) {
      console.error('Clock error:', err);
      alert('Clock in/out failed');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <FlatList
        data={employees}
        keyExtractor={(item) => item._id}
        numColumns={isWide ? 3 : 1}
        columnWrapperStyle={isWide ? { gap: 10, justifyContent: 'flex-start' } : undefined}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>Add New Employee</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>Role</Text>
            <View style={{ zIndex: 3000 }}>
              <DropDownPicker
                open={openRole}
                value={role}
                items={[{ label: 'Admin', value: 'admin' }, { label: 'Staff', value: 'staff' }]}
                setOpen={setOpenRole}
                setValue={setRole}
                placeholder="Select Role"
                style={styles.dropdown}
                dropDownContainerStyle={styles.dropdownContainer}
              />
            </View>

            <Text style={styles.label}>Hourly Rate</Text>
            <TextInput
              style={styles.input}
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
              placeholder="Optional"
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddEmployee}>
              <Text style={styles.submitText}>Add Employee</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Employees</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.employeeCard}>
            <Text style={styles.employeeName}>{item.name}</Text>
            <Text style={styles.employeeInfo}>{item.email}</Text>
            <Text style={styles.employeeInfo}>{item.phone}</Text>
            <Text style={styles.employeeInfo}>{item.role}</Text>
            {item.hourlyRate !== undefined && (
              <Text style={styles.employeeInfo}>{`$${item.hourlyRate.toFixed(2)}/hour`}</Text>
            )}
            <TouchableOpacity
              style={[
                styles.clockButton,
                { backgroundColor: item.clockedIn ? '#ccc' : '#28a745' },
              ]}
              onPress={() => handleClockInOut(item)}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {item.clockedIn ? 'Clock Out' : 'Clock In'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ padding: 20, paddingBottom: 100, backgroundColor: '#fff' }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 40, marginBottom: 10, color: '#6a0dad' },
  label: { marginTop: 10, marginBottom: 4, color: '#333', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  dropdownContainer: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#fafafa',
  },
  submitButton: {
    backgroundColor: '#6a0dad',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  employeeCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 16,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginHorizontal: 5,
  },
  employeeName: { fontWeight: 'bold', fontSize: 16, color: '#6a0dad', marginBottom: 4 },
  employeeInfo: { fontSize: 14, color: '#333', marginBottom: 2 },
  clockButton: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
});
