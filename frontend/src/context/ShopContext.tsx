import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShopSettings } from '../types';
import { settingsApi } from '../api';
import { useAuth } from './AuthContext';

const defaultSettings: ShopSettings = {
  id: 1,
  shop_name: 'My Shop',
  proprietor_name: '',
  gstin: '',
  fertilizer_license_no: '',
  pesticide_license_no: '',
  seed_license_no: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  bank_name: '',
  bank_account_no: '',
  bank_ifsc: '',
  bank_branch: '',
  upi_id: '',
  invoice_prefix: 'INV',
  terms_conditions: '1. Goods once sold will not be taken back without original bill.\n2. Store fertilizers in cool and dry place away from direct sunlight.'
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
  const [settings, setSettings] = useState<ShopSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    if (!user?.id) {
      setSettings(defaultSettings);
      setIsLoading(false);
      return;
    }
    try {
      const data = await settingsApi.get();
      if (data?.shop_name) {
        setSettings(data);
      }
    } catch {
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      void fetchSettings();
    } else {
      setSettings(defaultSettings);
      setIsLoading(false);
    }
  }, [user?.id, user?.username]);

  const updateSettings = async (newSettings: Partial<ShopSettings>) => {
    try {
      const updated = await settingsApi.update(newSettings);
      setSettings(updated);
    } catch {
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
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
