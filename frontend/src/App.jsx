import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import AiAssistantModal from './components/AiAssistantModal';
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import CityLandingPage from './pages/CityLandingPage';
import PropertyDetail from './pages/PropertyDetail';
import TenantDashboard from './pages/TenantDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import BookingSuccess from './pages/BookingSuccess';
import { Building2, Mail, MapPin } from 'lucide-react';

function AppContent() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleOpenAuth = (tab = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Navbar
        onOpenAuth={handleOpenAuth}
        onOpenAi={() => setAiModalOpen(true)}
      />

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage onOpenAi={() => setAiModalOpen(true)} />} />
          <Route path="/discover" element={<HomePage onOpenAi={() => setAiModalOpen(true)} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cities/:city" element={<CityLandingPage />} />
          <Route path="/properties/:id" element={<PropertyDetail onOpenAuth={handleOpenAuth} />} />
          <Route path="/booking/success" element={<BookingSuccess />} />
          <Route path="/tenant-dashboard" element={<TenantDashboard />} />
          <Route path="/dashboard" element={<TenantDashboard />} />
          <Route path="/my-bookings" element={<TenantDashboard />} />
          <Route path="/owner-dashboard" element={<OwnerDashboard />} />
        </Routes>
      </main>

      {/* pgbook. Clean Warm Footer */}
      <footer style={{
        background: '#ffffff',
        borderTop: '1px solid var(--border-subtle)',
        padding: '50px 0 30px 0',
        marginTop: '60px',
      }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '30px', marginBottom: '40px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                background: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}>
                <Building2 size={18} />
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.03em' }}>
                pgbook<span style={{ color: 'var(--accent-primary)' }}>.</span>
              </div>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              India's grown-up PG platform. Verified student and professional accommodations across Rajasthan & NCR with instant bed locking and zero broker fees.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Locations</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
              <Link to="/cities/jaipur" style={{ color: 'var(--text-secondary)' }}>Jaipur (MNIT & Malviya Nagar)</Link>
              <Link to="/cities/neemrana" style={{ color: 'var(--text-secondary)' }}>Neemrana (Japanese Zone & RIICO)</Link>
              <Link to="/cities/behror" style={{ color: 'var(--text-secondary)' }}>Behror (NH-48 Corridor)</Link>
              <Link to="/cities/kotputli" style={{ color: 'var(--text-secondary)' }}>Kotputli (LBS College & Industrial Hub)</Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Platform & Verification</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
              <a href="/api/sitemap.xml" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}>Google Sitemap (XML)</a>
              <a href="/api/health" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}>API Health Status</a>
              <span style={{ color: 'var(--text-secondary)' }}>Stripe Verified Payments</span>
              <span style={{ color: 'var(--text-secondary)' }}>SendGrid Verified Delivery</span>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Support & Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={15} color="var(--accent-primary)" />
                <span>manoj.portfolio.website@gmail.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} color="var(--accent-primary)" />
                <span>Jaipur & NCR Support Hub</span>
              </div>
            </div>
          </div>
        </div>

        <div className="container" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '10px' }}>
          <div>© 2026 pgbook. All rights reserved.</div>
          <div>Verified Accommodations • 100% Deposit Protection</div>
        </div>
      </footer>

      {/* Auth Modal fallback */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* AI Assistant Modal */}
      <AiAssistantModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
