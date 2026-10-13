import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Colors } from '../theme';
import { authEventEmitter } from '../api/interceptors/axios.interceptor';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { logout } from '../store';

// ─────────────────────────────────────────────
// Param Lists
// ─────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  PhoneEntry: undefined;
  OtpVerify: { phoneNumber: string };
  ProfileComplete: { isNewUser: boolean };
};
  ProfileComplete: { isNewUser: boolean };
};

export type TenantTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  BookingsTab: undefined;
  ProfileTab: undefined;
};

export type TenantStackParamList = {
  TenantTabs: undefined;
  PropertyDetail: { propertyId: string };
  BedSelection: { propertyId: string; roomId: string; propertyName: string };
  Checkout: { bookingInitiation: {
    bookingId: string;
    lockExpirationTimestamp: string;
    requiredTokenAmount: number;
    monthlyRent: number;
    securityDeposit: number;
    propertyName: string;
    roomCode: string;
    bedCode: string;
  }};
  PaymentProcessing: { bookingId: string; orderId: string; amount: number };
  BookingSuccess: { bookingId: string };
  BookingDetail: { bookingId: string };
  MaintenanceCreate: { bookingId: string };
  MaintenanceDetail: { ticketId: string };
  Notifications: undefined;
  Favorites: undefined;
  KycUpload: undefined;
  MapView: { lat?: number; lng?: number };
};

export type OwnerTabParamList = {
  DashboardTab: undefined;
  PropertiesTab: undefined;
  TenantsTab: undefined;
  MaintenanceTab: undefined;
};

export type OwnerStackParamList = {
  OwnerTabs: undefined;
  PropertyManage: { propertyId: string };
  PropertyCreate: undefined;
  RoomManage: { propertyId: string; roomId?: string };
  TenantDetail: { tenantId: string; bookingId: string };
  MaintenanceManage: { ticketId: string };
};

// ─────────────────────────────────────────────
// Navigators
// ─────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const TenantStack = createNativeStackNavigator<TenantStackParamList>();
const TenantTab = createBottomTabNavigator<TenantTabParamList>();
const OwnerStack = createNativeStackNavigator<OwnerStackParamList>();
const OwnerTab = createBottomTabNavigator<OwnerTabParamList>();

// ─────────────────────────────────────────────
// Lazy Screen Imports
// ─────────────────────────────────────────────

const SplashScreen = React.lazy(() => import('../screens/auth/SplashScreen'));
const OnboardingScreen = React.lazy(() => import('../screens/auth/OnboardingScreen'));
const PhoneEntryScreen = React.lazy(() => import('../screens/auth/PhoneEntryScreen'));
const OtpVerifyScreen = React.lazy(() => import('../screens/auth/OtpVerifyScreen'));
const ProfileCompleteScreen = React.lazy(() => import('../screens/auth/ProfileCompleteScreen'));

const HomeScreen = React.lazy(() => import('../screens/home/HomeScreen'));
const SearchScreen = React.lazy(() => import('../screens/search/SearchScreen'));
const BookingsListScreen = React.lazy(() => import('../screens/booking/BookingsListScreen'));
const ProfileScreen = React.lazy(() => import('../screens/profile/ProfileScreen'));
const PropertyDetailScreen = React.lazy(() => import('../screens/property/PropertyDetailScreen'));
const BedSelectionScreen = React.lazy(() => import('../screens/booking/BedSelectionScreen'));
const CheckoutScreen = React.lazy(() => import('../screens/booking/CheckoutScreen'));
const PaymentProcessingScreen = React.lazy(() => import('../screens/payment/PaymentProcessingScreen'));
const BookingSuccessScreen = React.lazy(() => import('../screens/booking/BookingSuccessScreen'));
const BookingDetailScreen = React.lazy(() => import('../screens/booking/BookingDetailScreen'));
const MaintenanceCreateScreen = React.lazy(() => import('../screens/maintenance/MaintenanceCreateScreen'));
const MaintenanceDetailScreen = React.lazy(() => import('../screens/maintenance/MaintenanceDetailScreen'));
const NotificationsScreen = React.lazy(() => import('../screens/notifications/NotificationsScreen'));
const FavoritesScreen = React.lazy(() => import('../screens/home/FavoritesScreen'));
const KycUploadScreen = React.lazy(() => import('../screens/profile/KycUploadScreen'));
const MapViewScreen = React.lazy(() => import('../screens/search/MapViewScreen'));

const OwnerDashboardScreen = React.lazy(() => import('../screens/owner/OwnerDashboardScreen'));
const OwnerPropertiesScreen = React.lazy(() => import('../screens/owner/OwnerPropertiesScreen'));
const OwnerTenantsScreen = React.lazy(() => import('../screens/owner/OwnerTenantsScreen'));
const OwnerMaintenanceScreen = React.lazy(() => import('../screens/owner/OwnerMaintenanceScreen'));
const PropertyManageScreen = React.lazy(() => import('../screens/owner/PropertyManageScreen'));
const { PropertyCreateScreen, RoomManageScreen } = require('../screens/owner/PropertyCreateScreen');
const { TenantDetailScreen, MaintenanceManageScreen } = require('../screens/owner/TenantDetailScreen');

// ─────────────────────────────────────────────
// Auth Stack
// ─────────────────────────────────────────────

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AuthStack.Screen name="Splash" component={SplashScreen as React.ComponentType} />
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen as React.ComponentType} />
      <AuthStack.Screen name="PhoneEntry" component={PhoneEntryScreen as React.ComponentType} />
      <AuthStack.Screen name="OtpVerify" component={OtpVerifyScreen as React.ComponentType} />
      <AuthStack.Screen name="ProfileComplete" component={ProfileCompleteScreen as React.ComponentType} />
    </AuthStack.Navigator>
  );
}

// ─────────────────────────────────────────────
// Tenant Tab Navigator
// ─────────────────────────────────────────────

function TenantTabs() {
  return (
    <TenantTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: { borderTopColor: Colors.border.light, paddingBottom: 8, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <TenantTab.Screen name="HomeTab" component={HomeScreen as React.ComponentType} options={{ tabBarLabel: 'Home' }} />
      <TenantTab.Screen name="SearchTab" component={SearchScreen as React.ComponentType} options={{ tabBarLabel: 'Search' }} />
      <TenantTab.Screen name="BookingsTab" component={BookingsListScreen as React.ComponentType} options={{ tabBarLabel: 'Bookings' }} />
      <TenantTab.Screen name="ProfileTab" component={ProfileScreen as React.ComponentType} options={{ tabBarLabel: 'Profile' }} />
    </TenantTab.Navigator>
  );
}

// ─────────────────────────────────────────────
// Tenant Stack Navigator
// ─────────────────────────────────────────────

function TenantNavigator() {
  return (
    <TenantStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <TenantStack.Screen name="TenantTabs" component={TenantTabs} />
      <TenantStack.Screen name="PropertyDetail" component={PropertyDetailScreen as React.ComponentType} />
      <TenantStack.Screen name="BedSelection" component={BedSelectionScreen as React.ComponentType} />
      <TenantStack.Screen name="Checkout" component={CheckoutScreen as React.ComponentType} />
      <TenantStack.Screen name="PaymentProcessing" component={PaymentProcessingScreen as React.ComponentType} options={{ gestureEnabled: false }} />
      <TenantStack.Screen name="BookingSuccess" component={BookingSuccessScreen as React.ComponentType} options={{ gestureEnabled: false }} />
      <TenantStack.Screen name="BookingDetail" component={BookingDetailScreen as React.ComponentType} />
      <TenantStack.Screen name="MaintenanceCreate" component={MaintenanceCreateScreen as React.ComponentType} />
      <TenantStack.Screen name="MaintenanceDetail" component={MaintenanceDetailScreen as React.ComponentType} />
      <TenantStack.Screen name="Notifications" component={NotificationsScreen as React.ComponentType} />
      <TenantStack.Screen name="Favorites" component={FavoritesScreen as React.ComponentType} />
      <TenantStack.Screen name="KycUpload" component={KycUploadScreen as React.ComponentType} />
      <TenantStack.Screen name="MapView" component={MapViewScreen as React.ComponentType} />
    </TenantStack.Navigator>
  );
}

// ─────────────────────────────────────────────
// Owner Tabs
// ─────────────────────────────────────────────

function OwnerTabs() {
  return (
    <OwnerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: { borderTopColor: Colors.border.light, paddingBottom: 8, height: 60 },
      }}
    >
      <OwnerTab.Screen name="DashboardTab" component={OwnerDashboardScreen as React.ComponentType} options={{ tabBarLabel: 'Dashboard' }} />
      <OwnerTab.Screen name="PropertiesTab" component={OwnerPropertiesScreen as React.ComponentType} options={{ tabBarLabel: 'Properties' }} />
      <OwnerTab.Screen name="TenantsTab" component={OwnerTenantsScreen as React.ComponentType} options={{ tabBarLabel: 'Tenants' }} />
      <OwnerTab.Screen name="MaintenanceTab" component={OwnerMaintenanceScreen as React.ComponentType} options={{ tabBarLabel: 'Maintenance' }} />
    </OwnerTab.Navigator>
  );
}

function OwnerNavigator() {
  return (
    <OwnerStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <OwnerStack.Screen name="OwnerTabs" component={OwnerTabs} />
      <OwnerStack.Screen name="PropertyCreate" component={PropertyCreateScreen} />
      <OwnerStack.Screen name="PropertyManage" component={PropertyManageScreen as React.ComponentType} />
      <OwnerStack.Screen name="RoomManage" component={RoomManageScreen} />
      <OwnerStack.Screen name="TenantDetail" component={TenantDetailScreen} />
      <OwnerStack.Screen name="MaintenanceManage" component={MaintenanceManageScreen} />
    </OwnerStack.Navigator>
  );
}

// ─────────────────────────────────────────────
// Root Navigator
// ─────────────────────────────────────────────

export default function RootNavigator() {
  const { isAuthenticated, user } = useSelector((s: RootState) => s.auth);
  const isDark = useSelector((s: RootState) => s.ui.isDarkMode);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsub = authEventEmitter.on('logout', () => dispatch(logout()));
    return unsub;
  }, [dispatch]);

  const theme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: Colors.primary, background: '#0F172A' } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Colors.primary, background: '#F8FAFC' } };

  return (
    <NavigationContainer theme={theme}>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : user?.account_role === 'OWNER' || user?.account_role === 'SYSTEM_ADMIN' ? (
        <OwnerNavigator />
      ) : (
        <TenantNavigator />
      )}
    </NavigationContainer>
  );
}
