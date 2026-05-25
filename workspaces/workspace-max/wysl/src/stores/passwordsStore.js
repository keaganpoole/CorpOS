import { create } from 'zustand';
import api from '../services/apiService'; // Assuming your apiService is correctly set up
import { passwordsDataSource } from '../data/tempData'; // Using mock data for now

const usePasswordsStore = create((set, get) => ({
  passwords: [],
  isLoading: true,
  error: null,
  selectedIds: new Set(),

  // --- ACTIONS ---

  // Fetch all passwords for the grid
  fetchPasswords: async () => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      const sortedPasswords = passwordsDataSource.sort((a, b) => new Date(b.Created) - new Date(a.Created));
      set({ passwords: sortedPasswords, isLoading: false });
    } catch (err) {
      const errorMessage = "Failed to fetch passwords.";
      set({ error: errorMessage, isLoading: false });
    }
  },

  // Update a single password (for inline editing)
  updatePassword: async (passwordId, data) => {
    const originalPasswords = get().passwords;
    const updatedPasswords = originalPasswords.map(pwd =>
      pwd.id === passwordId ? { ...pwd, ...data } : pwd
    );
    set({ passwords: updatedPasswords });

    try {
      console.log('Updated password:', passwordId, data);
    } catch (err) {
      set({ passwords: originalPasswords }); // Rollback on error
    }
  },

  // Create a new password
  createPassword: async (passwordPayload) => {
    try {
      const newPassword = { ...passwordPayload, id: `pwd_${Date.now()}`, Created: new Date().toISOString(), isFavorite: false };
      set(state => ({
        passwords: [newPassword, ...state.passwords]
      }));
      return newPassword;
    } catch (err) {
      const errorMessage = "Failed to create password.";
      throw new Error(errorMessage);
    }
  },
  
  // Bulk delete passwords
  deletePasswords: async (passwordIds) => {
    const originalPasswords = get().passwords;
    const remainingPasswords = originalPasswords.filter(pwd => !passwordIds.includes(pwd.id));
    set({ passwords: remainingPasswords });

    try {
      console.log('Deleted passwords:', passwordIds);
    } catch (err) {
      set({ passwords: originalPasswords }); // Rollback on error
    }
  },

  // Toggle favorite status
  toggleFavorite: (passwordId) => {
    set(state => ({
      passwords: state.passwords.map(pwd =>
        pwd.id === passwordId ? { ...pwd, isFavorite: !pwd.isFavorite } : pwd
      )
    }));
  },

  // Reorder passwords after drag-and-drop
  reorderPasswords: (passwords) => {
    set({ passwords });
  },

  // --- SELECTION ACTIONS ---
  toggleSelectId: (id) => {
    set(state => {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return { selectedIds: newSelectedIds };
    });
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  selectAll: () => {
    set(state => {
      const allIds = new Set(state.passwords.map(p => p.id));
      return { selectedIds: allIds };
    });
  }
}));

export default usePasswordsStore;

// --- SELECTORS ---
export const selectPasswordById = (state, passwordId) => state.passwords.find(pwd => pwd.id === passwordId);