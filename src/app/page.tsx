'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
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
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, MapPin, Clock, Phone, FileText, BarChart3, Users, Truck,
  ChevronRight, Search, Plus, Bell, Settings, LogOut, TrendingUp,
  Navigation, CheckCircle2, Circle, AlertCircle, Zap, Shield, Receipt,
  ArrowUpRight, ArrowDownRight, Send, Star, CreditCard,
  Building2, Route, Calendar, Filter, Eye, Bike, Menu, X,
  Timer, MapPinned, LayoutDashboard, ChevronLeft, FileCheck2,
  CircleDollarSign, Wallet, MessageCircle, Download, Loader2
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ============================================================
// TYPES
// ============================================================
type View = 'dashboard' | 'commander' | 'suivi' | 'facturation' | 'forfaits' | 'livreurs' | 'parametres';

interface Delivery {
  id: string;
  reference: string;
  type: string;
  status: string;
  pickup: string;
  dropoff: string;
  recipientName?: string;
  recipientPhone?: string;
  description?: string;
  priority: string;
  price: number;
  createdAt: string;
  livreur?: { id: string; name: string; phone: string; vehicle: string; status: string } | null;
  company?: { id: string; name: string } | null;
  timeline?: { id: string; event: string; comment: string; timestamp: string }[];
}

interface Livreur {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  zone: string;
  rating: number;
  status: string;
  coursesDone: number;
  deliveriesCount: number;
  activeDeliveries: number;
  completedToday: number;
}

interface Invoice {
  id: string;
  reference: string;
  period: string;
  amount: number;
  coursesCount: number;
  status: string;
  paidDate?: string | null;
  createdAt: string;
  company?: { id: string; name: string; nif: string; rccm: string } | null;
  _count?: { deliveries: number };
}

interface DashboardStats {
  livraisonsActives: number;
  completeesAujourdhui: number;
  tempsMoyenPriseEnCharge: number;
  coursesMensuelles: {
    utilisees: number;
    limite: number;
    restantes: number;
    pourcentage: number;
  };
  depensesMensuelles: number;
  repartitionStatut: { statut: string; nombre: number }[];
  repartitionType: { type: string; nombre: number }[];
}

interface Company {
  id: string;
  name: string;
  nif?: string;
  rccm?: string;
  address?: string;
  sector?: string;
  email?: string;
  phone?: string;
  plan: string;
  planLimit: number;
}

// ============================================================
// STATUS HELPERS
// ============================================================
const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  en_attente: { label: 'En attente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  prise_en_charge: { label: 'Pris en charge', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: <Package className="w-3 h-3" /> },
  en_course: { label: 'En course', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Navigation className="w-3 h-3" /> },
  livre: { label: 'Livree', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle2 className="w-3 h-3" /> },
  annulee: { label: 'Annulee', color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="w-3 h-3" /> },
  disponible: { label: 'Disponible', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  pause: { label: 'En pause', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  payee: { label: 'Payee', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  en_retard: { label: 'En retard', color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="w-3 h-3" /> },
};

const StatusBadge = ({ status }: { status: string }) => {
  const key = status === 'en_retard' ? 'en_retard' : status === 'payee' ? 'payee' : status;
  const cfg = statusConfig[key] || statusConfig.en_attente;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1 text-xs font-medium`}>
      {cfg.icon} {cfg.label}
    </Badge>
  );
};

const formatPrice = (p: number) => p.toLocaleString('fr-FR');
const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return d;
  }
};
const formatDateFull = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

const planLabels: Record<string, string> = {
  decouverte: 'Pack Decouverte',
  business: 'Pack Business',
  premium: 'Pack Premium',
};

// ============================================================
// SHARED COMPONENTS
// ============================================================
function StatCard({ title, value, subtitle, icon, trend, trendUp, loading }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; trend?: string; trendUp?: boolean; loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold tracking-tight">{value}</p>}
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && !loading && (
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

function MiniMap() {
  const [activeDot, setActiveDot] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setActiveDot(d => (d + 1) % 4), 2000);
    return () => clearInterval(interval);
  }, []);

  const points = [
    { label: 'Depart', x: 25, y: 65, color: 'bg-emerald-500' },
    { label: 'Point actuel', x: 45, y: 45, color: 'bg-primary animate-pulse' },
    { label: 'Intermediaire', x: 60, y: 35, color: 'bg-amber-400' },
    { label: 'Arrivee', x: 80, y: 20, color: 'bg-red-500' },
  ];

  return (
    <div className="relative w-full h-48 bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 rounded-xl overflow-hidden border">
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#16a34a" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <path d="M 25% 65% Q 35% 55% 45% 45% T 60% 35% T 80% 20%" fill="none" stroke="#16a34a" strokeWidth="2" strokeDasharray="6,4" opacity="0.6" />
      </svg>
      {points.map((p, i) => (
        <div key={i} className={`absolute flex flex-col items-center gap-0.5 transition-all duration-1000 ${i <= activeDot ? 'opacity-100' : 'opacity-30'}`}>
          <span className="text-[10px] font-medium text-muted-foreground bg-white/80 px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">{p.label}</span>
          <div className={`w-3 h-3 rounded-full ${p.color} shadow-lg ${i === activeDot ? 'ring-4 ring-emerald-200' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
        </div>
      ))}
      <div className="absolute bottom-1 left-2 text-[9px] text-muted-foreground/60 font-medium">Centre-ville</div>
      <div className="absolute bottom-1 right-2 text-[9px] text-muted-foreground/60 font-medium">Tie-Tie</div>
      <div className="absolute top-1 right-2 text-[9px] text-muted-foreground/60 font-medium">Zone portuaire</div>
      <div className="absolute top-1 left-2 text-[9px] text-muted-foreground/60 font-medium">Lumumba</div>
    </div>
  );
}

// ============================================================
// LOGIN / REGISTER UI
// ============================================================
function AuthForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('business');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('Email ou mot de passe incorrect');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, companyName, phone, plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        return;
      }
      // Auto-login after register
      await signIn('credentials', { email, password, redirect: false });
    } catch {
      setError("Erreur serveur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-emerald-700 to-teal-800" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-teal-200/10 blur-3xl" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-8 left-8 opacity-20">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="40" r="35" stroke="white" strokeWidth="2" strokeDasharray="8 4" />
          <path d="M25 40 L35 30 L35 36 L55 36 L55 44 L35 44 L35 50 Z" fill="white" fillOpacity="0.5" />
        </svg>
      </div>
      <div className="absolute bottom-12 right-12 opacity-15">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="50" height="50" rx="8" stroke="white" strokeWidth="2" strokeDasharray="6 3" />
          <circle cx="30" cy="30" r="12" stroke="white" strokeWidth="2" />
        </svg>
      </div>

      <Card className="relative z-10 w-full max-w-md shadow-2xl border-0">
        <CardContent className="p-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-emerald-700 p-6 rounded-t-xl text-white text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
              <Bike className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold">CoursierB2B</h1>
            <p className="text-sm opacity-80 mt-1">Pointe-Noire, Republique du Congo</p>
          </div>

          <div className="p-6">
            {/* Tab Toggle */}
            <div className="flex bg-muted rounded-lg p-1 mb-6">
              <button
                onClick={() => { setIsRegister(false); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isRegister ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Connexion
              </button>
              <button
                onClick={() => { setIsRegister(true); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isRegister ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Creer un compte
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {!isRegister ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="votre@email.cg"
                      className="pl-9"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mot de passe</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Votre mot de passe"
                      className="pl-9"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Se connecter
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Pas encore de compte ?{' '}
                  <button type="button" onClick={() => { setIsRegister(true); setError(''); }} className="text-primary font-medium hover:underline">
                    Creer un compte
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom complet</label>
                  <Input
                    placeholder="Jean Dupont"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom de l'entreprise</label>
                  <Input
                    placeholder="Votre entreprise SARL"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="votre@email.cg"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telephone</label>
                    <Input
                      placeholder="+242 06 XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Forfait</label>
                    <Select value={plan} onValueChange={setPlan}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="decouverte">Decouverte</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mot de passe</label>
                  <Input
                    type="password"
                    placeholder="6 caracteres minimum"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Creer mon compte
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Deja inscrit ?{' '}
                  <button type="button" onClick={() => { setIsRegister(false); setError(''); }} className="text-primary font-medium hover:underline">
                    Se connecter
                  </button>
                </p>
              </form>
            )}

            <Separator className="my-5" />
            <p className="text-center text-[11px] text-muted-foreground">
              Service de coursier professionnel B2B - Pointe-Noire, Congo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// SIDEBAR NAVIGATION
// ============================================================
const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'commander', label: 'Commander', icon: <Plus className="w-4 h-4" /> },
  { id: 'suivi', label: 'Suivi courses', icon: <Navigation className="w-4 h-4" /> },
  { id: 'facturation', label: 'Facturation', icon: <Receipt className="w-4 h-4" /> },
  { id: 'forfaits', label: 'Forfaits', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'livreurs', label: 'Livreurs', icon: <Bike className="w-4 h-4" /> },
  { id: 'parametres', label: 'Parametres', icon: <Settings className="w-4 h-4" /> },
];

function Sidebar({ current, onNavigate, open, onClose, companyName, planLabel }: { current: View; onNavigate: (v: View) => void; open: boolean; onClose: () => void; companyName: string; planLabel: string }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="p-5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Bike className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight">CoursierB2B</h1>
                <p className="text-[10px] text-muted-foreground">Pointe-Noire</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {companyName.slice(0, 3).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{companyName}</p>
              <p className="text-[11px] text-muted-foreground">{planLabel}</p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">Actif</Badge>
          </div>
        </div>

        {/* Nav Items */}
        <ScrollArea className="flex-1 py-3">
          <nav className="px-3 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${current === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t">
          <div className="bg-gradient-to-r from-primary/5 to-emerald-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold">WhatsApp Business</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Commandez aussi via WhatsApp pour plus de rapidite.</p>
            <Button variant="outline" size="sm" className="w-full mt-2 h-7 text-xs gap-1.5">
              <MessageCircle className="w-3 h-3" /> Ouvrir WhatsApp
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// VIEWS
// ============================================================

function DashboardView({ companyName, planLabel, companyData, onRefreshDeliveries }: {
  companyName: string; planLabel: string; companyData: Company | null; onRefreshDeliveries?: () => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.statistiques);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch('/api/deliveries');
      if (res.ok) {
        const data = await res.json();
        const active = (data.livraisons || []).filter((d: Delivery) => !['livre', 'annulee'].includes(d.status));
        setActiveDeliveries(active);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchDeliveries()]);
      setLoading(false);
    };
    load();
  }, [fetchStats, fetchDeliveries]);

  // Socket.io integration
  useEffect(() => {
    const socket = io('/?XTransformPort=3003');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('status:update', () => {
      fetchDeliveries();
      fetchStats();
      onRefreshDeliveries?.();
    });

    socket.on('location:update', () => {
      // Could update the map tracking dot here
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchDeliveries, fetchStats, onRefreshDeliveries]);

  const planUsage = stats ? stats.coursesMensuelles.pourcentage : 0;
  const monthlyCourses = stats?.coursesMensuelles.utilisees || 0;
  const planLimit = companyData?.planLimit || 30;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary to-emerald-700 text-primary-foreground border-0 overflow-hidden relative">
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm opacity-80">Bienvenue,</p>
              <h2 className="text-2xl font-bold mt-1">{companyName}</h2>
              <p className="text-sm opacity-80 mt-2">{planLabel} - {monthlyCourses} / {planLimit} courses ce mois</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="h-2 w-40 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${planUsage}%` }} />
                </div>
                <span className="text-xs font-medium">{planUsage}%</span>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">{planLabel}</Badge>
            </div>
          </div>
        </CardContent>
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5" />
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Courses actives" value={String(stats?.livraisonsActives ?? 0)} subtitle="En cours maintenant" icon={<Package className="w-5 h-5" />} loading={loading} />
        <StatCard title="Livrees aujourd'hui" value={String(stats?.completeesAujourdhui ?? 0)} subtitle="Ce jour" icon={<CheckCircle2 className="w-5 h-5" />} trend="+12%" trendUp loading={loading} />
        <StatCard title="Temps moyen" value={`${stats?.tempsMoyenPriseEnCharge ?? 0} min`} subtitle="Prise en charge" icon={<Timer className="w-5 h-5" />} trend="-3 min" trendUp loading={loading} />
        <StatCard title="Ce mois" value={`${monthlyCourses}/${planLimit}`} subtitle="Courses utilisees" icon={<BarChart3 className="w-5 h-5" />} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Deliveries */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Courses en cours</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { fetchDeliveries(); fetchStats(); }}>
                <Eye className="w-3.5 h-3.5" /> Rafraichir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))
            ) : activeDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune course en cours</p>
              </div>
            ) : (
              activeDeliveries.map(d => (
                <div key={d.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {d.type === 'express' ? <Zap className="w-5 h-5 text-amber-600" /> : <Package className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{d.reference}</span>
                      <StatusBadge status={d.status} />
                      {d.priority === 'urgente' && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">URGENT</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{d.pickup}</span>
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      <span className="truncate">{d.dropoff}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatPrice(d.price)} <span className="text-[10px] text-muted-foreground">FCFA</span></p>
                    {d.livreur && <p className="text-[10px] text-muted-foreground mt-0.5">{d.livreur.name}</p>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Live Tracking Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Suivi en direct</CardTitle>
            <CardDescription>{activeDeliveries[0]?.reference || 'Aucune course'} - {activeDeliveries[0]?.type || ''}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MiniMap />
            {activeDeliveries[0] ? (
              <>
                <div className="space-y-2.5">
                  {(activeDeliveries[0].timeline || []).slice(0, 3).map((t, i) => {
                    const isActive = i === (activeDeliveries[0].timeline?.length ?? 1) - 1;
                    const isDone = ['commande_creee', 'pris_en_charge', 'livre'].includes(t.event);
                    return (
                      <div key={t.id} className={`flex items-center gap-2.5 ${!isDone && !isActive ? 'opacity-40' : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isDone ? 'bg-emerald-500' : isActive ? 'bg-primary animate-pulse' : 'bg-muted'}`}>
                          {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : isActive ? <Navigation className="w-3.5 h-3.5 text-white" /> : <Circle className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs ${isActive ? 'font-semibold text-primary' : 'font-medium'}`}>{t.comment}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(t.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Livreur</span>
                  <div className="flex items-center gap-1.5">
                    {activeDeliveries[0].livreur && (
                      <>
                        <Avatar className="w-5 h-5"><AvatarFallback className="text-[9px] bg-primary/10 text-primary">{activeDeliveries[0].livreur.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                        <span className="font-medium">{activeDeliveries[0].livreur.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <Button className="w-full gap-2" size="sm">
                  <Phone className="w-3.5 h-3.5" /> Contacter le livreur
                </Button>
              </>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Navigation className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Aucune course active a suivre</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CommanderView() {
  const [orderType, setOrderType] = useState('standard');
  const [submitted, setSubmitted] = useState(false);
  const [createdRef, setCreatedRef] = useState('');
  const [createdPrice, setCreatedPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normale');
  const [paymentMode, setPaymentMode] = useState('forfait');
  const [instructions, setInstructions] = useState('');

  const handleSubmit = async () => {
    if (!pickup || !dropoff) { setError('Les adresses de depart et de livraison sont obligatoires'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: orderType, pickup, dropoff, recipientName, recipientPhone, description, priority, paymentMode, instructions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.erreur || 'Erreur lors de la creation de la course');
        return;
      }
      setCreatedRef(data.livraison.reference);
      setCreatedPrice(data.livraison.price);
      setSubmitted(true);
    } catch {
      setError('Erreur serveur');
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = orderType === 'inter-arrondissement' ? 'Inter-arrondissements' : orderType.charAt(0).toUpperCase() + orderType.slice(1);

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold">Course creee avec succes !</h2>
        <p className="text-muted-foreground">Votre commande {createdRef} a ete enregistree. Un livreur vous sera assigne dans les plus brefs delais.</p>
        <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reference</span><span className="font-semibold">{createdRef}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><span className="font-semibold">{typeLabel}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tarif</span><span className="font-semibold text-primary">{formatPrice(createdPrice)} FCFA</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Statut</span><StatusBadge status="en_attente" /></div>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setSubmitted(false); setPickup(''); setDropoff(''); setRecipientName(''); setRecipientPhone(''); setDescription(''); setInstructions(''); }}>Nouvelle course</Button>
          <Button>Suivre la course</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Nouvelle course</h2>
        <p className="text-sm text-muted-foreground mt-1">Creez une demande de livraison en quelques clics</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Type de course</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { value: 'standard', label: 'Standard', price: '2 500 FCFA', desc: 'Intra-muros, delai normal', icon: <Package className="w-5 h-5" /> },
              { value: 'express', label: 'Express', price: '3 500 FCFA', desc: 'Prise en charge prioritaire', icon: <Zap className="w-5 h-5" /> },
              { value: 'inter-arrondissement', label: 'Inter-arrond.', price: '3 500+', desc: 'Au-dela de 8 km', icon: <Route className="w-5 h-5" /> },
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
          <CardTitle className="text-base">Details de la course</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse de depart</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <Input placeholder="Ex: Bd Charles de Gaulle, Centre-ville" className="pl-9" value={pickup} onChange={e => setPickup(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse de livraison</label>
              <div className="relative">
                <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                <Input placeholder="Ex: Zone portuaire, PAPN" className="pl-9" value={dropoff} onChange={e => setDropoff(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Destinataire</label>
              <Input placeholder="Nom du contact" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telephone destinataire</label>
              <Input placeholder="+242 06 XXX XXXX" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description du pli / colis</label>
            <Textarea placeholder="Ex: Dossier de credit bancaire, enveloppe confidentielle, 3 cheques..." rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Priorite</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="urgente">Urgente (banques, urgences)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode de paiement</label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="forfait">Inclus dans le forfait</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money (Airtel/Moov)</SelectItem>
                  <SelectItem value="virement">Virement bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Instructions supplementaires</label>
            <Textarea placeholder="Ex: Appeler avant livraison, demander M. Okombi au bureau 204..." rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-muted/30">
        <CardContent className="p-5">
          <h3 className="font-semibold text-sm mb-3">Resume de la commande</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type de course</span><span className="font-medium">{typeLabel}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tarif</span><span className="font-bold text-primary">{orderType === 'express' ? '3 500' : orderType === 'standard' ? '2 500' : '3 500+'} FCFA</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delai estime</span><span className="font-medium">{orderType === 'express' ? '< 1 heure' : '1-2 heures'}</span></div>
          </div>
          <Button className="w-full mt-4 gap-2" size="lg" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Confirmer la commande
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SuiviView() {
  const [filter, setFilter] = useState('tous');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/deliveries');
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.livraisons || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  const filtered = filter === 'tous' ? deliveries : deliveries.filter(d => d.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Suivi des courses</h2>
          <p className="text-sm text-muted-foreground mt-1">Historique et suivi en temps reel de vos livraisons</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['tous', 'en_attente', 'prise_en_charge', 'en_course', 'livre'].map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="text-xs">
            {f === 'tous' ? 'Toutes' : (statusConfig[f]?.label || f)}
            {f === 'tous' && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{deliveries.length}</Badge>}
          </Button>
        ))}
      </div>

      {/* Delivery List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="flex items-center gap-4"><Skeleton className="w-11 h-11 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div></CardContent></Card>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Aucune course trouvee pour ce filtre</p>
          </div>
        ) : (
          filtered.map(d => (
            <Card key={d.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${d.type === 'express' ? 'bg-amber-100 text-amber-700' : d.status === 'livre' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                    {d.status === 'livre' ? <CheckCircle2 className="w-5 h-5" /> : d.type === 'express' ? <Zap className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold">{d.reference}</span>
                      <StatusBadge status={d.status} />
                      {d.type === 'express' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-1"><Zap className="w-2.5 h-2.5" /> Express</Badge>}
                      {d.priority === 'urgente' && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">URGENT</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{d.pickup}</span>
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      <span className="truncate">{d.dropoff}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(d.createdAt)}</span>
                      {d.livreur && <span className="flex items-center gap-1"><Bike className="w-3 h-3" /> {d.livreur.name}</span>}
                      <span className="font-semibold text-foreground">{formatPrice(d.price)} FCFA</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                {d.status === 'en_course' && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-xs font-medium text-primary">En livraison - Suivi GPS actif</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function FacturationView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [invRes, statsRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/dashboard/stats'),
        ]);
        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoices(invData.factures || []);
        }
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.statistiques);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const unpaidInvoices = invoices.filter(i => i.status !== 'payee');
  const paidInvoices = invoices.filter(i => i.status === 'payee');
  const totalUnpaid = unpaidInvoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = paidInvoices.reduce((s, i) => s + i.amount, 0);

  const handleDownloadPdf = async (invoiceId: string, ref: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Facturation</h2>
        <p className="text-sm text-muted-foreground mt-1">Factures mensuelles consolidees conformes TVA</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="En attente" value={`${(totalUnpaid / 1000).toFixed(0)} k`} subtitle="FCFA a regler" icon={<Clock className="w-5 h-5" />} loading={loading} />
        <StatCard title="Payees ce mois" value={`${(totalPaid / 1000).toFixed(0)} k`} subtitle="FCFA regles" icon={<CheckCircle2 className="w-5 h-5" />} trend="+8%" trendUp loading={loading} />
        <StatCard title="Ce mois" value={`${((totalUnpaid + totalPaid) / 1000).toFixed(0)} k`} subtitle="FCFA" icon={<Receipt className="w-5 h-5" />} loading={loading} />
      </div>

      {/* Billing Note */}
      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Facturation conforme TVA</p>
            <p className="text-xs text-emerald-700 mt-0.5">Toutes vos factures incluent le numero RCCM, la TVA calculee separement et sont deductible fiscalement. Telechargeable en PDF a tout moment.</p>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Historique des factures</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50"><Skeleton className="w-10 h-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="h-4 w-20" /></div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune facture</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{inv.reference}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{inv.period}</span>
                      <span>-</span>
                      <span>{inv.coursesCount} courses</span>
                      {inv.paidDate && <span>- Payee le {formatDateFull(inv.paidDate)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatPrice(inv.amount)} <span className="text-[10px] text-muted-foreground">FCFA</span></p>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 mt-1 text-primary" onClick={() => handleDownloadPdf(inv.id, inv.reference)}>
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ForfaitsView() {
  const plans = [
    {
      name: 'Pack Decouverte',
      price: '75 000',
      target: 'PME < 10 courses/mois',
      features: ['10 courses incluses/mois', 'Suivi GPS en temps reel', 'Facture mensuelle conforme TVA', 'Support WhatsApp', 'Paiement Mobile Money'],
      highlight: false,
      color: 'border-border',
    },
    {
      name: 'Pack Business',
      price: '180 000',
      target: 'Banques, PME 10-30 courses/mois',
      features: ['30 courses incluses/mois', 'SLA prioritaire (prise en charge < 30 min)', 'Suivi GPS en temps reel', 'Facture mensuelle conforme TVA', 'Gestionnaire de compte dedie', 'Reporting mensuel detaille', 'Support prioritaire'],
      highlight: true,
      color: 'border-primary',
    },
    {
      name: 'Pack Premium',
      price: '350 000',
      target: 'Grands comptes, +30 courses/mois',
      features: ['60 courses incluses/mois', 'Coursier dedie assigne', 'SLA garanti (prise en charge < 15 min)', 'Suivi GPS en temps reel', 'Facture mensuelle conforme TVA', 'Gestionnaire de compte senior', 'Reporting hebdomadaire', 'Support 24/7', 'Course hors forfait au tarif reduit'],
      highlight: false,
      color: 'border-border',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto">
        <h2 className="text-xl font-bold">Forfaits mensuels</h2>
        <p className="text-sm text-muted-foreground mt-1">Choisissez le forfait adapte au volume de courses de votre entreprise. Engagement minimum 6 mois.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <Card key={plan.name} className={`relative ${plan.highlight ? 'border-2 border-primary shadow-lg scale-[1.02]' : ''} ${plan.color}`}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3">Recommande</Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2 pt-6">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <CardDescription className="text-xs">{plan.target}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="py-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground ml-1">FCFA/mois</span>
              </div>
              <Separator />
              <ul className="space-y-2.5 text-left">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button className={`w-full mt-2 ${plan.highlight ? '' : 'variant-outline'}`} variant={plan.highlight ? 'default' : 'outline'}>
                {plan.highlight ? 'Votre forfait actuel' : 'Changer de forfait'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* A la carte pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarification a la demande</CardTitle>
          <CardDescription>Sans abonnement, payez par course selon le type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <Package className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="font-semibold text-sm">Standard</p>
              <p className="text-xs text-muted-foreground mt-0.5">Intra-muros</p>
              <p className="text-lg font-bold mt-2">2 500 <span className="text-xs font-normal text-muted-foreground">FCFA</span></p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 text-center">
              <Zap className="w-6 h-6 mx-auto text-amber-600 mb-2" />
              <p className="font-semibold text-sm">Express</p>
              <p className="text-xs text-muted-foreground mt-0.5">Delai &lt; 1h, suivi GPS</p>
              <p className="text-lg font-bold mt-2">3 500 <span className="text-xs font-normal text-muted-foreground">FCFA</span></p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <Route className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="font-semibold text-sm">Inter-arrondissements</p>
              <p className="text-xs text-muted-foreground mt-0.5">Au-dela de 8 km</p>
              <p className="text-lg font-bold mt-2">3 500+ <span className="text-xs font-normal text-muted-foreground">FCFA</span></p>
              <p className="text-[10px] text-muted-foreground">350 FCFA/km supplementaire</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LivreursView() {
  const [livreurs, setLivreurs] = useState<Livreurs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/livreurs');
        if (res.ok) {
          const data = await res.json();
          setLivreurs(data.livreurs || []);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const available = livreurs.filter(l => l.status === 'disponible').length;
  const inRoute = livreurs.filter(l => l.status === 'en_course').length;
  const avgRating = livreurs.length > 0 ? (livreurs.reduce((s, l) => s + l.rating, 0) / livreurs.length).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Equipe livreurs</h2>
        <p className="text-sm text-muted-foreground mt-1">Flotte en temps reel - {livreurs.length} livreurs actifs</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Disponibles" value={String(available)} subtitle="Pret pour une course" icon={<CheckCircle2 className="w-5 h-5" />} loading={loading} />
        <StatCard title="En course" value={String(inRoute)} subtitle="Livraisons en cours" icon={<Navigation className="w-5 h-5" />} loading={loading} />
        <StatCard title="Note moyenne" value={avgRating} subtitle="Sur 5 etoiles" icon={<Star className="w-5 h-5" />} loading={loading} />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-4"><div className="flex items-center gap-3"><Skeleton className="w-11 h-11 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></div><Skeleton className="h-16" /><Skeleton className="h-8 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {livreurs.map(l => (
            <Card key={l.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-11 h-11">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{l.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.vehicle}</p>
                    </div>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold">{l.coursesDone}</p>
                    <p className="text-[10px] text-muted-foreground">Courses</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-lg font-bold">{l.rating}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Note</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>Zone: {l.zone}</span>
                </div>
                <Separator className="my-3" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs">
                    <Phone className="w-3 h-3" /> Appeler
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs">
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ParametresView() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [name, setName] = useState('');
  const [nif, setNif] = useState('');
  const [rccm, setRccm] = useState('');
  const [sector, setSector] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch dashboard stats to get company info
        const statsRes = await fetch('/api/dashboard/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.entreprise) {
            const c = statsData.entreprise;
            setCompany({ id: '', name: c.nom, plan: c.plan, planLimit: c.planLimite });
          }
        }
        // Also try to get company details
        const compRes = await fetch('/api/companies');
        if (compRes.ok) {
          const compData = await compRes.json();
          if (compData.entreprises && compData.entreprises.length > 0) {
            const c = compData.entreprises[0];
            setCompany(prev => prev ? { ...prev, id: c.id, nif: c.nif || '', rccm: c.rccm || '', address: c.address || '', sector: c.sector || '', email: c.email || '', phone: c.phone || '' } : null);
            setName(c.name || '');
            setNif(c.nif || '');
            setRccm(c.rccm || '');
            setSector(c.sector || '');
            setEmail(c.email || '');
            setPhone(c.phone || '');
            setAddress(c.address || '');
          }
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!company?.id) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nif, rccm, sector, email, phone, address }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Parametres</h2>
        <p className="text-sm text-muted-foreground mt-1">Gerez les parametres de votre compte entreprise</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations entreprise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Raison sociale</label>
                  <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">NIF</label>
                  <Input value={nif} onChange={e => setNif(e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">RCCM</label>
                  <Input value={rccm} onChange={e => setRccm(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secteur</label>
                  <Input value={sector} onChange={e => setSector(e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email facturation</label>
                  <Input value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telephone principal</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Adresse siege</label>
                <Input value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Button className="gap-2" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sauvegarder
                </Button>
                {saveSuccess && <span className="text-sm text-emerald-600 font-medium">Sauvegarde avec succes !</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'Notification de prise en charge', desc: 'Recevoir une alerte quand un livreur est assigne', defaultChecked: true },
            { label: 'Notification de livraison', desc: 'Recevoir une alerte quand le pli est livre', defaultChecked: true },
            { label: 'Rapport hebdomadaire par email', desc: 'Recapitulatif des courses de la semaine', defaultChecked: false },
            { label: 'Alerte facture disponible', desc: 'Notification quand la facture mensuelle est prete', defaultChecked: true },
          ].map(n => (
            <div key={n.label} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <input type="checkbox" defaultChecked={n.defaultChecked} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-600">Zone dangereuse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Ces actions sont irreversibles.</p>
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Deconnecter le compte
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function Home() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [deliveryRefreshKey, setDeliveryRefreshKey] = useState(0);

  const refreshDeliveries = useCallback(() => {
    setDeliveryRefreshKey(k => k + 1);
  }, []);

  // Show loading or auth form
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-emerald-700 to-teal-800">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  const companyName = (session.user as Record<string, string>)?.name || 'Mon Entreprise';
  const userRole = (session.user as Record<string, string>)?.role || 'client';
  const planLabel = 'Mon forfait';

  const viewMap: Record<View, React.ReactNode> = {
    dashboard: <DashboardView key={deliveryRefreshKey} companyName={companyName} planLabel={planLabel} companyData={null} onRefreshDeliveries={refreshDeliveries} />,
    commander: <CommanderView />,
    suivi: <SuiviView />,
    facturation: <FacturationView />,
    forfaits: <ForfaitsView />,
    livreurs: <LivreursView />,
    parametres: <ParametresView />,
  };

  const pageTitle: Record<View, string> = {
    dashboard: 'Tableau de bord',
    commander: 'Commander une course',
    suivi: 'Suivi des courses',
    facturation: 'Facturation',
    forfaits: 'Forfaits',
    livreurs: 'Livreurs',
    parametres: 'Parametres',
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar current={currentView} onNavigate={setCurrentView} open={sidebarOpen} onClose={() => setSidebarOpen(false)} companyName={companyName} planLabel={planLabel} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 lg:px-6 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>

          <h2 className="font-semibold text-sm hidden sm:block">{pageTitle[currentView]}</h2>

          <div className="flex-1" />

          {/* Search */}
          <Button variant="ghost" size="icon" className="relative" onClick={() => setSearchOpen(!searchOpen)}>
            <Search className="w-4 h-4" />
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          {/* Mobile Money */}
          <Badge variant="outline" className="hidden sm:flex gap-1.5 text-xs">
            <Wallet className="w-3 h-3" /> Mobile Money
          </Badge>
        </header>

        {/* Search Bar (expandable) */}
        {searchOpen && (
          <div className="px-4 lg:px-6 py-3 border-b bg-muted/30">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher une course, un client..." className="pl-9" autoFocus />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {viewMap[currentView]}
        </main>

        {/* Footer */}
        <footer className="border-t px-4 lg:px-6 py-3 mt-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>CoursierB2B Pointe-Noire - Republique du Congo</p>
            <p className="hidden sm:block">RCCM: XXXXX-PN - NIF: XXXXX - TVA: 18,9%</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
