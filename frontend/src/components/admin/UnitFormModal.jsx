import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corrige o ícone padrão do Leaflet que o Vite quebra
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const EMPTY = { name: '', code: '', radius_meters: 100, address: '', latitude: -23.55052, longitude: -46.633308 };

/** Captura cliques no mapa e atualiza a posição do pin. */
function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function UnitFormModal({ unit, onSave, onClose, contracts = [], userRole }) {
  const isEdit = Boolean(unit?.id);

  const [form, setForm] = useState(() => {
    if (!unit) return { ...EMPTY, contract_id: '' };
    if (!unit.id) return { ...EMPTY, contract_id: unit.contract_id || '' };
    return {
      name: unit.name, code: unit.code, radius_meters: unit.radius_meters,
      address: unit.address || '', latitude: parseFloat(unit.latitude), longitude: parseFloat(unit.longitude),
      contract_id: unit.contract_id || '',
    };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searching,   setSearching]   = useState(false);
  const [mapCenter,   setMapCenter]   = useState([form.latitude, form.longitude]);
  const [mapKey,      setMapKey]      = useState(0);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const handleMapClick = useCallback((lat, lng) => {
    set('latitude', lat);
    set('longitude', lng);
    setMapCenter([lat, lng]);
  }, []);

  async function searchAddress() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        set('latitude', lat);
        set('longitude', lng);
        setMapCenter([lat, lng]);
        setMapKey((k) => k + 1);
      }
    } catch {
      // silencia — o pin permanece onde está
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      latitude:      parseFloat(form.latitude),
      longitude:     parseFloat(form.longitude),
      radius_meters: parseInt(form.radius_meters, 10),
      contract_id:   form.contract_id || undefined,
    });
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{isEdit ? 'Editar Posto' : 'Novo Posto'}</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.row2}>
            <div style={styles.field}>
              <label style={styles.label}>Nome *</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} style={styles.input} />
            </div>
            <div style={{ ...styles.field, width: 120 }}>
              <label style={styles.label}>Código *</label>
              <input required value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} style={styles.input} />
            </div>
            <div style={{ ...styles.field, width: 110 }}>
              <label style={styles.label}>Raio (m)</label>
              <input type="number" min="10" max="5000" value={form.radius_meters}
                onChange={(e) => set('radius_meters', e.target.value)} style={styles.input} />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Endereço (opcional)</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} style={styles.input} placeholder="Apenas para exibição" />
          </div>

          {userRole === 'admin' && contracts.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>Contrato</label>
              <select value={form.contract_id} onChange={(e) => set('contract_id', e.target.value)} style={styles.input}>
                <option value="">Sem contrato</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Localização no mapa</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAddress())}
                placeholder="Buscar endereço..."
                style={{ ...styles.input, flex: 1 }}
              />
              <button type="button" onClick={searchAddress} disabled={searching}
                style={{ ...styles.saveBtn, width: 'auto', padding: '0 16px', background: '#64748b' }}>
                {searching ? '...' : 'Buscar'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
              Clique no mapa para posicionar o pin. Lat: {form.latitude.toFixed(5)} | Lon: {form.longitude.toFixed(5)}
            </p>

            <div style={{ height: 300, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
              <MapContainer
                key={mapKey}
                center={mapCenter}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickHandler onMapClick={handleMapClick} />
                <Marker position={[form.latitude, form.longitude]} />
                <Circle
                  center={[form.latitude, form.longitude]}
                  radius={parseInt(form.radius_meters, 10) || 100}
                  pathOptions={{ color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 0.1 }}
                />
              </MapContainer>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
            <button type="submit" style={styles.saveBtn}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680,
    maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' },
  row2: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, flex: 1 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', outline: 'none' },
  cancelBtn: { padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151' },
  saveBtn:   { padding: '10px 24px', background: '#1d4ed8', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' },
};
