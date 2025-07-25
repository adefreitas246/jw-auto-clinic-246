import { useAuth } from '@/context/AuthContext';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import DropDownPicker from 'react-native-dropdown-picker';


export default function TransactionsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'transaction' | 'management'>('transaction');

  const [serviceType, setServiceType] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [openService, setOpenService] = useState(false);
  const [openPayment, setOpenPayment] = useState(false);

  const [originalPrice, setOriginalPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [specials, setSpecials] = useState<any>(null);
  const [openSpecials, setOpenSpecials] = useState(false);
  const [notes, setNotes] = useState('');

  const [newService, setNewService] = useState('');
  const [newSpecial, setNewSpecial] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newSpecialPrice, setNewSpecialPrice] = useState('');

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    let parsedOriginal = parseFloat(originalPrice) || 0;
    let percent = 0;

    setDiscountPercent(percent.toString());

    const amount = parsedOriginal * (percent / 100);
    setDiscountAmount(amount.toFixed(2));
    const final = parsedOriginal - amount;
    setFinalPrice(final.toFixed(2));
  }, [originalPrice, specials]);


  const validateTransactionForm = () => {
    if (!serviceTypeId) {
      alert('Missing Info, Please select a service type.');
      return false;
    }
    if (!originalPrice || isNaN(Number(originalPrice))) {
      alert('Invalid Price, Please enter a valid original price.');
      return false;
    }
    if (!paymentMethod) {
      alert('Missing Info, Please select a payment method.');
      return false;
    }
    if (!customerName.trim()) {
      alert('Missing Info, Please enter the customer name.');
      return false;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      alert('Invalid Email, Please enter a valid email address.');
      return false;
    }
    if (!specialsId) {
      alert('Missing Info, Please enter vehicle details.');
      return false;
    }
    if (!vehicleDetails.trim()) {
      alert('Missing Info, Please enter vehicle details.');
      return false;
    }
    return true;
  };
  



  const handleSubmit = async () => {
    if (!validateTransactionForm()) return;

    if (!user?.token) {
      alert('You must be logged in to perform this action.');
      return;
    }

    try {
      const searchRes = await fetch(
        `http://192.168.1.29:5000/api/customers/search?name=${encodeURIComponent(customerName)}&vehicle=${encodeURIComponent(vehicleDetails)}`,
        {
          headers: {
            Authorization: `Bearer ${user!.token}`,
          },
        }
      );

      let customerId;

      if (searchRes.ok) {
        const found = await searchRes.json();
        if (found && found._id) customerId = found._id;
      }

      if (!customerId) {
        const createRes = await fetch('http://192.168.1.29:5000/api/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user!.token}`,
          },
          body: JSON.stringify({ name: customerName, vehicleDetails }),
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || 'Customer creation failed');
        }

        const newCustomer = await createRes.json();
        customerId = newCustomer._id;
      }

      if (!selectedServiceObj?.name && !serviceType) {
        alert('Please select a service type.');
        return;
      }      

      const transactionRes = await fetch('http://192.168.1.29:5000/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user!.token}`,
        },
        body: JSON.stringify({
          serviceType: selectedServiceObj?.name || serviceType,
          originalPrice: parseFloat(originalPrice),
          discountPercent: parseFloat(discountPercent) || 0,
          discountAmount: parseFloat(discountAmount) || 0,
          paymentMethod,
          employeeName,
          vehicleDetails,
          customerName,
          email,
          specials,
          notes,
          customerCode: selectedCustomerId,
          customer: customerId,
          createdBy: user!._id,
        }),
      });

      if (!transactionRes.ok) {
        const err = await transactionRes.json();
        throw new Error(err.error || 'Transaction failed');
      }

      alert('Transaction saved successfully!');
      setServiceType('');
      setOriginalPrice('');
      setPaymentMethod('');
      setEmployeeName('');
      setVehicleDetails('');
      setCustomerName('');
      setEmail('');
      setDiscountPercent('');
      setSpecials('');
      setOpenSpecials(false);
      setNotes('');
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }


    await generateAndShareReceipt({
      customerName,
      vehicleDetails,
      email,
      employeeName: 'JW Auto Clinic 246',
      serviceType: selectedServiceObj?.name ?? serviceType,
      specials: selectedSpecialObj?.name ?? specials,
      paymentMethod,
      originalPrice,
      discountPercent,
      discountAmount,
      finalPrice,
      notes,
    });
    
  };

  const handleSaveService = async () => {
    if (!newService || !newServicePrice) {
      alert("Please enter both service name and price.");
      return;
    }
  
    try {
      const res = await fetch("http://192.168.1.29:5000/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user!.token}`,
        },
        body: JSON.stringify({
          name: newService,
          price: parseFloat(newServicePrice),
        }),
      });
  
      if (!res.ok) throw new Error("Failed to save service");
  
      alert("Service saved!");
      setNewService('');
      setNewServicePrice('');
      fetchServices(); // reload list
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!user?.token) {
      alert('You must be logged in to perform this action.');
      return;
    }
    try {
      const res = await fetch(`http://192.168.1.29:5000/api/services/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user!.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to delete service');
      alert('Service deleted!');
      fetchServices(); // Refresh the list
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditService = (item: { _id: string; name: string; price: number }) => {
    setEditItem(item);
    setEditValue(item.price.toString());
  };


  const [services, setServices] = useState<{ _id: string; name: string; price: number }[]>([]);
  const [specialsList, setSpecialsList] = useState<{ _id: string; name: string; discountPercent: number }[]>([]);
  const [editItem, setEditItem] = useState<{ _id: string; name: string; price?: number; discountPercent?: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchServices = async () => {
    const res = await fetch("http://192.168.1.29:5000/api/services", {
      headers: { Authorization: `Bearer ${user!.token}` },
    });
    const data = await res.json();
    setServices(data);
  };

  const fetchSpecials = async () => {
    const res = await fetch("http://192.168.1.29:5000/api/specials", {
      headers: { Authorization: `Bearer ${user!.token}` },
    });
    const data = await res.json();
    setSpecialsList(data);
  };

  useEffect(() => {
    if (activeTab === 'management') {
      fetchServices();
      fetchSpecials();
    }
  }, [activeTab]);

  
  const handleSaveSpecial = async () => {
    if (!newSpecial || !newSpecialPrice) {
      alert("Please enter both special name and discount %.");
      return;
    }
  
    try {
      const res = await fetch("http://192.168.1.29:5000/api/specials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user!.token}`,
        },
        body: JSON.stringify({
          name: newSpecial,
          discountPercent: parseFloat(newSpecialPrice),
        }),
      });
  
      if (!res.ok) throw new Error("Failed to save special");
  
      alert("Special saved!");
      setNewSpecial('');
      setNewSpecialPrice('');
      fetchSpecials(); // reload list
    } catch (err: any) {
      alert(err.message);
    }
  };
  
  const handleEditSpecial = (item: { _id: string; name: string; discountPercent: number }) => {
    setEditItem(item);
    setEditValue(item.discountPercent.toString());
  };

  const handleDeleteSpecial = async (id: string) => {
    if (!user?.token) {
      alert('You must be logged in to perform this action.');
      return;
    }
    try {
      const res = await fetch(`http://192.168.1.29:5000/api/specials/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user!.token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to delete special');
      alert('Special deleted!');
      fetchSpecials(); // Refresh the list
    } catch (err: any) {
      alert(err.message);
    }
  };


  interface ServiceItem {
    label: string;
    value: string; // _id
    raw: {
      _id: string;
      name: string;
      price: number;
    };
  }
  
  interface SpecialItem {
    label: string;
    value: string; // _id
    raw: {
      _id: string;
      name: string;
      discountPercent: number;
    };
  }
  
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [specialItems, setSpecialItems] = useState<SpecialItem[]>([]);  

  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [specialsId, setSpecialsId] = useState<string | null>(null);

  const selectedServiceObj = serviceItems.find(item => item.value === serviceTypeId)?.raw;
  const selectedSpecialObj = specialItems.find(item => item.value === specialsId)?.raw;

  const [selectedService, setSelectedService] = useState(null);
  const [selectedSpecial, setSelectedSpecial] = useState(null);

  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [servicesRes, specialsRes] = await Promise.all([
          fetch('http://192.168.1.29:5000/api/services'),
          fetch('http://192.168.1.29:5000/api/specials')
        ]);
  
        const servicesData = await servicesRes.json();
        const specialsData = await specialsRes.json();
  
        const serviceOptions = servicesData.map((s: { _id: string; name: string; price: number | { min: number; max: number } | null }) => {
          let displayPrice = 'N/A';
  
          if (typeof s.price === 'number') {
            displayPrice = `$${s.price.toFixed(2)}`;
          } else if (s.price && typeof s.price === 'object' && 'min' in s.price && 'max' in s.price) {
            displayPrice = `$${s.price.min} - $${s.price.max}`;
          }
  
          return {
            label: `${s.name} - ${displayPrice}`,
            value: s._id,
            raw: s
          };
        });
  
        const specialOptions = specialsData.map((s: { _id: string; name: string; discountPercent?: number }) => ({
          label: s.discountPercent != null
            ? `${s.name} - ${s.discountPercent}%`
            : `${s.name}`,
          value: s._id,
          raw: s
        }));
  
        setServiceItems(serviceOptions);
        setSpecialItems(specialOptions);
      } catch (err) {
        console.error('Error fetching services or specials:', err);
      }
    };
  
    fetchDropdownData();
  }, []);
  

  // Automatically set price from selected service
    useEffect(() => {
      if (serviceType) {
        setOriginalPrice(serviceType.price?.toString() ?? '');
      }
    }, [serviceType]);

    useEffect(() => {
      if (selectedServiceObj) {
        setOriginalPrice(selectedServiceObj.price?.toString() ?? '');
      }
    }, [serviceTypeId]);

    // Automatically set discount from selected special
    useEffect(() => {
    if (specials) {
      setDiscountPercent(specials.discountPercent?.toString() ?? '');
    }
  }, [specials]);

  useEffect(() => {
    if (selectedSpecialObj) {
      setDiscountPercent(selectedSpecialObj.discountPercent?.toString() ?? '');
    }
  }, [specialsId]);


  useEffect(() => {
    if (originalPrice && discountPercent) {
      const price = parseFloat(originalPrice);
      const discount = parseFloat(discountPercent);
      const amount = price * (discount / 100);
      setDiscountAmount(amount.toFixed(2));
      setFinalPrice((price - amount).toFixed(2));
    } else {
      setDiscountAmount('0.00');
      setFinalPrice(originalPrice || '0.00');
    }
  }, [originalPrice, discountPercent]);


  const [customerSuggestions, setCustomerSuggestions] = useState<{ _id: string; name: string; email: string; customerCode: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (customerName.trim().length < 2) {
        setCustomerSuggestions([]);
        return;
      }
  
      try {
        const res = await fetch(
          `http://192.168.1.29:5000/api/customers/search?name=${encodeURIComponent(customerName)}`,
          {
            headers: {
              Authorization: `Bearer ${user!.token}`,
            },
          }
        );
  
        const data = await res.json();
        setCustomerSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Customer search failed:', err);
      }
    }, 300);
  
    return () => clearTimeout(delayDebounce);
  }, [customerName]);
  
  

  const [showServices, setShowServices] = useState(true);
  const [showSpecials, setShowSpecials] = useState(true);
  const [serviceSearch, setServiceSearch] = useState('');
  const [specialSearch, setSpecialSearch] = useState('');


  type ReceiptData = {
    customerName: string;
    vehicleDetails: string;
    email: string;
    employeeName: string;
    serviceType: string;
    specials: string;
    paymentMethod: string;
    originalPrice: string;
    discountPercent: string;
    discountAmount: string;
    finalPrice: string;
    notes: string;
  };
  
  async function generateAndShareReceipt(data: ReceiptData) {
    const {
      customerName,
      vehicleDetails,
      email,
      employeeName,
      serviceType,
      specials,
      paymentMethod,
      originalPrice,
      discountPercent,
      discountAmount,
      finalPrice,
      notes,
    } = data;
  
    const now = new Date();
    const date = now.toLocaleString();
  
    let logoBase64 = '';
  
    try {
      const logoAsset = Asset.fromModule(require('@/assets/images/icon.png'));
      await logoAsset.downloadAsync();
  
      if (logoAsset.localUri) {
        logoBase64 = await FileSystem.readAsStringAsync(logoAsset.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        console.warn('⚠️ Logo asset did not load.');
      }
    } catch (e) {
      console.warn('⚠️ Failed to load or encode logo:', e);
    }
  
    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Arial', sans-serif;
              padding: 40px;
              background: #f9f9f9;
              color: #333;
            }
            .header {
              display: flex;
              align-items: center;
              margin-bottom: 40px;
            }
            .logo {
              width: 80px;
              height: auto;
              margin-right: 20px;
            }
            .company-info h1 {
              font-size: 24px;
              color: #6a0dad;
              margin: 0;
            }
            .company-info p {
              margin: 4px 0;
              font-size: 14px;
              color: #666;
            }
            .card {
              background: #ffffff;
              border-radius: 8px;
              padding: 24px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.05);
            }
            .section-title {
              font-size: 18px;
              margin-bottom: 10px;
              color: #6a0dad;
              border-bottom: 1px solid #eee;
              padding-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 10px 12px;
              border: 1px solid #e0e0e0;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
            }
            .total-row th {
              text-align: right;
              font-size: 16px;
            }
            .total-row td {
              font-size: 16px;
              font-weight: bold;
            }
            .notes {
              margin-top: 30px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="logo" />` : ''}
            <div class="company-info">
              <h1>JW Auto Clinic 246</h1>
              <p>Professional Car Wash & Detailing</p>
            </div>
          </div>

          <div class="card">
            <div class="section-title">Receipt</div>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Vehicle:</strong> ${vehicleDetails}</p>
            <p><strong>Email:</strong> ${email}</p>

            <table>
              <tr><th>Service</th><td>${serviceType}</td></tr>
              <tr><th>Employee</th><td>${employeeName}</td></tr>
              <tr><th>Payment Method</th><td>${paymentMethod}</td></tr>
              <tr><th>Special</th><td>${specials}</td></tr>
              <tr><th>Original Price</th><td>$${parseFloat(originalPrice).toFixed(2)}</td></tr>
              <tr><th>Discount (${discountPercent}%)</th><td>-$${parseFloat(discountAmount).toFixed(2)}</td></tr>
              <tr class="total-row"><th>Total</th><td>$${parseFloat(finalPrice).toFixed(2)}</td></tr>
            </table>

            <div class="notes">
              <strong>Notes:</strong><br/>
              ${notes || '—'}
            </div>
          </div>
        </body>
      </html>
    `;
  
    try {
      const { uri } = await Print.printToFileAsync({ html });
      console.log('📄 PDF generated at:', uri);
  
      const cachePdfUri = `${FileSystem.cacheDirectory}receipt-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: cachePdfUri });
      console.log('✅ PDF copied to cache:', cachePdfUri);
  
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        try {
          const asset = await MediaLibrary.createAssetAsync(cachePdfUri);
          console.log('📂 Asset created in media library:', asset.filename);
          // Optional: Create album (commented out if not working reliably)
          // await MediaLibrary.createAlbumAsync('JW Auto Receipts', asset, false);
        } catch (mediaErr) {
          console.warn('⚠️ Could not create media library asset:', mediaErr);
        }
      } else {
        console.warn('📛 Media permission not granted');
      }
  
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(cachePdfUri);
      } else {
        alert('Sharing is not available on this device.');
      }
    } catch (err: any) {
      console.error('❌ PDF generation error:', err);
      alert(`Failed to generate or share receipt: ${err.message}`);
    }
  }
  


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView contentContainerStyle={[styles.container, isWide && styles.containerWide]} keyboardShouldPersistTaps="handled">
        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'transaction' && styles.tabButtonActive]}
            onPress={() => setActiveTab('transaction')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'transaction' && styles.tabButtonTextActive]}>
              Add Transaction
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'management' && styles.tabButtonActive]}
            onPress={() => setActiveTab('management')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'management' && styles.tabButtonTextActive]}>
              Manage Services
            </Text>
          </TouchableOpacity>
        </View>

        {/* TRANSACTION TAB */}
        {activeTab === 'transaction' && (
          <>
            <View style={styles.header}>
              <Text style={styles.logo}>Add New Transaction</Text>
            </View>

            {/* Service Type Dropdown */}
            <View
              style={{
                // ONLY Web gets zIndex, not iOS/Android
                zIndex: Platform.OS === 'web' ? 3000 : undefined,
              }}
            >
              <Text style={styles.label}>Service Type</Text>
              <DropDownPicker
                open={openService}
                value={serviceTypeId}
                items={serviceItems}
                setOpen={setOpenService}
                setValue={setServiceTypeId}
                placeholder="Select service"
                style={[
                  styles.dropdown,
                  Platform.select({
                    android: { elevation: 1 },
                    ios: { zIndex: 1000 }, // for layering on iOS only
                    default: {},
                  }),
                ]}
                dropDownContainerStyle={[
                  styles.dropdownContainer,
                  Platform.select({
                    ios: { zIndex: 999 },
                    android: { elevation: 0 },
                    default: {},
                  }),
                ]}
                listMode="SCROLLVIEW"
                scrollViewProps={{
                  nestedScrollEnabled: true,
                  keyboardShouldPersistTaps: 'handled',
                  showsVerticalScrollIndicator: true,
                  persistentScrollbar: true,
                }}
              />
            </View>

            <Text style={styles.label}>Original Price ($)</Text>
            <TextInput
              style={styles.input}
              value={originalPrice}
              keyboardType="numeric"
              placeholder="e.g. 50.00"
              onChangeText={(text) => {
                // Allow only numbers and a single decimal point
                const sanitized = text.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
                setOriginalPrice(sanitized);
              }}
            />

            <Text style={styles.label}>Discount Percent (%)</Text>
            <TextInput
              style={styles.input}
              value={discountPercent}
              keyboardType="numeric"
              placeholder="e.g. 10"
              onChangeText={(text) => {
                // Allow only whole numbers (no decimals)
                const sanitized = text.replace(/[^0-9]/g, '');
                setDiscountPercent(sanitized);
              }}
            />

            {/* Payment Method */}
            <View style={{ zIndex: 2000 }}>
              <Text style={styles.label}>Payment Method</Text>
              <DropDownPicker
                open={openPayment}
                value={paymentMethod}
                items={[
                  { label: 'Cash', value: 'Cash' },
                  { label: 'Mobile Payment', value: 'Mobile Payment' },
                ]}
                setOpen={setOpenPayment}
                setValue={setPaymentMethod}
                placeholder="Select method"
                style={styles.dropdown}
                dropDownContainerStyle={styles.dropdownContainer}
                listMode="SCROLLVIEW"
                scrollViewProps={{ nestedScrollEnabled: true }}
              />
            </View>

            <Text style={styles.label}>Customer Name</Text>
            <TextInput
              style={styles.input}
              value={customerName ?? ''}
              onChangeText={async (text) => {
                setCustomerName(text);

                if (text.trim().length > 1) {
                  try {
                    const res = await fetch(`http://192.168.1.29:5000/api/customers`, {
                      headers: {
                        Authorization: `Bearer ${user!.token}`, // if required
                      },
                    });
                    const allCustomers = await res.json();

                    const filtered = allCustomers.filter((c: any) =>
                      c.name.toLowerCase().includes(text.toLowerCase())
                    );

                    setCustomerSuggestions(filtered);
                  } catch (err) {
                    console.error('Error fetching suggestions:', err);
                  }
                } else {
                  setCustomerSuggestions([]);
                }
              }}
              placeholder="e.g. Jane Smith"
            />
            {customerSuggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {customerSuggestions.map((customer) => (
                  <TouchableOpacity
                    key={customer._id}
                    onPress={() => {
                      setCustomerName(customer.name);
                      setEmail(customer.email);
                      setSelectedCustomerId(customer._id);
                      setCustomerSuggestions([]);
                    }}
                    style={styles.suggestionItem}
                  >
                    <Text>{customer.name} • {customer.customerCode}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}


            <Text style={styles.label}>Customer Email</Text>
            <TextInput style={styles.input} value={email ?? ''} onChangeText={setEmail} keyboardType="email-address" placeholder="e.g. jane@example.com" />

            <Text style={styles.label}>JW Auto Clinic Discount (%)</Text>
            <TextInput style={[styles.input, { backgroundColor: '#eee' }]} value={discountPercent} editable={false} />

            <Text style={styles.label}>Discount Amount ($)</Text>
            <TextInput style={[styles.input, { backgroundColor: '#eee' }]} value={discountAmount} editable={false} />

            <Text style={[styles.label, { fontSize: 16, marginTop: 10 }]}>Final Price: ${finalPrice}</Text>

            <View style={{ zIndex: 1000 }}>
              <Text style={styles.label}>Specials</Text>
              <DropDownPicker
                open={openSpecials}
                value={specialsId}
                items={specialItems}
                setOpen={setOpenSpecials}
                setValue={setSpecialsId}
                placeholder="Select special"
                style={[
                  styles.dropdown,
                  Platform.select({
                    android: { elevation: 1 },
                    ios: { zIndex: 1000 }, // for layering on iOS only
                    default: {},
                  }),
                ]}
                dropDownContainerStyle={[
                  styles.dropdownContainer,
                  Platform.select({
                    ios: { zIndex: 999 },
                    android: { elevation: 0 },
                    default: {},
                  }),
                ]}
                listMode="SCROLLVIEW"
                scrollViewProps={{
                  nestedScrollEnabled: true,
                  keyboardShouldPersistTaps: 'handled',
                  showsVerticalScrollIndicator: true,
                  persistentScrollbar: true,
                }}
              />
            </View>

            <Text style={styles.label}>Vehicle Details</Text>
            <TextInput style={styles.input} value={vehicleDetails} onChangeText={setVehicleDetails} placeholder="e.g. Red Toyota Corolla" />

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={notes} onChangeText={setNotes} multiline placeholder="Additional info..." />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#6a0dad', flex: 1, marginRight: 6 }]}
              onPress={handleSubmit}
            >
              <Text style={styles.submitText}>Add Transaction</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#aaa', flex: 1, marginLeft: 6 }]}
              onPress={() => {
                setServiceTypeId(null);
                setOriginalPrice('');
                setDiscountPercent('');
                setPaymentMethod('');
                setCustomerName('');
                setCustomerSuggestions([]);
                setSelectedCustomerId(null);
                setEmail('');
                setDiscountAmount('0.00');
                setFinalPrice('0.00');
                setSpecialsId(null);
                setVehicleDetails('');
                setNotes('');
              }}
            >
              <Text style={styles.submitText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: '#4caf50', marginTop: 10 }]}
            onPress={() =>
              generateAndShareReceipt({
                customerName,
                vehicleDetails,
                email,
                employeeName: 'JW Auto Clinic 246',
                serviceType: selectedServiceObj?.name ?? serviceType,
                specials: selectedSpecialObj?.name ?? specials,
                paymentMethod,
                originalPrice,
                discountPercent,
                discountAmount,
                finalPrice,
                notes,
              })
            }
          >
            <Text style={styles.submitText}>Preview & Share Receipt</Text>
          </TouchableOpacity>

          </>
        )}

        {/* MANAGEMENT TAB */}
        {activeTab === 'management' && (
          <View>
            <Text style={styles.header}>Add or Edit Services & Specials</Text>

            {/* Add New Service */}
            <Text style={styles.label}>New Service Name</Text>
            <TextInput
              style={styles.input}
              value={newService}
              onChangeText={setNewService}
              placeholder="e.g. Tire Shine"
            />
            <Text style={styles.label}>Service Price ($)</Text>
            <TextInput
              style={styles.input}
              value={newServicePrice}
              onChangeText={setNewServicePrice}
              keyboardType="numeric"
              placeholder="e.g. 25.00"
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleSaveService}>
              <Text style={styles.submitText}>Save Service</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 30 }} />

            {/* Add New Special */}
            <Text style={styles.label}>New Special Name</Text>
            <TextInput
              style={styles.input}
              value={newSpecial}
              onChangeText={setNewSpecial}
              placeholder="e.g. Weekend Discount"
            />
            <Text style={styles.label}>Discount Percent (%)</Text>
            <TextInput
              style={styles.input}
              value={newSpecialPrice}
              onChangeText={setNewSpecialPrice}
              keyboardType="numeric"
              placeholder="e.g. 10"
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleSaveSpecial}>
              <Text style={styles.submitText}>Save Special</Text>
            </TouchableOpacity>

            {/* Existing Services */}
            <TouchableOpacity onPress={() => setShowServices(!showServices)}>
              <Text style={styles.collapsibleHeader}>
                {showServices ? '▼' : '▶'} Existing Services
              </Text>
            </TouchableOpacity>
            {showServices && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Search Services..."
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                />
                {services
                  .filter((item) =>
                    item.name.toLowerCase().includes(serviceSearch.toLowerCase())
                  )
                  .map((item, index) => (
                    <Animatable.View
                      key={item._id}
                      animation="fadeInUp"
                      delay={index * 50}
                      style={styles.card}
                    >
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardDetail}>${item.price.toFixed(2)}</Text>
                      <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.editButton} onPress={() => handleEditService(item)}>
                          <Text style={styles.buttonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteService(item._id)}>
                          <Text style={styles.buttonText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </Animatable.View>
                  ))}
              </>
            )}

            {/* Existing Specials */}
            <TouchableOpacity onPress={() => setShowSpecials(!showSpecials)}>
              <Text style={styles.collapsibleHeader}>
                {showSpecials ? '▼' : '▶'} Existing Specials
              </Text>
            </TouchableOpacity>
            {showSpecials && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Search Specials..."
                  value={specialSearch}
                  onChangeText={setSpecialSearch}
                />
                {specialsList
                  .filter((item) =>
                    item.name.toLowerCase().includes(specialSearch.toLowerCase())
                  )
                  .map((item, index) => (
                    <Animatable.View
                      key={item._id}
                      animation="fadeInUp"
                      delay={index * 50}
                      style={styles.card}
                    >
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardDetail}>{item.discountPercent}% Off</Text>
                      <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.editButton} onPress={() => handleEditSpecial(item)}>
                          <Text style={styles.buttonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteSpecial(item._id)}>
                          <Text style={styles.buttonText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </Animatable.View>
                  ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {editItem && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: 'white', padding: 20, borderRadius: 12, width: '100%',
          }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>
              Edit {editItem.discountPercent !== undefined ? 'Special' : 'Service'}: {editItem.name}
            </Text>
            <TextInput
              style={styles.input}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              placeholder={editItem.discountPercent !== undefined ? 'Discount %' : 'Price $'}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#aaa', flex: 1, marginRight: 5 }]}
                onPress={() => setEditItem(null)}
              >
                <Text style={styles.submitText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { flex: 1, marginLeft: 5 }]}
                onPress={async () => {
                  try {
                    const endpoint = editItem.discountPercent !== undefined
                      ? `http://192.168.1.29:5000/api/specials/${editItem._id}`
                      : `http://192.168.1.29:5000/api/services/${editItem._id}`;
                    
                    const body = editItem.discountPercent !== undefined
                      ? { discountPercent: parseFloat(editValue) }
                      : { price: parseFloat(editValue) };

                    const optimisticUpdater = (list: any[], key: 'price' | 'discountPercent') =>
                      list.map(item => item._id === editItem._id ? { ...item, [key]: parseFloat(editValue) } : item);

                    if (editItem.discountPercent !== undefined) {
                      setSpecialsList(prev => optimisticUpdater(prev, 'discountPercent'));
                    } else {
                      setServices(prev => optimisticUpdater(prev, 'price'));
                    }

                    setEditItem(null); // Close modal immediately

                    const res = await fetch(endpoint, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${user!.token}`,
                      },
                      body: JSON.stringify(body),
                    });

                    if (!res.ok) throw new Error('Failed to update');
                    alert('Updated successfully!');
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
              >
                <Text style={styles.submitText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  containerWide: {},
  header: { fontSize: 18, fontWeight: 'bold', color: '#6a0dad', marginBottom: 16 },
  logo: { fontSize: 18, fontWeight: 'bold', color: '#6a0dad', marginTop: 40 },
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
    marginTop: 20,
  },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  tabSwitcher: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#eee',
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
    marginTop: 40, 
    marginBottom: 10,
  },
  tabButtonActive: {
    backgroundColor: '#6a0dad',
  },
  tabButtonText: {
    fontWeight: '600',
    color: '#333',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fdfdfd',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  cardDetail: {
    fontSize: 14,
    marginBottom: 12,
    color: '#555',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },  
  suggestionBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginTop: -5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 9999,
    maxHeight: 1000,
  },
  suggestionItem: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  collapsibleHeader: {
    fontWeight: '700',
    fontSize: 16,
    marginTop: 20,
    marginBottom: 8,
    color: '#6a0dad',
  },

});
