import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, PlusCircle, Flame, Bed, Users, Star,
  MapPin, CheckCircle2, AlertCircle, TrendingUp,
  Trash2, Plus, Check, X
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const POPULAR_AMENITIES = [
  'Air Conditioning',
  'High-Speed Wi-Fi',
  '3 Meals Included',
  'Power Backup',
  'RO Drinking Water',
  'Attached Washroom',
  'Biometric Access',
  'CCTV Surveillance',
  'Daily Housekeeping',
  'Geyser / Hot Water',
  'Study Table & Chair',
  'Washing Machine',
  'Gym & Fitness',
  'Balcony View'
];

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
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80');
  const [creating, setCreating] = useState(false);

  // Facilities / Amenities chips state
  const [selectedAmenities, setSelectedAmenities] = useState([
    'Air Conditioning',
    'High-Speed Wi-Fi',
    '3 Meals Included',
    'Power Backup',
    'RO Drinking Water'
  ]);
  const [customAmenity, setCustomAmenity] = useState('');

  // Dynamic Rooms & Beds state
  const [rooms, setRooms] = useState([
    {
      id: 'r-1',
      room_type: 'Single Deluxe AC',
      sharing: 1,
      rent: 12000,
      bedsText: '101-A'
    },
    {
      id: 'r-2',
      room_type: 'Double Sharing AC',
      sharing: 2,
      rent: 8000,
      bedsText: '102-A, 102-B'
    }
  ]);

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

  const toggleAmenity = (amenity) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const handleAddCustomAmenity = (e) => {
    e.preventDefault();
    const trimmed = customAmenity.trim();
    if (trimmed && !selectedAmenities.includes(trimmed)) {
      setSelectedAmenities(prev => [...prev, trimmed]);
      setCustomAmenity('');
    }
  };

  const handleAddRoom = () => {
    const nextRoomNum = 101 + rooms.length;
    setRooms(prev => [
      ...prev,
      {
        id: `r-${Date.now()}`,
        room_type: 'Double Sharing AC',
        sharing: 2,
        rent: parseFloat(rentStart) || 7500,
        bedsText: `${nextRoomNum}-A, ${nextRoomNum}-B`
      }
    ]);
  };

  const handleRemoveRoom = (index) => {
    if (rooms.length <= 1) {
      alert('A PG residence must have at least one room.');
      return;
    }
    setRooms(prev => prev.filter((_, i) => i !== index));
  };

  const handleRoomChange = (index, field, value) => {
    setRooms(prev => {
      const updated = [...prev];
      const room = { ...updated[index], [field]: value };

      if (field === 'sharing') {
        const sharingCount = parseInt(value, 10) || 1;
        const currentBeds = (room.bedsText || '').split(',').map(b => b.trim()).filter(Boolean);
        const baseNumber = currentBeds[0] ? currentBeds[0].split('-')[0] : `${101 + index}`;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        const newBeds = [];
        for (let i = 0; i < sharingCount; i++) {
          newBeds.push(`${baseNumber}-${letters[i] || (i + 1)}`);
        }
        room.bedsText = newBeds.join(', ');
      }

      updated[index] = room;
      return updated;
    });
  };

  const handleCreateProperty = async (e) => {
    e.preventDefault();
    if (rooms.length === 0) {
      alert('Please add at least one room type.');
      return;
    }
    setCreating(true);

    try {
      const formattedRooms = rooms.map((r, i) => {
        const bedCodes = (r.bedsText || '')
          .split(',')
          .map(b => b.trim())
          .filter(Boolean);

        const safeCodes = bedCodes.length > 0 ? bedCodes : [`${101 + i}-A`];

        return {
          room_type: r.room_type || `${r.sharing === 1 ? 'Single' : r.sharing + ' Sharing'} Room`,
          rent: parseFloat(r.rent) || parseFloat(rentStart) || 6000,
          sharing: parseInt(r.sharing, 10) || 1,
          beds: safeCodes.map(code => ({
            code,
            status: 'vacant'
          }))
        };
      });

      const calculatedMinRent = formattedRooms.length > 0
        ? Math.min(...formattedRooms.map(r => r.rent))
        : parseFloat(rentStart);

      const newProp = await api.createProperty({
        title,
        city,
        area,
        address,
        gender,
        description,
        monthly_rent_start: calculatedMinRent,
        security_deposit: parseFloat(securityDeposit) || calculatedMinRent,
        amenities: selectedAmenities,
        cover_image: coverImage,
        rooms: formattedRooms,
        rules: ['Valid ID required at check-in', 'Gate closes at 10:30 PM', 'No smoking on premises']
      });

      alert('Property created successfully with live bed inventory!');
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
            maxWidth: '760px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '32px',
            background: '#111827',
            borderRadius: '18px',
            border: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Add New PG Residence</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              List your property with interactive room configurations, live bed inventory, and verified facilities across Jaipur & NCR.
            </p>

            <form onSubmit={handleCreateProperty} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section 1: Property Identity & Location */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={18} />
                  <span>Property Details & Location</span>
                </h3>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                    Property Title *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-glass"
                    placeholder="e.g. Royal Heritage Luxury Boys & Girls PG"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                      City / Hub *
                    </label>
                    <select
                      className="input-glass"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="jaipur">Jaipur (MNIT & Malviya Nagar)</option>
                      <option value="neemrana">Neemrana (Japanese Zone & RIICO)</option>
                      <option value="behror">Behror (NH-48 Corridor)</option>
                      <option value="kotputli">Kotputli (LBS College & Industrial Hub)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                      Gender Accommodation *
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

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                      Area / Key Landmark *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-glass"
                      placeholder="e.g. Near MNIT Campus / WTP"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                      Full Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-glass"
                      placeholder="Plot number, Sector, Landmark, Pin code"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                      Security Deposit (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      className="input-glass"
                      placeholder="e.g. 10000"
                      value={securityDeposit}
                      onChange={(e) => setSecurityDeposit(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                    Cover Image URL *
                  </label>
                  <input
                    type="url"
                    required
                    className="input-glass"
                    placeholder="https://images.unsplash.com/..."
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                  />
                </div>
              </div>

              {/* Section 2: Visual Facilities & Amenities Chips */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-glass)',
                borderRadius: '14px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={18} />
                    <span>Facilities & Amenities ({selectedAmenities.length} selected)</span>
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Click chips to toggle
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {POPULAR_AMENITIES.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '20px',
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? '600' : '400',
                          border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                          background: isSelected ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? '#93c5fd' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isSelected ? <Check size={14} color="#60a5fa" /> : <Plus size={14} color="var(--text-muted)" />}
                        <span>{amenity}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Facility */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    className="input-glass"
                    placeholder="Add custom facility (e.g. TT Table, Rooftop Cafe, Lift)..."
                    value={customAmenity}
                    onChange={(e) => setCustomAmenity(e.target.value)}
                    style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAmenity}
                    className="btn-secondary"
                    style={{ padding: '7px 16px', fontSize: '0.82rem', gap: '4px' }}
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Dynamic Room Builder & Live Beds */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-glass)',
                borderRadius: '14px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bed size={18} />
                      <span>Room Configurations & Bed Inventory ({rooms.length} Room Types)</span>
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Define room sharing, monthly rent per bed, and bed allocation codes.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddRoom}
                    className="btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', gap: '6px' }}
                  >
                    <Plus size={15} />
                    <span>+ Add Room Type</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {rooms.map((room, idx) => (
                    <div
                      key={room.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                          }}>
                            Room Type #{idx + 1}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {room.sharing} Bed{room.sharing > 1 ? 's' : ''} Allocation
                          </span>
                        </div>

                        {rooms.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRoom(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.78rem',
                              padding: '4px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            Room Name / Title *
                          </label>
                          <input
                            type="text"
                            required
                            className="input-glass"
                            placeholder="e.g. Double Sharing AC"
                            value={room.room_type}
                            onChange={(e) => handleRoomChange(idx, 'room_type', e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            Sharing Configuration *
                          </label>
                          <select
                            className="input-glass"
                            value={room.sharing}
                            onChange={(e) => handleRoomChange(idx, 'sharing', e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                          >
                            <option value={1}>1 - Single Deluxe (1 Bed)</option>
                            <option value={2}>2 - Double Sharing (2 Beds)</option>
                            <option value={3}>3 - Triple Sharing (3 Beds)</option>
                            <option value={4}>4 - Four Sharing (4 Beds)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                            Rent Per Bed (₹/mo) *
                          </label>
                          <input
                            type="number"
                            required
                            className="input-glass"
                            placeholder="e.g. 7500"
                            value={room.rent}
                            onChange={(e) => handleRoomChange(idx, 'rent', e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      {/* Bed Numbers Editor & Live Badges */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Bed Numbers / Codes (comma-separated):
                          </label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {(room.bedsText || '').split(',').map((b) => b.trim()).filter(Boolean).map((bedCode) => (
                              <span
                                key={bedCode}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#34d399',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  fontWeight: '600',
                                }}
                              >
                                Bed {bedCode}
                              </span>
                            ))}
                          </div>
                        </div>

                        <input
                          type="text"
                          required
                          className="input-glass"
                          placeholder="e.g. 201-A, 201-B"
                          value={room.bedsText}
                          onChange={(e) => handleRoomChange(idx, 'bedsText', e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Description */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  Property Description *
                </label>
                <textarea
                  rows={3}
                  required
                  className="input-glass"
                  placeholder="Highlight food timings, rules, distance to MNIT/RIICO/colleges, Wi-Fi speed, and student atmosphere..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary"
                  style={{ padding: '10px 24px', gap: '6px' }}
                >
                  <PlusCircle size={17} />
                  <span>{creating ? 'Saving Listing...' : 'Publish PG Listing'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
