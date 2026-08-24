import { useUsersStore } from '../../stores';
import { useState, useEffect } from 'react';
import { User as UserType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { usersService } from '../../lib/services';
import { supabase, adminUserAction } from '../../lib/supabase';
import { sonner } from '../../lib/sonner';
import { hashPasswordString } from '../../context/AuthContext';

export function useUserModalData(user: UserType | null | undefined, onClose: () => void) {
  const appCurrentUser = useUsersStore(s => s.currentUser);
const appUsers = useUsersStore(s => s.users);

  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'cashier' as const,
    active: true,
    avatar: '',
    canEditPrice: false,
    canGiveDiscount: false,
    canDeleteSale: false,
    canViewProfit: false,
    canManageStock: false,
    canManagePO: false,
    canViewRecords: false,
    canEditSale: false,
    canEditProduct: false,
  });
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        name: user.name,
        email: user.email,
        password: '', // Don't pre-fill password for existing users
        role: user.role,
        active: user.active,
        avatar: user.avatar || '',
        canEditPrice: user.canEditPrice,
        canGiveDiscount: user.canGiveDiscount,
        canDeleteSale: user.canDeleteSale,
        canViewProfit: user.canViewProfit,
        canManageStock: user.canManageStock,
        canManagePO: user.canManagePO,
        canViewRecords: user.canViewRecords,
        canEditSale: user.canEditSale ?? false,
        canEditProduct: user.canEditProduct ?? false,
      });
    } else {
      setFormData({
        username: '',
        name: '',
        email: '',
        password: '',
        role: 'cashier',
        active: true,
        avatar: '',
        canEditPrice: false,
        canGiveDiscount: false,
        canDeleteSale: false,
        canViewProfit: false,
        canManageStock: false,
        canManagePO: false,
        canViewRecords: false,
        canEditSale: false,
        canEditProduct: false,
      });
    }
  }, [user]);

  const handleRoleChange = (newRole: 'admin' | 'manager' | 'cashier') => {
    setFormData(prev => {
      const defaults = {
        manager: {
          canEditPrice: true,
          canGiveDiscount: true,
          canDeleteSale: false,
          canViewProfit: true,
          canManageStock: true,
          canManagePO: true,
          canViewRecords: true,
          canEditSale: true,
        },
        cashier: {
          canEditPrice: false,
          canGiveDiscount: false,
          canDeleteSale: false,
          canViewProfit: false,
          canManageStock: false,
          canManagePO: false,
          canViewRecords: false,
          canEditSale: false,
        },
        admin: {
          canEditPrice: true,
          canGiveDiscount: true,
          canDeleteSale: true,
          canViewProfit: true,
          canManageStock: true,
          canManagePO: true,
          canViewRecords: true,
          canEditSale: true,
        }
      };
      
      return { ...prev, role: newRole, ...defaults[newRole] };
    });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.username.trim()) {
        sonner.error('Username is required');
        setLoading(false);
        return;
      }

      if (user) {
        // Update logic remains same

        if (formData.password && formData.password.length >= 6) {
          try {
            // Server-side: admin-users edge function enforces admin-only access.
            const { error: authError } = await adminUserAction('updateUser', {
              id: user.id,
              updates: { password: formData.password },
            });
            if (authError) throw new Error(authError);
          } catch (adminErr) {
            console.warn('[UserModal] Admin password update failed:', adminErr);
          }

          try {
            const hash = await hashPasswordString(formData.password);
            await supabase.from('users').update({ action_hash: hash }).eq('id', user.id);
          } catch (hashErr) {
            console.warn('Failed to commit password hash update:', hashErr);
          }
        }

        const updatePayload: Partial<UserType> = {
          username: formData.username,
          name: formData.name,
          email: formData.email,
          role: formData.role as 'cashier',
          active: formData.active,
          avatar: formData.avatar || undefined,
          canEditPrice: formData.canEditPrice,
          canGiveDiscount: formData.canGiveDiscount,
          canDeleteSale: formData.canDeleteSale,
          canViewProfit: formData.canViewProfit,
          canManageStock: formData.canManageStock,
          canManagePO: formData.canManagePO,
          canViewRecords: formData.canViewRecords,
          canEditSale: formData.canEditSale,
          canEditProduct: formData.canEditProduct,
        };

        const updatedUser = await usersService.update(user.id, updatePayload);
        
        // Refresh current user's profile if they are the one being edited
        if (user.id === appCurrentUser?.id) {
          await refreshProfile();
        }

        useUsersStore.getState().setUsers(appUsers.map(u => u.id === user.id ? updatedUser : u));
      } else {
        // Create logic remains same
        if (!formData.password || formData.password.length < 6) {
          sonner.error('Password must be at least 6 characters long');
          setLoading(false);
          return;
        }

        // Server-side: admin-users edge function enforces admin-only access.

        const normalizedUsername = formData.username.trim().toLowerCase();
        const resolvedEmail = formData.email.trim()
          ? formData.email.trim().toLowerCase()
          : `${normalizedUsername}.${Date.now().toString(36)}@pos.local`;

        const hash = await hashPasswordString(formData.password);
        const authResp = await adminUserAction('createUser', {
          email: resolvedEmail,
          password: formData.password,
          email_confirm: true,
          user_metadata: {
            username: formData.username,
            full_name: formData.name,
            role: formData.role,
          },
        });

        // Deployed edge-fn versions differ in shape — the auth user may come back as
        // { user }, { data: { user } }, { user: { user } }, or the user object itself.
        const authUser =
          authResp?.user?.id ? authResp.user
          : authResp?.data?.user?.id ? authResp.data.user
          : authResp?.user?.user?.id ? authResp.user.user
          : authResp?.data?.id ? authResp.data
          : authResp?.id ? authResp
          : null;
        if (!authUser?.id) {
          console.error('[UserModal] Unexpected createUser response shape:', authResp);
          throw new Error('User creation failed — unexpected response: ' + JSON.stringify(authResp)?.slice(0, 180));
        }

        const { error: upsertError } = await supabase.from('users').upsert({
          id: authUser.id,
          name: formData.name,
          email: resolvedEmail,
          role: formData.role,
          active: formData.active,
          username: formData.username,
          can_edit_price: formData.canEditPrice,
          can_give_discount: formData.canGiveDiscount,
          can_delete_sale: formData.canDeleteSale,
          can_view_profit: formData.canViewProfit,
          can_manage_stock: formData.canManageStock,
          can_manage_po: formData.canManagePO,
          can_view_records: formData.canViewRecords,
          can_edit_sale: formData.canEditSale,
          can_edit_product: formData.canEditProduct,
          avatar: formData.avatar || null,
          action_hash: hash
        }, { onConflict: 'id' });

        if (upsertError) {
          try {
            await adminUserAction('deleteUser', { id: authUser.id });
          } catch (deleteErr) {
            console.warn('[UserModal] Failed to clean up auth user after upsert error:', deleteErr);
          }
          throw new Error(`Failed to create user record: ${upsertError.message}`);
        }

        const newUser: UserType = {
          id: authUser.id,
          username: formData.username,
          name: formData.name,
          email: resolvedEmail,
          role: formData.role as 'cashier',
          canEditPrice: formData.canEditPrice,
          canGiveDiscount: formData.canGiveDiscount,
          canDeleteSale: formData.canDeleteSale,
          canViewProfit: formData.canViewProfit,
          canManageStock: formData.canManageStock,
          canManagePO: formData.canManagePO,
          canViewRecords: formData.canViewRecords,
          canEditSale: formData.canEditSale,
          active: formData.active,
          avatar: formData.avatar || undefined
        };

        useUsersStore.getState().setUsers([...appUsers, newUser]);
      }

      onClose();
    } catch (error) {
      let msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('users_username_key') || msg.includes('duplicate key')) {
        msg = 'This username is already taken. Please choose another one.';
      }
      sonner.error(`Error saving user: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };


  return {
    appCurrentUser,
    appUsers,
    loading,
    formData,
    setFormData,
    showMediaLibrary,
    setShowMediaLibrary,
    handleSubmit,
    handleChange,
    handleRoleChange,
  };
}
