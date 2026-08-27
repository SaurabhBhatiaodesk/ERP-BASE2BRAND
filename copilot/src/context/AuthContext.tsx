import React, { createContext, useContext, useState, useEffect } from 'react';
import { Employee } from '../types/crm';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: Employee;
  organizationId: string;
  organizationName: string;
  isAuthenticated: boolean;
  switchUser: (employeeId: string) => void;
  availableUsers: Employee[];
  sessionToken?: string;
}

const DEFAULT_USER: Employee = {
  id: '89f1ed1a-398c-47bc-bfb2-13c2b27df524',
  full_name: 'CEO Admin',
  email: 'ceo@base2brand.com',
  role: 'admin',
  phone: '+91 98765 43210',
  target_revenue: 1000000,
  department: 'Executive',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableUsers, setAvailableUsers] = useState<Employee[]>([DEFAULT_USER]);
  const [currentUser, setCurrentUser] = useState<Employee>(DEFAULT_USER);
  const [sessionToken, setSessionToken] = useState<string | undefined>();

  // Fetch real employee profiles from Supabase
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase
        .from('employee_profiles')
        .select('*')
        .order('name', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            const realEmployees: Employee[] = data.map((e: any) => ({
              id: String(e.id),
              full_name: e.name || 'Team Member',
              email: e.email || '',
              role: (e.app_role === 'admin' || (e.role && e.role.toLowerCase().includes('ceo')) ? 'admin' : (e.role && e.role.toLowerCase().includes('leader')) ? 'manager' : 'bde') as any,
              phone: e.phone || '',
              target_revenue: 500000,
              department: e.dept || 'General',
              avatar_url: e.profile_image_url || undefined,
            }));

            setAvailableUsers(realEmployees);

            const savedId = localStorage.getItem('crm_current_user_id');
            const savedMatch = realEmployees.find(e => e.id === savedId);
            if (savedMatch) {
              setCurrentUser(savedMatch);
            } else {
              // Default to CEO or first user
              const ceo = realEmployees.find(e => e.role === 'admin' || e.full_name.toLowerCase().includes('ceo'));
              setCurrentUser(ceo || realEmployees[0]);
            }
          }
        });

      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.access_token) {
          setSessionToken(data.session.access_token);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          setSessionToken(session.access_token);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const switchUser = (employeeId: string) => {
    const target = availableUsers.find(e => e.id === employeeId);
    if (target) {
      setCurrentUser(target);
      localStorage.setItem('crm_current_user_id', employeeId);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        organizationId: 'org-base2brand-001',
        organizationName: 'Base2Brand Enterprise CRM',
        isAuthenticated: true,
        switchUser,
        availableUsers,
        sessionToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
