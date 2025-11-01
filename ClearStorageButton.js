// Temporary component to clear all storage - add this to your app temporarily
import React from 'react';
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ClearStorageButton = () => {
  const clearAllStorage = async () => {
    try {
      console.log('🧹 Clearing all mobile app storage...');
      
      // Clear queue storage
      await AsyncStorage.removeItem('@invoice_queue_v2');
      await AsyncStorage.removeItem('@processed_invoices_v2');
      await AsyncStorage.removeItem('@failed_invoices_v2');
      await AsyncStorage.removeItem('@sync_status_v2');
      await AsyncStorage.removeItem('@duplicate_check_v2');
      
      // Clear network storage
      await AsyncStorage.removeItem('desktop-server-url');
      await AsyncStorage.removeItem('manual-desktop-url');
      await AsyncStorage.removeItem('last-known-ip');
      
      // Clear recent scans
      await AsyncStorage.removeItem('@recent_scans');
      await AsyncStorage.removeItem('@recent_sales');
      
      // Clear legacy storage
      await AsyncStorage.removeItem('@invoice_queue');
      await AsyncStorage.removeItem('@offline_invoices');
      
      // Clear everything else
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      
      console.log('✅ All mobile storage cleared successfully');
      
      Alert.alert(
        '✅ Storage Cleared',
        'All mobile app data has been cleared. Please restart the app.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
      Alert.alert('Error', `Failed to clear storage: ${error.message}`);
    }
  };

  return (
    <View style={{ padding: 20, backgroundColor: '#ff4444', margin: 10, borderRadius: 8 }}>
      <TouchableOpacity onPress={clearAllStorage}>
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
          🗑️ CLEAR ALL DATA (DANGER)
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default ClearStorageButton;