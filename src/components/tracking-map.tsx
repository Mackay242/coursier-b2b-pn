'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bike, Navigation, Package, Clock, CheckCircle2, Loader2 } from 'lucide-react';

// Pointe-Noire coordinates
const PN_CENTER: [number, number] = [-4.7760, 11.8635];

// Fix Leaflet default marker icons
const createIcon = (color: string, emoji: string) => L.divIcon({
  html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:3px solid white;">${emoji}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
  className: '',
});

const livreurIcon = createIcon('#16a34a', '🏍');
const pickupIcon = createIcon('#3b82f6', '📦');
const dropoffIcon = createIcon('#ef4444', '📍');
const activeLivreurIcon = createIcon('#f59e0b', '🔥');

// Simulated livreur positions (Pointe-Noire zones)
const ZONES_PN = [
  { name: 'Centre-ville', lat: -4.7760, lng: 11.8635 },
  { name: 'Tie-Tie', lat: -4.7900, lng: 11.8450 },
  { name: 'Lumumba', lat: -4.7650, lng: 11.8800 },
  { name: 'Zone portuaire', lat: -4.7700, lng: 11.8400 },
  { name: 'Moukondo', lat: -4.8000, lng: 11.8700 },
  { name: 'Loandjili', lat: -4.7850, lng: 11.8900 },
  { name: 'Mvouti', lat: -4.8100, lng: 11.8550 },
  { name: 'Komba', lat: -4.7550, lng: 11.8500 },
];

interface MapLivreur {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  zone: string;
  status: string;
  activeDeliveries: number;
  lat: number;
  lng: number;
}

interface MapDelivery {
  id: string;
  reference: string;
  status: string;
  pickup: string;
  dropoff: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  livreurName?: string;
  priority: string;
}

function MapBoundsUpdater({ livreurs }: { livreurs: MapLivreur[] }) {
  const map = useMap();
  useEffect(() => {
    if (livreurs.length > 0) {
      const bounds = L.latLngBounds(livreurs.map(l => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [map, livreurs]);
  return null;
}

function AnimatedMarker({ position, icon }: { position: [number, number]; icon: L.DivIcon }) {
  const markerRef = useRef<L.Marker>(null);
  return <Marker position={position} icon={icon} ref={markerRef} />;
}

export default function TrackingMap() {
  const [livreurs, setLivreurs] = useState<MapLivreur[]>([]);
  const [deliveries, setDeliveries] = useState<MapDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLivreur, setSelectedLivreur] = useState<MapLivreur | null>(null);
  const [showDeliveries, setShowDeliveries] = useState(true);
  const [showLivreurs, setShowLivreurs] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const socketRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      const [livRes, delRes] = await Promise.all([
        fetch('/api/livreurs'),
        fetch('/api/deliveries?status=prise_en_charge,en_course'),
      ]);
      if (livRes.ok) {
        const data = await livRes.json();
        const rawLivreurs = data.livreurs || [];
        // Assign simulated GPS positions based on zone
        const mapped: MapLivreur[] = rawLivreurs.map((l: any) => {
          const zone = ZONES_PN.find(z => z.name.toLowerCase().includes(l.zone?.toLowerCase() || '')) || ZONES_PN[Math.floor(Math.random() * ZONES_PN.length)];
          return {
            ...l,
            lat: zone.lat + (Math.random() - 0.5) * 0.008,
            lng: zone.lng + (Math.random() - 0.5) * 0.008,
          };
        });
        setLivreurs(mapped);
      }
      if (delRes.ok) {
        const data = await delRes.json();
        const rawDeliveries = data.livraisons || [];
        const mapped: MapDelivery[] = rawDeliveries.map((d: any) => {
          const pZone = ZONES_PN[Math.floor(Math.random() * ZONES_PN.length)];
          const dZone = ZONES_PN[Math.floor(Math.random() * ZONES_PN.length)];
          return {
            ...d,
            pickupLat: pZone.lat + (Math.random() - 0.5) * 0.005,
            pickupLng: pZone.lng + (Math.random() - 0.5) * 0.005,
            dropoffLat: dZone.lat + (Math.random() - 0.5) * 0.005,
            dropoffLng: dZone.lng + (Math.random() - 0.5) * 0.005,
          };
        });
        setDeliveries(mapped);
      }
    } catch (e) {
      console.error('Map fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Simulate real-time movement for livreurs en_course
  useEffect(() => {
    const interval = setInterval(() => {
      setLivreurs(prev => prev.map(l => {
        if (l.status === 'en_course') {
          return { ...l, lat: l.lat + (Math.random() - 0.5) * 0.0008, lng: l.lng + (Math.random() - 0.5) * 0.0008 };
        }
        return l;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = (s: string) => {
    if (s === 'disponible') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'en_course') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'pause') return 'bg-sky-100 text-sky-700 border-sky-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const statusLabel = (s: string) => {
    if (s === 'disponible') return 'Disponible';
    if (s === 'en_course') return 'En course';
    if (s === 'pause') return 'En pause';
    if (s === 'hors_service') return 'Hors service';
    return s;
  };

  const priorityColor = (p: string) => {
    if (p === 'urgente') return 'border-red-500 bg-red-50';
    if (p === 'haute') return 'border-amber-500 bg-amber-50';
    return 'border-sky-300 bg-sky-50';
  };

  if (loading) {
    return (
      <div className="h-[600px] rounded-xl bg-muted/30 flex items-center justify-center">
        <div className="text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /><p className="text-sm text-muted-foreground mt-2">Chargement de la carte...</p></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend + Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Card className="px-3 py-2"><div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span>Disponible ({livreurs.filter(l => l.status === 'disponible').length})</span></div></Card>
        <Card className="px-3 py-2"><div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-full bg-amber-500" /><span>En course ({livreurs.filter(l => l.status === 'en_course').length})</span></div></Card>
        <Card className="px-3 py-2"><div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded-full bg-gray-400" /><span>Pause / HS ({livreurs.filter(l => l.status !== 'disponible' && l.status !== 'en_course').length})</span></div></Card>
        <div className="flex-1" />
        <div className="flex gap-1">
          <Button variant={showLivreurs ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1" onClick={() => setShowLivreurs(!showLivreurs)}><Bike className="w-3 h-3" /> Livreurs</Button>
          <Button variant={showDeliveries ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1" onClick={() => setShowDeliveries(!showDeliveries)}><Package className="w-3 h-3" /> Courses</Button>
          <Button variant={showRoutes ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1" onClick={() => setShowRoutes(!showRoutes)}><Navigation className="w-3 h-3" /> Itineraires</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Map */}
        <div className={`lg:col-span-${selectedLivreur ? '3' : '4'} rounded-xl overflow-hidden border`}>
          <MapContainer center={PN_CENTER} zoom={13} style={{ height: '600px', width: '100%' }} className="z-0">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsUpdater livreurs={showLivreurs ? livreurs : []} />

            {/* Livreur markers */}
            {showLivreurs && livreurs.map(l => (
              <AnimatedMarker key={l.id} position={[l.lat, l.lng]} icon={l.status === 'en_course' ? activeLivreurIcon : livreurIcon} />
            ))}

            {/* Delivery pickup/dropoff markers + routes */}
            {showDeliveries && deliveries.map(d => (
              <React.Fragment key={d.id}>
                <Marker position={[d.pickupLat, d.pickupLng]} icon={pickupIcon}>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold">{d.reference}</p>
                      <p><Package className="w-3 h-3 inline" /> Depart: {d.pickup}</p>
                      <p><Navigation className="w-3 h-3 inline" /> Arrivee: {d.dropoff}</p>
                      {d.livreurName && <p><Bike className="w-3 h-3 inline" /> {d.livreurName}</p>}
                    </div>
                  </Popup>
                </Marker>
                <Marker position={[d.dropoffLat, d.dropoffLng]} icon={dropoffIcon}>
                  <Popup>
                    <div className="text-xs"><p className="font-bold">{d.reference}</p><p>Destination: {d.dropoff}</p></div>
                  </Popup>
                </Marker>
                {showRoutes && (
                  <Polyline
                    positions={[[d.pickupLat, d.pickupLng], [d.dropoffLat, d.dropoffLng]]}
                    color={d.priority === 'urgente' ? '#ef4444' : d.priority === 'haute' ? '#f59e0b' : '#3b82f6'}
                    weight={3}
                    dashArray="8, 8"
                    opacity={0.7}
                  />
                )}
              </React.Fragment>
            ))}
          </MapContainer>
        </div>

        {/* Side Panel */}
        <div className={`${selectedLivreur ? 'block' : 'hidden lg:block'} space-y-3 max-h-[600px] overflow-y-auto`}>
          {selectedLivreur ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Bike className="w-5 h-5 text-primary" /></div>
                  <div><p className="font-bold text-sm">{selectedLivreur.name}</p><p className="text-xs text-muted-foreground">{selectedLivreur.vehicle}</p></div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Telephone</span><span>{selectedLivreur.phone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Zone</span><span>{selectedLivreur.zone}</span></div>
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">Statut</span><Badge variant="outline" className={`text-[10px] ${statusColor(selectedLivreur.status)}`}>{statusLabel(selectedLivreur.status)}</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Courses actives</span><span className="font-semibold">{selectedLivreur.activeDeliveries}</span></div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs" onClick={() => setSelectedLivreur(null)}>Retour a la liste</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground px-1">Livreurs ({livreurs.length})</p>
              {livreurs.map(l => (
                <Card key={l.id} className={`cursor-pointer hover:shadow-md transition-shadow ${selectedLivreur?.id === l.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedLivreur(l)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${l.status === 'en_course' ? 'bg-amber-500' : l.status === 'disponible' ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                      {l.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{l.name}</p>
                      <p className="text-[10px] text-muted-foreground">{l.zone} - {l.vehicle}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor(l.status)}`}>{statusLabel(l.status)}</Badge>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Active deliveries summary */}
      {deliveries.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-2"><Navigation className="w-3.5 h-3.5" /> Courses en cours ({deliveries.length})</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {deliveries.slice(0, 8).map(d => (
                <div key={d.id} className={`flex items-center gap-2 p-2.5 rounded-lg border ${priorityColor(d.priority)}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${d.status === 'en_course' ? 'bg-amber-500 animate-pulse' : 'bg-sky-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{d.reference}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{d.pickup} → {d.dropoff}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
