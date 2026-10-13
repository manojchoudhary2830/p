import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, PlusCircle, Flame, Bed, Users, Star,
  MapPin, CheckCircle2, AlertCircle, TrendingUp
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [boostingId, setBoostingId] = useState(null);

  // New property form state
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('jaipur');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('co-ed');
  const [description, setDescription] = useState('');
  const [rentStart, setRentStart] = useState('8000');
  const [securityDeposit, setSecurityDeposit] = useState('10000');
  const [amenitiesInput, setAmenitiesInput] = useState('Air Conditioning, Wi-Fi, 3 Meals Included, Power Backup, RO Water');
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    try {
      setLoading(true);
      const res = await api.getMyProperties();
      setProperties(res.properties || []);
    } catch (err) {
      console.error('Failed to load owner properties:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleBoost = async (propId) => {
    setBoostingId(propId);
    try {
      const res = await api.boostProperty(propId);
      alert(res.message || 'Property successfully boosted for 30 days!');
      loadProperties();
    } catch (err) {
      alert(err.message || 'Failed to boost property.');
    } finally {
      setBoostingId(null);
    }
  };

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const amenitiesList = amenitiesInput.split(',').map(a => a.trim()).filter(Boolean);
      const newProp = await api.createProperty({
        title,
        city,
        area,
        address,
        gender,
        description,
        monthly_rent_start: parseFloat(rentStart),
        security_deposit: parseFloat(securityDeposit),
        amenities: amenitiesList,
        cover_image: coverImage,
        rooms: [
          {
            room_type: 'Single Deluxe AC',
            rent: parseFloat(rentStart) * 1.5,
            sharing: 1,
            beds: [{ code: '101-A', status: 'vacant' }],
          },
          {
            room_type: 'Double Sharing AC',
            rent: parseFloat(rentStart),
            sharing: 2,
            beds: [
              { code: '102-A', status: 'vacant' },
              { code: '102-B', status: 'vacant' },
            ],
          },
        ],
        rules: ['Valid ID required', 'Gate closes at 10:30 PM'],
      });

      alert('Property created successfully!');
      setShowAddModal(false);
      loadProperties();
    } catch (err) {
      alert(err.message || 'Failed to create property.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container" style={{ padding: '40px 20px 80px 20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '6px' }}>PG Owner Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage listings, track bed occupancy, and boost properties across Jaipur & NCR.
          </p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ gap: '8px' }}>
          <PlusCircle size={18} />
          <span>Add New Property</span>
        </button>
      </div>

      {/* Properties List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          Loading your listings...
        </div>
      ) : properties.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Building2 size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>No properties listed yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            List your PG in Jaipur, Neemrana, Behror, or Kotputli to connect with students and working professionals.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Create Your First Listing
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
          {properties.map((p) => {
            let totalBeds = 0;
            let vacantBeds = 0;
            (p.rooms || []).forEach(r => {
              (r.beds || []).forEach(b => {
                totalBeds++;
                if (b.status === 'vacant') vacantBeds++;
              });
            });

            return (
              <div key={p._id} className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', height: '180px' }}>
                  <img src={p.cover_image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <span className="badge badge-city">{p.city}</span>
                  </div>
                  {p.is_boosted && (
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span className="badge badge-boosted"><Flame size={12} /> Featured Active</span>
                    </div>
                  )}
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={13} color="var(--accent-primary)" />
                    {p.area}
                  </div>

                  <h3 style={{ fontSize: '1.2rem', lineHeight: 1.3 }}>{p.title}</h3>

                  {/* Occupancy Card */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)',
                    fontSize: '0.85rem',
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Total Beds</span>
                      <strong>{totalBeds} Beds</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Vacant</span>
                      <strong style={{ color: '#34d399' }}>{vacantBeds} Available</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Occupancy</span>
                      <strong style={{ color: '#60a5fa' }}>
                        {totalBeds > 0 ? Math.round(((totalBeds - vacantBeds) / totalBeds) * 100) : 0}%
                      </strong>
                    </div>
                  </div>

                  {/* Boost Action Button (p.md line 32: ₹499 for 30 days) */}
                  <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link to={`/properties/${p._id}`} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                      Preview Page
                    </Link>

                    {!p.is_boosted ? (
                      <button
                        onClick={() => handleBoost(p._id)}
                        disabled={boostingId === p._id}
                        className="btn-primary btn-boost"
                        style={{ padding: '6px 14px', fontSize: '0.82rem', gap: '4px' }}
                      >
                        <Flame size={14} />
                        <span>{boostingId === p._id ? 'Boosting...' : 'Boost Listing (₹499)'}</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flame size={14} /> Boosted (Top Ranked)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 220,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '30px',
            background: '#111827',
          }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Add New PG Residence</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
              List your PG property in Jaipur, Neemrana, Behror, or Kotputli with live bed inventory.
            </p>

            <form onSubmit={handleCreateProperty} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Property Title
                </label>
                <input
                  type="text"
                  required
                  className="input-glass"
                  placeholder="e.g. Royal Heritage Executive PG"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    City
                  </label>
                  <select
                    className="input-glass"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  >
                    <option value="jaipur">Jaipur</option>
                    <option value="neemrana">Neemrana</option>
                    <option value="behror">Behror</option>
                    <option value="kotputli">Kotputli</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Gender Accommodation
                  </label>
                  <select
                    className="input-glass"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="co-ed">Co-Living / Both</option>
                    <option value="male">Boys Only</option>
                    <option value="female">Girls Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Area / Landmark
                  </label>
                  <input
                    type="text"
                    required
                    className="input-glass"
                    placeholder="e.g. Near MNIT / WTP"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Starting Rent (₹/mo)
                  </label>
                  <input
                    type="number"
                    required
                    className="input-glass"
                    value={rentStart}
                    onChange={(e) => setRentStart(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Full Street Address
                </label>
                <input
                  type="text"
                  required
                  className="input-glass"
                  placeholder="Plot number, Street name, City, Pin code"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Cover Image URL
                </label>
                <input
                  type="url"
                  required
                  className="input-glass"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Amenities (comma-separated)
                </label>
                <input
                  type="text"
                  className="input-glass"
                  value={amenitiesInput}
                  onChange={(e) => setAmenitiesInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Property Description
                </label>
                <textarea
                  rows={3}
                  required
                  className="input-glass"
                  placeholder="Highlight facilities, food menu, proximity to colleges and public transit..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Saving...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
