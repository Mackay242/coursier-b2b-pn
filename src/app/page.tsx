'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Package, MapPin, Clock, Phone, FileText, BarChart3, Users, Truck,
  ChevronRight, Search, Plus, Bell, Settings, LogOut, TrendingUp,
  Navigation, CheckCircle2, Circle, AlertCircle, Zap, Shield, Receipt,
  ArrowUpRight, ArrowDownRight, Menu, X, Send, Star, CreditCard,
  Building2, Droplets, Briefcase, Route, Calendar, Filter, Eye,
  MessageSquare, Globe, ChevronDown, Timer, MapPinned, Bike
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
type Role = 'client' | 'livreur' | 'admin';

interface Delivery {
  id: string;
  reference: string;
  type: 'standard' | 'express' | 'inter-arrondissement';
  status: 'en_attente' | 'prise_en_charge' | 'en_course' | 'livre' | 'annulee';
  client: string;
  pickup: string;
  dropoff: string;
  livreur?: string;
  createdAt: string;
  price: number;
  priority: 'normale' | 'haute' | 'urgente';
}

// ============================================================
// MOCK DATA
// ============================================================
const NOW = new Date();
const fmt = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

const deliveries: Delivery[] = [
  { id: '1', reference: 'CMD-20260730-001', type: 'express', status: 'en_course', client: 'BGFI Bank Congo', pickup: 'Av. de l\'Ind\u00e9pendance, Centre-ville', dropoff: 'Bd Charles de Gaulle, Ti\u00e9-Ti\u00e9', livreur: 'Mouamba P.', createdAt: fmt(8, 15), price: 3500, priority: 'haute' },
  { id: '2', reference: 'CMD-20260730-002', type: 'standard', status: 'prise_en_charge', client: 'Cabinet Okombi & Associ\u00e9s', pickup: 'Zone portuaire, PAPN', dropoff: 'Rue du Commerce, Lumumba', livreur: 'N\u2019Goma J.', createdAt: fmt(8, 32), price: 2500, priority: 'normale' },
  { id: '3', reference: 'CMD-20260730-003', type: 'inter-arrondissement', status: 'en_attente', client: 'TotalEnergies E&P', pickup: 'Base industrielle Djeno', dropoff: 'Si\u00e8ge social, Centre-ville', createdAt: fmt(8, 45), price: 5000, priority: 'normale' },
  { id: '4', reference: 'CMD-20260730-004', type: 'standard', status: 'livre', client: 'Ecobank Congo', pickup: 'Bd Denis Sassou, Centre-ville', dropoff: 'Mairie de Pointe-Noire', livreur: 'Mouamba P.', createdAt: fmt(7, 50), price: 2500, priority: 'normale' },
  { id: '5', reference: 'CMD-20260730-005', type: 'express', status: 'en_attente', client: 'Soci\u00e9t\u00e9 G\u00e9n\u00e9rale Congo', pickup: 'Av. Amilcar Cabral', dropoff: 'Douanes, Port Autonome', createdAt: fmt(8, 50), price: 3500, priority: 'urgente' },
  { id: '6', reference: 'CMD-20260729-018', type: 'standard', status: 'livre', client: 'BICEC', pickup: 'Centre-ville', dropoff: 'Arrondissement 3, Ngoyo', livreur: 'Tchikoula R.', createdAt: fmt(16, 20), price: 3000, priority: 'normale' },
];

const livreurs = [
  { id: '1', name: 'Mouamba Patrick', status: 'en_course', courses: 4, rating: 4.8, zone: 'Centre-ville', vehicle: 'Moto Haojin 125', phone: '+242 06 123 4567' },
  { id: '2', name: "N'Goma Jean", status: 'disponible', courses: 2, rating: 4.5, zone: 'Ti\u00e9-Ti\u00e9', vehicle: 'Moto Jialing 110', phone: '+242 06 234 5678' },
  { id: '3', name: 'Tchikoula Raoul', status: 'en_course', courses: 3, rating: 4.9, zone: 'Lumumba', vehicle: 'Moto Loncin 125', phone: '+242 06 345 6789' },
  { id: '4', name: 'Makosso Brice', status: 'disponible', courses: 1, rating: 4.2, zone: 'Zone portuaire', vehicle: 'Moto Haojin 110', phone: '+242 06 456 7890' },
  { id: '5', name: 'Loemba Fabrice', status: 'pause', courses: 3, rating: 4.6, zone: 'Ngoyo', vehicle: 'Toyota Corolla', phone: '+242 06 567 8901' },
];

const clients = [
  { name: 'BGFI Bank Congo', plan: 'Pack Business', courses: 28, mrr: 180000, since: 'Mars 2026' },
  { name: 'TotalEnergies E&P Congo', plan: 'Pack Premium', courses: 55, mrr: 350000, since: 'Janvier 2026' },
  { name: 'Cabinet Okombi & Associ\u00e9s', plan: 'Pack D\u00e9couverte', courses: 8, mrr: 75000, since: 'Juin 2026' },
  { name: 'Ecobank Congo', plan: 'Pack Business', courses: 22, mrr: 180000, since: 'F\u00e9vrier 2026' },
  { name: 'Soci\u00e9t\u00e9 G\u00e9n\u00e9rale Congo', plan: 'Pack Premium', courses: 48, mrr: 350000, since: 'Janvier 2026' },
  { name: 'BICEC', plan: 'Pack Business', courses: 15, mrr: 180000, since: 'Avril 2026' },
  { name: 'ENI Congo', plan: 'Pack Premium', courses: 42, mrr: 350000, since: 'F\u00e9vrier 2026' },
];

const invoices = [
  { id: 'FAC-202607-001', client: 'BGFI Bank Congo', period: 'Juillet 2026', amount: 245000, status: 'pay\u00e9e', courses: 28 },
  { id: 'FAC-202607-002', client: 'TotalEnergies E&P', period: 'Juillet 2026', amount: 475000, status: 'en_attente', courses: 55 },
  { id: 'FAC-202607-003', client: 'Ecobank Congo', period: 'Juillet 2026', amount: 185000, status: 'pay\u00e9e', courses: 22 },
  { id: 'FAC-202606-001', client: 'Soci\u00e9t\u00e9 G\u00e9n\u00e9rale Congo', period: 'Juin 2026', amount: 520000, status: 'pay\u00e9e', courses: 48 },
];

// ============================================================
// STATUS HELPERS
// ============================================================
const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  en_attente: { label: 'En attente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  prise_en_charge: { label: 'Pris en charge', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: <Package className="w-3 h-3" /> },
  en_course: { label: 'En course', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Navigation className="w-3 h-3" /> },
  livre: { label: 'Livré', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> },
  annulee: { label: 'Annulée', color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="w-3 h-3" /> },
  disponible: { label: 'Disponible', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  en_course_livreur: { label: 'En course', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: <Navigation className="w-3 h-3" /> },
  pause: { label: 'En pause', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = statusConfig[status] || statusConfig.en_attente;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1 text-xs font-medium`}>
      {cfg.icon} {cfg.label}
    </Badge>
  );
};

const typeLabels: Record<string, string> = {
  standard: 'Standard',
  express: 'Express',
  'inter-arrondissement': 'Inter-arrondissements',
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  normale: { label: 'Normale', color: 'text-muted-foreground' },
  haute: { label: 'Haute', color: 'text-amber-600' },
  urgente: { label: 'Urgente', color: 'text-red-600 font-semibold' },
};

// ============================================================
// COMPONENTS
// ============================================================

function StatCard({ title, value, subtitle, icon, trend, trendUp }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; trend?: string; trendUp?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <div className={`flex items-center gap-1 text-xs mt-2 ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span className="font-medium">{trend}</span>
              </div>
            )}
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mini Map Simulation
function MiniMap() {
  const [activeDot, setActiveDot] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActiveDot(d => (d + 1) % 4), 2000);
    return () => clearInterval(interval);
  }, []);

  const points = [
    { label: 'D\u00e9part', x: 25, y: 65, color: 'bg-emerald-500' },
    { label: 'Point actuel', x: 45, y: 45, color: 'bg-primary animate-pulse' },
    { label: 'Interm\u00e9diaire', x: 60, y: 35, color: 'bg-amber-400' },
    { label: 'Arriv\u00e9e', x: 80, y: 20, color: 'bg-red-500' },
  ];

  return (
    <div className="relative w-full h-48 bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 rounded-xl overflow-hidden border">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#16a34a" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Route path */}
        <path d="M 25% 65% Q 35% 55% 45% 45% T 60% 35% T 80% 20%" fill="none" stroke="#16a34a" strokeWidth="2" strokeDasharray="6,4" opacity="0.6" />
      </svg>
      {/* Points */}
      {points.map((p, i) => (
        <div key={i} className={`absolute flex flex-col items-center gap-0.5 transition-all duration-1000 ${i <= activeDot ? 'opacity-100' : 'opacity-30'}`}>
          <span className="text-[10px] font-medium text-muted-foreground bg-white/80 px-1.5 py-0.5 rounded-full shadow-sm">{p.label}</span>
          <div className={`w-3 h-3 rounded-full ${p.color} shadow-lg ${i === activeDot ? 'ring-4 ring-emerald-200' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
        </div>
      ))}
      {/* Zone labels */}
      <div className="absolute bottom-1 left-2 text-[9px] text-muted-foreground/60 font-medium">Centre-ville</div>
      <div className="absolute bottom-1 right-2 text-[9px] text-muted-foreground/60 font-medium">Ti\u00e9-Ti\u00e9</div>
      <div className="absolute top-1 right-2 text-[9px] text-muted-foreground/60 font-medium">Zone portuaire</div>
      <div className="absolute top-1 left-2 text-[9px] text-muted-foreground/60 font-medium">Lumumba</div>
    </div>
  );
}

// ============================================================
// CLIENT VIEWS
// ============================================================
function ClientDashboard() {
  const activeDeliveries = deliveries.filter(d => d.client === 'BGFI Bank Congo' && !['livre', 'annulee'].includes(d.status));
  const completedToday = deliveries.filter(d => d.client === 'BGFI Bank Congo' && d.status === 'livre').length;
  const monthlyCourses = 28;
  const planLimit = 30;
  const planUsage = Math.round((monthlyCourses / planLimit) * 100);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary to-emerald-700 text-primary-foreground border-0 overflow-hidden relative">
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm opacity-80">Bienvenue,</p>
              <h2 className="text-2xl font-bold mt-1">BGFI Bank Congo</h2>
              <p className="text-sm opacity-80 mt-2">Pack Business \u00b7 28 / 30 courses ce mois</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="h-2 w-40 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${planUsage}%` }} />
                </div>
                <span className="text-xs font-medium">{planUsage}%</span>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">Pack Business</Badge>
              <p className="text-xs opacity-70 mt-2">180 000 FCFA / mois</p>
            </div>
          </div>
        </CardContent>
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5" />
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Courses actives" value={String(activeDeliveries.length)} subtitle="En cours maintenant" icon={<Package className="w-5 h-5" />} />
        <StatCard title="Livr\u00e9es aujourd\'hui" value={String(completedToday)} subtitle="Dont 1 express" icon={<CheckCircle2 className="w-5 h-5" />} trend="+12%" trendUp />
        <StatCard title="Temps moyen" value="18 min" subtitle="Prise en charge" icon={<Timer className="w-5 h-5" />} trend="-3 min" trendUp />
        <StatCard title="Ce mois" value={`${monthlyCourses}/${planLimit}`} subtitle="Courses utilis\u00e9es" icon={<BarChart3 className="w-5 h-5" />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Deliveries */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Courses en cours</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Voir tout
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeDeliveries.map(d => (
              <div key={d.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {d.type === 'express' ? <Zap className="w-5 h-5 text-amber-600" /> : <Package className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{d.reference}</span>
                    <StatusBadge status={d.status} />
                    {d.priority === 'urgente' && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">URGENT</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{d.pickup}</span>
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{d.dropoff}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">{d.price.toLocaleString()} <span className="text-[10px] text-muted-foreground">FCFA</span></p>
                  {d.livreur && <p className="text-[10px] text-muted-foreground mt-0.5">{d.livreur}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Live Tracking Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Suivi en direct</CardTitle>
            <CardDescription>CMD-20260730-001 \u00b7 Express</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MiniMap />
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">Commande prise</p>
                  <p className="text-[10px] text-muted-foreground">08:15</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">Pris en charge</p>
                  <p className="text-[10px] text-muted-foreground">08:22 \u00b7 Mouamba P.</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center animate-pulse">
                  <Navigation className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-primary">En livraison...</p>
                  <p className="text-[10px] text-muted-foreground">Arriv\u00e9e estim\u00e9e: 08:48</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 opacity-40">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <Circle className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">Livr\u00e9</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Livreur</span>
              <div className="flex items-center gap-1.5">
                <Avatar className="w-5 h-5"><AvatarFallback className="text-[9px] bg-primary/10 text-primary">MP</AvatarFallback></Avatar>
                <span className="font-medium">Mouamba P.</span>
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-muted-foreground">4.8</span>
              </div>
            </div>
            <Button className="w-full gap-2" size="sm">
              <Phone className="w-3.5 h-3.5" /> Contacter le livreur
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClientNewOrder() {
  const [orderType, setOrderType] = useState('standard');
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Nouvelle course</h2>
        <p className="text-sm text-muted-foreground mt-1">Cr\u00e9ez une demande de livraison en quelques clics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Type de course</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { value: 'standard', label: 'Standard', price: '2 500 FCFA', desc: 'Intra-muros, d\u00e9lai normal', icon: <Package className="w-5 h-5" /> },
              { value: 'express', label: 'Express', price: '3 500 FCFA', desc: 'Prise en charge prioritaire', icon: <Zap className="w-5 h-5" /> },
              { value: 'inter-arrondissement', label: 'Inter-arrond.', price: '3 500+', desc: 'Au-del\u00e0 de 8 km', icon: <Route className="w-5 h-5" /> },
            ].map(t => (
              <button key={t.value} onClick={() => setOrderType(t.value)} className={`p-4 rounded-xl border-2 text-left transition-all ${orderType === t.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${orderType === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{t.icon}</div>
                <p className="font-semibold text-sm">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                <p className="font-bold text-sm mt-2 text-primary">{t.price}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">D\u00e9tails de la course</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse de d\u00e9part</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <Input placeholder="Ex: Bd Charles de Gaulle, Centre-ville" className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse de livraison</label>
              <div className="relative">
                <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                <Input placeholder="Ex: Zone portuaire, PAPN" className="pl-9" />
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Destinataire</label>
              <Input placeholder="Nom du contact" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">T\u00e9l\u00e9phone destinataire</label>
              <Input placeholder="+242 06 XXX XXXX" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description du pli / colis</label>
            <Textarea placeholder="Ex: Dossier de cr\u00e9dit bancaire, enveloppe confidentielle, 3 ch\u00e8ques...