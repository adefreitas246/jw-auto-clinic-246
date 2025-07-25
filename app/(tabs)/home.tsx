import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Modal from 'react-native-modal';
import Animated, { FadeInLeft, FadeInRight, FadeInUp } from 'react-native-reanimated';

interface Transaction {
  _id: string;
  serviceType: string;
  originalPrice: number;
  serviceDate: string;
  paymentMethod: string;
  employeeName?: string;
  vehicleDetails?: string;
  customerName?: string;
  notes?: string;
  customer?: {
    _id: string;
    name: string;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  hourlyRate?: number;
  clockedIn: boolean;
  avatarUrl?: string;
}

interface Shift {
  employee: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  hours?: string;
  status: string;
}

export default function HomeScreen() {
  const [selectedTab, setSelectedTab] = useState<'Transactions' | 'Employees' | 'Shifts' | 'Reports'>('Transactions');
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(width - 40, 320);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  
  const allTabs = ['Transactions', 'Employees', 'Shifts', 'Reports'];

  const visibleTabs = allTabs.filter((tab) => {
    if (['Employees', 'Shifts', 'Reports'].includes(tab)) {
      return user?.role === 'admin';
    }
    return true;
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('http://192.168.1.29:5000/api/transactions', {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      });
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const [employees, setEmployees] = useState<Employee[]>([]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('http://192.168.1.29:5000/api/employees', {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      });
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  }, [user]);


  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [clockedInFilter, setClockedInFilter] = useState<boolean | null>(null);

  const filteredEmployees = employees.filter(emp => {
    const matchRole = roleFilter ? emp.role === roleFilter : true;
    const matchClocked = clockedInFilter !== null ? emp.clockedIn === clockedInFilter : true;
    return matchRole && matchClocked;
  });


  const handleEditEmployee = (emp: Employee) => {
    // Open modal or navigate to edit screen with emp._id
    console.log('Edit:', emp);
  };
  
  const handleDeleteEmployee = async (id: string) => {
    try {
      const res = await fetch(`http://192.168.1.29:5000/api/employees/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (res.ok) {
        setEmployees(prev => prev.filter(e => e._id !== id));
      } else {
        console.error('Failed to delete');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };  


  const handleClockInOut = async (emp: Employee) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString();
  
    try {
      if (!emp.clockedIn) {
        // Clock In: Create a new shift
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
        // Clock Out: Find active shift
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
  
      // Toggle employee clockedIn state
      await fetch(`http://192.168.1.29:5000/api/employees/${emp._id}/clock`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
  
      // Refresh
      fetchEmployees();
      fetchShifts();
    } catch (err) {
      console.error('Clock in/out error:', err);
    }
  };
  


  const [shifts, setShifts] = useState<any[]>([]);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch('http://192.168.1.29:5000/api/shifts', {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setShifts(data);
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
    }
  }, [user]);

 
  useFocusEffect(
    useCallback(() => {
      fetchData();
      fetchEmployees();
      fetchShifts();
    }, [fetchData, fetchEmployees, fetchShifts])
  );


  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalServices: 0,
    totalEmployees: 0,
    activeNow: 0,
    todayRevenue: 0,
    todayServices: 0,
    todayClockedIn: 0,
    todayTransactions: 0,
  });
  
  useEffect(() => {
    let interval: number;
  
    if (selectedTab === 'Reports') {
      fetchReportData(); // Initial fetch
      interval = setInterval(() => {
        fetchReportData();
      }, 60000); // Refresh every 60 seconds
    }
  
    return () => clearInterval(interval);
  }, [selectedTab]);
  
  
  const fetchReportData = async () => {
    try {
      const res = await fetch('http://192.168.1.29:5000/api/reports/dashboard', {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    }
  };
  

  const earnings = transactions.reduce((sum, tx) => sum + Number(tx.originalPrice || 0), 0);
  const today = new Date().toISOString().split('T')[0];
  const todayEarnings = transactions
    .filter(tx => tx.serviceDate?.startsWith(today))
    .reduce((sum, tx) => sum + Number(tx.originalPrice || 0), 0);

  const recent = [...transactions]
    .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
    .slice(0, 10);

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const total = transactions
      .filter(tx => new Date(tx.serviceDate).getMonth() + 1 === month)
      .reduce((sum, tx) => sum + Number(tx.originalPrice || 0), 0);
    return { month: `${month}`.padStart(2, '0'), earnings: total };
  });

  
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [moreActionsVisible, setMoreActionsVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'rate'>('name');

  const openModal = (tx: Transaction) => {
    setSelectedTx(tx);
    setTransactionModalVisible(true);
  };

  const closeModal = () => {
    setTransactionModalVisible(false);
    setSelectedTx(null);
  };


  const handleLongPress = (emp: Employee) => {
    setSelectedEmployee(emp);
    setMoreActionsVisible(true); // triggers Modal
  };  

  const showToast = (message: string) => {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    // or custom component using Animated
  };  

  const searchedEmployees = filteredEmployees.filter(emp =>
    emp.name.toLowerCase().includes(searchText.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchText.toLowerCase())
  );  

  const sortedEmployees = [...searchedEmployees].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'role') return a.role.localeCompare(b.role);
    if (sortBy === 'rate') return (a.hourlyRate || 0) - (b.hourlyRate || 0);
    return 0;
  });  


  const [statusFilter, setStatusFilter] = useState<'Active' | 'Completed' | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftModalVisible, setShiftModalVisible] = useState(false);
  const [shiftSortBy, setShiftSortBy] = useState<'name' | 'status' | null>('name');

  const filteredShifts = shifts.filter(shift =>
    statusFilter ? shift.status === statusFilter : true
  );
  
  const sortedShifts = [...filteredShifts].sort((a, b) => {
    if (shiftSortBy === 'name') return a.employee.localeCompare(b.employee);
    if (shiftSortBy === 'status') return a.status.localeCompare(b.status);
    return 0;
  });
  
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        {/* <Ionicons name="menu" size={24} color="#6a0dad" /> */}
        <Text style={styles.logo}>Dashboard</Text>
        {/* <Ionicons name="person-circle-outline" size={35} color="#6a0dad" /> */}
      </View>

      <View style={styles.filters}>
        {visibleTabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={selectedTab === tab ? styles.filterActive : styles.filter}
            onPress={() => setSelectedTab(tab as any)}
          >
            <Text style={selectedTab === tab ? styles.filterTextActive : styles.filterText}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedTab === 'Transactions' && (
        <>
          {user?.role === 'admin' && (
            <View style={styles.summaryRow}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Total Earned Today</Text>
                <Text style={styles.cardAmount}>${(todayEarnings || 0).toFixed(2)}</Text>
                <Text style={styles.cardSub}>Updated live</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Total Earnings</Text>
                <Text style={styles.cardAmount}>${(earnings || 0).toFixed(2)}</Text>
                <Text style={styles.cardSub}>{transactions?.length || 0} transactions</Text>
              </View>
            </View>
          )}

          {user?.role === 'admin' && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Monthly Earnings</Text>
              <BarChart
                data={{
                  labels: chartData.map(item => item.month),
                  datasets: [
                    { data: chartData.map(item => item.earnings || 0) },
                  ],
                }}
                width={chartWidth}
                height={220}
                fromZero
                yAxisLabel="$"
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 2,
                  color: (opacity = 1) => `rgba(106, 13, 173, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForBackgroundLines: { strokeDasharray: '' },
                }}
                style={{ borderRadius: 16 }}
              />
            </View>
          )}

          <View style={styles.recentCard}>
            <Text style={styles.recentTitle}>Recent Transactions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
                {recent.map((tx, index) => (
                  <Animated.View
                    key={tx._id}
                    entering={FadeInRight.delay(index * 100)} // Staggered entrance
                    style={styles.transactionCard}
                  >
                    <TouchableOpacity onPress={() => openModal(tx)} activeOpacity={0.8}>
                      <Text style={styles.txService}>{tx.serviceType}</Text>

                      <View style={styles.txRow}>
                        <Text style={styles.txLabel}>Amount:</Text>
                        <Text style={styles.txValue}>
                          ${typeof tx.originalPrice === 'number' ? tx.originalPrice.toFixed(2) : '0.00'}
                        </Text>
                      </View>

                      <View style={styles.txRow}>
                        <Text style={styles.txLabel}>Payment:</Text>
                        <Text style={styles.txValue}>{tx.paymentMethod}</Text>
                      </View>

                      <View style={styles.txRow}>
                        <Text style={styles.txLabel}>Customer:</Text>
                        <Text style={styles.txValue}>
                          {tx.customer?.name || tx.customerName || 'N/A'}
                        </Text>
                      </View>

                      <View style={styles.txRow}>
                        <Text style={styles.txLabel}>Date:</Text>
                        <Text style={styles.txValue}>
                          {tx.serviceDate ? new Date(tx.serviceDate).toLocaleDateString() : '—'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}


      <Modal
        isVisible={transactionModalVisible}
        onBackdropPress={closeModal}
        backdropOpacity={0.4}
        style={{ margin: 0, justifyContent: 'center', alignItems: 'center' }}
      >
        {selectedTx && (
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedTx.serviceType}</Text>

            <Text style={styles.modalLine}>Amount: ${selectedTx.originalPrice.toFixed(2)}</Text>
            <Text style={styles.modalLine}>Payment: {selectedTx.paymentMethod}</Text>
            <Text style={styles.modalLine}>Customer: {selectedTx.customer?.name || selectedTx.customerName}</Text>
            <Text style={styles.modalLine}>
              Date: {new Date(selectedTx.serviceDate).toLocaleDateString()}
            </Text>

            {selectedTx.notes && (
              <Text style={[styles.modalLine, { marginTop: 8 }]}>
                Notes: {selectedTx.notes}
              </Text>
            )}

            <TouchableOpacity style={styles.modalButton} onPress={closeModal}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
      

      {selectedTab === 'Employees' && (
        <View style={styles.recentCard}>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'All Roles', value: null, filter: roleFilter, setter: setRoleFilter },
                { label: 'Admin', value: 'admin', filter: roleFilter, setter: setRoleFilter },
                { label: 'Staff', value: 'staff', filter: roleFilter, setter: setRoleFilter },
                { label: 'All', value: null, filter: clockedInFilter, setter: setClockedInFilter },
                { label: 'Clocked In', value: true, filter: clockedInFilter, setter: setClockedInFilter },
                { label: 'Clocked Out', value: false, filter: clockedInFilter, setter: setClockedInFilter },
              ].map(({ label, value, filter, setter }, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setter(value as any)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    backgroundColor: filter === value ? '#6a0dad' : '#eee',
                  }}
                >
                  <Text style={{ color: filter === value ? '#fff' : '#444', fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.recentTitle}>Employee List</Text>
            <TextInput
              placeholder="Search by name or email"
              value={searchText}
              onChangeText={setSearchText}
              style={styles.searchBox}
            />

            

            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={{ minWidth: 800 }}>
              {/* <DropDownPicker
                  open={sortOpen}
                  value={sortBy}
                  items={[
                    { label: 'Name', value: 'name' },
                    { label: 'Role', value: 'role' },
                    { label: 'Rate', value: 'rate' },
                  ]}
                  setOpen={setSortOpen}
                  setValue={setSortBy}
                  placeholder="Sort by..."
                  style={styles.dropdown}
                  dropDownContainerStyle={styles.dropdownContainer}
                /> */}
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: '#f3f3f3' }]}>
                <Text style={[styles.columnHeader, { width: 60 }]}></Text>
                <Text style={[styles.columnHeader, { width: 140 }]}>Name</Text>
                <Text style={[styles.columnHeader, { width: 200 }]}>Email</Text>
                <Text style={[styles.columnHeader, { width: 140 }]}>Phone</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>Role</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>Rate</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>Clocked In</Text>
                <Text style={[styles.columnHeader, { width: 80 }]}></Text>
              </View>
          
              {sortedEmployees.map((emp, index) => (
                <Animated.View key={emp._id} entering={FadeInUp.delay(index * 40)}>
                  <Pressable onLongPress={() => handleLongPress(emp)}>
                    <View style={[styles.tableRow, { alignItems: 'center', paddingVertical: 12, borderBottomColor: '#eee', borderBottomWidth: 1 }]}>
                      <Animated.View entering={FadeInLeft.delay(index * 40)}>
                        {emp.avatarUrl ? (
                          <Image source={{ uri: emp.avatarUrl }} style={styles.avatar} />
                        ) : (
                          <Ionicons name="person-circle-outline" size={32} color="#ccc" />
                        )}
                      </Animated.View>

                      <Text style={[styles.cell, { width: 140, fontWeight: '600' }]}>{emp.name}</Text>
                      <Text style={[styles.cell, { width: 200 }]}>{emp.email}</Text>
                      <Text style={[styles.cell, { width: 140 }]}>{emp.phone}</Text>
                      <Text style={[styles.cell, { width: 100, color: emp.role === 'admin' ? '#6a0dad' : '#555', fontWeight: '600' }]}>
                        {emp.role}
                      </Text>
                      <Text style={[styles.cell, { width: 100 }]}>
                        {emp.hourlyRate ? `$${emp.hourlyRate.toFixed(2)}` : '—'}
                      </Text>
                      <Text style={[styles.cell, { width: 100, fontSize: 16 }]}>
                        {emp.clockedIn ? '✅' : '❌'}
                      </Text>

                      <View style={{ flexDirection: 'row', width: 80, justifyContent: 'center' }}>
                        <TouchableOpacity onPress={() => handleEditEmployee(emp)} style={{ marginHorizontal: 6 }}>
                          <Ionicons name="create-outline" size={20} color="#6a0dad" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            handleDeleteEmployee(emp._id);
                            showToast('Employee deleted');
                          }}>
                          <Ionicons name="trash-outline" size={20} color="red" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              ))} 

              </View>
            </ScrollView>
        </View>
      
      )}

      <Modal isVisible={moreActionsVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Actions for {selectedEmployee?.name}</Text>
            <TouchableOpacity onPress={() => { /* view profile */ }}>
              <Text style={styles.modalItem}>View Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { /* reset password */ }}>
              <Text style={styles.modalItem}>Reset Password</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMoreActionsVisible(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      

      {selectedTab === 'Shifts' && (
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent Shifts</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 800 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              {/* Filter */}
              {['All', 'Active', 'Completed'].map(status => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setStatusFilter(status === 'All' ? null : status as 'Active' | 'Completed')}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: statusFilter === status ? '#6a0dad' : '#eee',
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ color: statusFilter === status ? '#fff' : '#444' }}>{status}</Text>
                </TouchableOpacity>
              ))}
              {/* Sort */}
              {(['name', 'status'] as const).map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setShiftSortBy(shiftSortBy === key ? null : key)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: shiftSortBy === key ? '#6a0dad' : '#eee',
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ color: shiftSortBy === key ? '#fff' : '#444' }}>Sort by {key}</Text>
                </TouchableOpacity>
              ))}
            </View>

              {/* Table Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.columnHeader, { width: 140 }]}>Employee</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>Date</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>Clock In</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>Clock Out</Text>
                <Text style={[styles.columnHeader, { width: 80 }]}>Hours</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>Status</Text>
              </View>

              {/* Animated Rows */}
              {sortedShifts.map((shift, index) => (
                <TouchableOpacity
                    key={index}
                    onPress={() => {
                      setSelectedShift({
                        employee: shift.employee,
                        date: shift.date,
                        clockIn: shift.clockIn,
                        clockOut: shift.clockOut,
                        hours: shift.hours,
                        status: shift.status,
                      });
                      setShiftModalVisible(true);
                    }}
                  >
                  <Animated.View
                    entering={FadeInUp.delay(index * 50)}
                    style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#fff' }]}
                  >
                    <Text style={[styles.cell, { width: 140, fontWeight: '600' }]}>{shift.employee}</Text>
                    <Text style={[styles.cell, { width: 100 }]}>{shift.date}</Text>
                    <Text style={[styles.cell, { width: 100 }]}>{shift.clockIn}</Text>
                    <Text style={[styles.cell, { width: 100 }]}>{shift.clockOut || '—'}</Text>
                    <Text style={[styles.cell, { width: 80 }]}>
                      {isNaN(parseFloat(shift.hours)) ? '—' : parseFloat(shift.hours).toFixed(2)}
                    </Text>
                    <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 18 }}>
                        {shift.status === 'Active' ? '🟢' : '🔴'}
                      </Text>
                      <Text style={styles.statusText}>{shift.status}</Text>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}


      <Modal isVisible={shiftModalVisible} onBackdropPress={() => setShiftModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Shift Details</Text>
            <Text>Employee: {selectedShift?.employee}</Text>
            <Text>Date: {selectedShift?.date}</Text>
            <Text>Clock In: {selectedShift?.clockIn}</Text>
            <Text>Clock Out: {selectedShift?.clockOut || '—'}</Text>
            <Text>Hours: {selectedShift?.hours || '—'}</Text>
            <Text>Status: {selectedShift?.status}</Text>
            <TouchableOpacity onPress={() => setShiftModalVisible(false)} style={{ marginTop: 16 }}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {selectedTab === 'Reports' && (
        <ScrollView contentContainerStyle={styles.reportsContainer}>
          <View style={styles.reportCards}>
            <View style={styles.reportCard}>
              <Text style={styles.cardLabel}>💰</Text>
              <Text style={styles.cardValue}>${reportData.totalRevenue.toFixed(2)}</Text>
              <Text style={styles.cardTitle}>Total Revenue</Text>
            </View>

            <View style={styles.reportCard}>
              <Text style={styles.cardLabel}>🚗</Text>
              <Text style={styles.cardValue}>{reportData.totalServices}</Text>
              <Text style={styles.cardTitle}>Total Services</Text>
            </View>

            <View style={styles.reportCard}>
              <Text style={styles.cardLabel}>👥</Text>
              <Text style={styles.cardValue}>{reportData.totalEmployees}</Text>
              <Text style={styles.cardTitle}>Total Employees</Text>
            </View>

            <View style={styles.reportCard}>
              <Text style={styles.cardLabel}>🕒</Text>
              <Text style={styles.cardValue}>{reportData.activeNow}</Text>
              <Text style={styles.cardTitle}>Active Now</Text>
            </View>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.performanceTitle}>Today's Performance</Text>

            <View style={styles.performanceRow}>
              <View>
                <Text style={styles.performanceSubTitle}>Revenue</Text>
                <Text style={styles.performanceValue}>${reportData.todayRevenue.toFixed(2)}</Text>
                <Text style={styles.performanceNote}>from {reportData.todayTransactions} transactions</Text>
              </View>

              <View style={styles.performanceColumn}>
                <Text style={styles.performanceSubTitle}>Activity</Text>
                <Text style={styles.performanceItem}>Services Completed: {reportData.todayServices}</Text>
                <Text style={styles.performanceItem}>Staff on Duty: {reportData.todayClockedIn}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logo: { fontSize: 20, fontWeight: 'bold', color: '#6a0dad', marginTop: 40, },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filter: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  filterActive: { backgroundColor: '#efdbff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  filterText: { color: '#555', fontSize: 13 },
  filterTextActive: { color: '#6a0dad', fontWeight: '600', fontSize: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  card: { flex: 1, backgroundColor: '#fafafa', borderRadius: 12, padding: 12, elevation: 1 },
  cardTitle: { color: '#666', fontSize: 13 },
  cardAmount: { fontSize: 22, fontWeight: 'bold', color: '#6a0dad', marginTop: 4 },
  cardSub: { fontSize: 12, color: '#999' },
  chartCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, marginBottom: 20 },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  // recentCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16 },
  // recentTitle: { fontSize: 16, fontWeight: '600', color: '#6a0dad', marginBottom: 12 },
  columnHeader: { fontWeight: '700', color: '#555', fontSize: 12 },
  cell: { fontSize: 12, color: '#333' },
  tableRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tableHeader: { borderBottomWidth: 1, borderColor: '#ccc', paddingBottom: 6, marginBottom: 10 },
  placeholderCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 150,
  },
  placeholderText: {
    fontSize: 14,
    color: '#777',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  statusActive: {
    backgroundColor: '#d2f7e3',
  },
  statusCompleted: {
    backgroundColor: '#eee',
  },
  performanceCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  
  performanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
    color: '#333',
  },
  
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  performanceColumn: {
    alignItems: 'flex-end',
  },
  
  performanceSubTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  
  performanceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a4ed8',
  },
  
  performanceNote: {
    fontSize: 12,
    color: '#888',
  },
  
  performanceItem: {
    fontSize: 14,
    marginBottom: 2,
    color: '#333',
  },
  
  // Add missing report styles
  reportsContainer: {
    padding: 20,
    backgroundColor: '#fff',
    paddingBottom: 100,
  },
  
  reportCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  
  reportCard: {
    width: '47%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  cardLabel: {
    fontSize: 24,
  },
  
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 6,
    color: '#333',
  },  
  refreshButton: {
  alignSelf: 'flex-start',
  marginTop: -10,
  marginBottom: 10,
  backgroundColor: '#e1e1ff',
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 8,
},

refreshText: {
  color: '#4b3ca6',
  fontWeight: '600',
},

recentCard: {
  marginTop: 20,
  paddingHorizontal: 16,
},

recentTitle: {
  fontSize: 18,
  fontWeight: '700',
  marginBottom: 12,
  color: '#333',
},

transactionCard: {
  backgroundColor: '#fff',
  padding: 16,
  borderRadius: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
  width: 250,
  marginRight: 12,
},

txService: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 8,
  color: '#6a0dad',
},

txRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 4,
},

txLabel: {
  fontSize: 14,
  color: '#888',
},

txValue: {
  fontSize: 14,
  fontWeight: '600',
  color: '#222',
},

modalCard: {
  backgroundColor: '#fff',
  padding: 24,
  borderRadius: 20,
  width: '85%',
  alignItems: 'flex-start',
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 10,
},

modalTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#6a0dad',
  marginBottom: 12,
},

modalLine: {
  fontSize: 15,
  marginVertical: 2,
  color: '#333',
},

modalButton: {
  marginTop: 16,
  alignSelf: 'center',
  backgroundColor: '#6a0dad',
  paddingHorizontal: 24,
  paddingVertical: 10,
  borderRadius: 12,
},

modalButtonText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 16,
},
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#eee',
  },
  searchBox: {
    backgroundColor: '#f3f3f3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    //backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalItem: {
    paddingVertical: 10,
    fontSize: 16,
  },
  modalClose: {
    marginTop: 10,
    fontWeight: '600',
    color: '#6a0dad',
    textAlign: 'center',
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
  
  
});
