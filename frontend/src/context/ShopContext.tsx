import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShopSettings } from '../types';
import { settingsApi } from '../api';
import { useAuth } from './AuthContext';

const defaultSettings: ShopSettings = {
  id: 1,
  shop_name: 'KISAN SEVA KENDRA & AGRO CHEMICALS',
  proprietor_name: 'Ramesh Kumar Patel',
  gstin: '24AABCK1234F1Z5',
  fertilizer_license_no: 'FL/2023/GJ/45892',
  pesticide_license_no: 'PL/2023/GJ/11204',
  seed_license_no: 'SL/2023/GJ/88219',
  address_line1: 'Shop No. 12, APMC Market Yard, Station Road',
  address_line2: 'Near Krishi Vigyan Kendra',
  city: 'Anand',
  state: 'Gujarat',
  pincode: '388001',
  phone: '+91 98765 43210',
  email: 'kisanseva.anand@gmail.com',
  bank_name: 'State Bank of India',
  bank_account_no: '39485729103',
  bank_ifsc: 'SBIN0001234',
  bank_branch: 'APMC Market Branch',
  upi_id: '9876543210@upi',
  invoice_prefix: 'KSK/24-25/',
  terms_conditions: '1. Goods once sold will not be taken back without original bill.\n2. Store fertilizers in cool and dry place away from direct sunlight.\n3. Subject to Anand jurisdiction.'
};

interface ShopContextType {
  settings: ShopSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<ShopSettings>) => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ShopSettings>(() => {
    const saved = localStorage.getItem('shop_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const data = await settingsApi.get();
      if (data && data.shop_name) {
        setSettings(data);
        localStorage.setItem('shop_settings', JSON.stringify(data));
      }
    } catch {
      // Keep default settings if backend not connected yet
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, [user?.id, user?.username]);

  const updateSettings = async (newSettings: Partial<ShopSettings>) => {
    try {
      const updated = await settingsApi.update(newSettings);
      setSettings(updated);
      localStorage.setItem('shop_settings', JSON.stringify(updated));
    } catch {
      // Local fallback
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      localStorage.setItem('shop_settings', JSON.stringify(merged));
    }
  };

  return (
    <ShopContext.Provider value={{ settings, isLoading, refreshSettings: fetchSettings, updateSettings }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within a ShopProvider');
  return context;
};
