import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import AiAssistantModal from './components/AiAssistantModal';
import HomePage from './pages/HomePage';
import CityLandingPage from './pages/CityLandingPage';
import PropertyDetail from './pages/PropertyDetail';
import TenantDashboard from './pages/TenantDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import BookingSuccess from './pages/BookingSuccess';
import { ShieldCheck, Mail, MapPin } from 'lucide-react';

function AppContent() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleOpenAuth = (tab = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        onOpenAuth={handleOpenAuth}
        onOpenAi={() => setAiModalOpen(true)}
      />

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage onOpenAi={() => setAiModalOpen(true)} />} />
          <Route path="/cities/:city" element={<CityLandingPage />} />
          <Route path="/properties/:id" element={<PropertyDetail onOpenAuth={handleOpenAuth} />} />
          <Route path="/booking/success" element={<BookingSuccess />} />
          <Route path="/tenant-dashboard" element={<TenantDashboard />} />
          <Route path="/owner-dashboard" element={<OwnerDashboard />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer style={{
        background: '#070b12',
        borderTop: '1px solid var(--border-glass)',
        padding: '50px 0 30px 0',
        marginTop: '60px',
      }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '30px', marginBottom: '40px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: '800', marginBottom: '10px' }}>
              <span style={{ color: '#fff' }}>Next</span><span className="gradient-text">Gen PG</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Direct verified student and professional accommodations across Rajasthan & NCR highway corridor. Real-time bed reservation engine with 10-minute hold.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '14px', color: '#fff' }}>Locations</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <Link to="/cities/jaipur" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Jaipur (MNIT & Malviya Nagar)</Link>
              <Link to="/cities/neemrana" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Neemrana (Japanese Zone & RIICO)</Link>
              <Link to="/cities/behror" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Behror (NH-48 Corridor)</Link>
              <Link to="/cities/kotputli" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Kotputli (LBS College & RIICO)</Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '14px', color: '#fff' }}>Platform & SEO</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <a href="/api/sitemap.xml" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Google Sitemap (XML)</a>
              <a href="/api/health" target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>API Health Status</a>
              <span style={{ color: 'var(--text-secondary)' }}>Stripe Verified Payments</span>
              <span style={{ color: 'var(--text-secondary)' }}>SendGrid Verified Delivery</span>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '14px', color: '#fff' }}>Support & Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} color="#60a5fa" />
                <span>manoj.portfolio.website@gmail.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} color="#60a5fa" />
                <span>Jaipur & NCR Support Hub</span>
              </div>
            </div>
          </div>
        </div>

        <div className="container" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '10px' }}>
          <div>© 2026 NextGen PG Booking. All rights reserved.</div>
          <div>Built with React & FastAPI • Zero Brokerage Guarantee</div>
        </div>
      </footer>

      {/* Auth Modal */}
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
