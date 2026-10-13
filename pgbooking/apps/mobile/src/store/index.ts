import { configureStore, createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { MMKV } from 'react-native-mmkv';
import { authApi, propertiesApi, bookingsApi } from '../api/services';
import { TokenStorage } from '../api/interceptors/axios.interceptor';

const mmkv = new MMKV({ id: 'redux-store' });

// Simple MMKV-backed persist
const persist = {
  save: (key: string, value: unknown) => mmkv.set(key, JSON.stringify(value)),
  load: <T>(key: string): T | null => {
    const v = mmkv.getString(key);
    return v ? (JSON.parse(v) as T) : null;
  },
};

// ─────────────────────────────────────────────
// Auth Slice
// ─────────────────────────────────────────────

interface User {
  id: string;
  phone_number: string;
  legal_full_name: string;
  email_address: string | null;
  account_role: 'TENANT' | 'OWNER' | 'SYSTEM_ADMIN';
  identity_kyc_status: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  loading: boolean;
  error: string | null;
}

const savedAuth = persist.load<AuthState>('auth');

const authSlice = createSlice({
  name: 'auth',
  initialState: (savedAuth ?? { user: null, isAuthenticated: false, isNewUser: false, loading: false, error: null }) as AuthState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    setNewUser(state, action: PayloadAction<boolean>) {
      state.isNewUser = action.payload;
    },
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.isNewUser = false;
      state.error = null;
      TokenStorage.clearTokens();
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
});

// ─────────────────────────────────────────────
// Property Slice
// ─────────────────────────────────────────────

interface Property {
  id: string;
  property_display_name: string;
  municipality_city: string;
  gender_segregation_policy: string;
  structural_amenities: string[];
  vacant_beds: number;
  min_rent: number;
  max_rent: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  cover_photo_url: string | null;
  avg_rating: number | null;
}

interface PropertyState {
  searchResults: Property[];
  searchMeta: { total: number; page: number; hasNextPage: boolean } | null;
  selectedProperty: (Property & { photos: unknown[] }) | null;
  favorites: Property[];
  loading: boolean;
  searchLoading: boolean;
  error: string | null;
}

const propertySlice = createSlice({
  name: 'property',
  initialState: {
    searchResults: [],
    searchMeta: null,
    selectedProperty: null,
    favorites: [],
    loading: false,
    searchLoading: false,
    error: null,
  } as PropertyState,
  reducers: {
    setSearchResults(state, action: PayloadAction<{ data: Property[]; meta: PropertyState['searchMeta'] }>) {
      state.searchResults = action.payload.data;
      state.searchMeta = action.payload.meta;
      state.searchLoading = false;
    },
    appendSearchResults(state, action: PayloadAction<Property[]>) {
      state.searchResults.push(...action.payload);
    },
    setSelectedProperty(state, action: PayloadAction<PropertyState['selectedProperty']>) {
      state.selectedProperty = action.payload;
    },
    setFavorites(state, action: PayloadAction<Property[]>) {
      state.favorites = action.payload;
    },
    toggleFavoriteLocal(state, action: PayloadAction<string>) {
      const idx = state.favorites.findIndex((f) => f.id === action.payload);
      if (idx >= 0) state.favorites.splice(idx, 1);
    },
    setPropertyLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setSearchLoading(state, action: PayloadAction<boolean>) {
      state.searchLoading = action.payload;
    },
    setPropertyError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
      state.searchLoading = false;
    },
    clearSearch(state) {
      state.searchResults = [];
      state.searchMeta = null;
    },
  },
});

// ─────────────────────────────────────────────
// Booking Slice
// ─────────────────────────────────────────────

interface BookingInitiation {
  bookingId: string;
  lockExpirationTimestamp: string;
  requiredTokenAmount: number;
  monthlyRent: number;
  securityDeposit: number;
  propertyName: string;
  roomCode: string;
  bedCode: string;
}

interface Booking {
  id: string;
  current_booking_lifecycle_state: string;
  scheduled_check_in_date: string;
  monthly_rent_amount: string;
  created_at: string;
  bed_spatial_code?: string;
  room_identifier_code?: string;
  property_display_name?: string;
}

interface BookingState {
  currentBookingInitiation: BookingInitiation | null;
  myBookings: Booking[];
  selectedBooking: Booking | null;
  loading: boolean;
  error: string | null;
}

const bookingSlice = createSlice({
  name: 'booking',
  initialState: {
    currentBookingInitiation: null,
    myBookings: [],
    selectedBooking: null,
    loading: false,
    error: null,
  } as BookingState,
  reducers: {
    setBookingInitiation(state, action: PayloadAction<BookingInitiation>) {
      state.currentBookingInitiation = action.payload;
    },
    clearBookingInitiation(state) {
      state.currentBookingInitiation = null;
    },
    setMyBookings(state, action: PayloadAction<Booking[]>) {
      state.myBookings = action.payload;
    },
    setSelectedBooking(state, action: PayloadAction<Booking | null>) {
      state.selectedBooking = action.payload;
    },
    setBookingLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setBookingError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
    updateBookingStatus(state, action: PayloadAction<{ id: string; status: string }>) {
      const booking = state.myBookings.find((b) => b.id === action.payload.id);
      if (booking) booking.current_booking_lifecycle_state = action.payload.status;
    },
  },
});

// ─────────────────────────────────────────────
// UI Slice (global UI state)
// ─────────────────────────────────────────────

interface UiState {
  isDarkMode: boolean;
  unreadNotifications: number;
  activeReservationExpired: boolean;
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    isDarkMode: false,
    unreadNotifications: 0,
    activeReservationExpired: false,
  } as UiState,
  reducers: {
    toggleDarkMode(state) { state.isDarkMode = !state.isDarkMode; },
    setDarkMode(state, action: PayloadAction<boolean>) { state.isDarkMode = action.payload; },
    setUnreadCount(state, action: PayloadAction<number>) { state.unreadNotifications = action.payload; },
    decrementUnread(state) { if (state.unreadNotifications > 0) state.unreadNotifications--; },
    setReservationExpired(state, action: PayloadAction<boolean>) { state.activeReservationExpired = action.payload; },
  },
});

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    property: propertySlice.reducer,
    booking: bookingSlice.reducer,
    ui: uiSlice.reducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

// Persist auth state
store.subscribe(() => {
  const { auth } = store.getState();
  persist.save('auth', auth);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const {
  setUser, logout, setError: setAuthError, setLoading: setAuthLoading, setNewUser, clearError,
} = authSlice.actions;

export const {
  setSearchResults, appendSearchResults, setSelectedProperty, setFavorites,
  toggleFavoriteLocal, setPropertyLoading, setSearchLoading, setPropertyError, clearSearch,
} = propertySlice.actions;

export const {
  setBookingInitiation, clearBookingInitiation, setMyBookings, setSelectedBooking,
  setBookingLoading, setBookingError, updateBookingStatus,
} = bookingSlice.actions;

export const {
  toggleDarkMode, setDarkMode, setUnreadCount, decrementUnread, setReservationExpired,
} = uiSlice.actions;
