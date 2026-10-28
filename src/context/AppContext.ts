import { createContext } from 'react';
import { CompanyConfig, ToastMessage } from '../types';

export const defaultCompanyConfig: CompanyConfig = {
  name: "Ashok Leyland Limited",
  title: "Factory Floor Maintenance Dashboard",
  plant: "Alwar Plant, Rajasthan",
  accentColor: "indigo"
};

export const CompanyConfigContext = createContext<CompanyConfig>(defaultCompanyConfig);

export const ToastContext = createContext<{
  addToast: (text: string, type: 'success' | 'error' | 'info') => void;
}>({
  addToast: () => {}
});
