'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
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
  CircleDollarSign, Wallet, MessageCircle, Download, Loader2, RefreshCw,
  Monitor, Calculator, FolderOpen, Briefcase, ClipboardList, Gavel, AlertTriangle
} from 'lucide-react';
// Socket.io désactivé sur Vercel (serverless — pas de WebSocket persistant)
// En local, les mises à jour se font par polling automatique
// import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import TrackingMap from '@/components/tracking-map-dynamic';
import { ServicesView, NouvelleTacheView, TachesView, AdminTachesView, MandatsView, SLAMonitorView } from '@/components/prodesk-views';

// ============================================================
// TYPES
// ============================================================
type View = 'dashboard' | 'commander' | 'suivi' | 'facturation' | 'forfaits' | 'livreurs' | 'parametres' | 'dispatch' | 'mes_courses' | 'rapports' | 'paiement' | 'carte' | 'entreprises' | 'whatsapp_bot' | 'services' | 'nouvelle_tache' | 'taches' | 'admin_taches' | 'mandats' | 'sla_monitor';

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

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

interface DispatchStats {
  totalEnAttente: number;
  totalActives: number;
  totalLivreursDispo: number;
  totalLivreursEnCourse: number;
  tempsMoyenAssignation: number;
  repartitionZones: { zone: string; count: number }[];
  revenusAujourdhui: number;
}

interface PaymentRecord {
  id: string;
  transactionId: string;
  provider: string;
  phoneNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  invoice?: { reference: string; period: string };
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
// NOTIFICATION PANEL
// ============================================================
function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.nonLues || 0);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch(`/api/notifications/all?all=true`, { method: 'PATCH' });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const notifIcons: Record<string, React.ReactNode> = {
    new_delivery: <Package className="w-4 h-4" />,
    status_change: <Navigation className="w-4 h-4" />,
    payment: <CircleDollarSign className="w-4 h-4" />,
    system: <Bell className="w-4 h-4" />,
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "A l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Il y a ${hrs}h`;
    return `Il y a ${Math.floor(hrs / 24)}j`;
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={onClose} />}
      <div className={`absolute right-0 top-full mt-2 w-96 max-h-[80vh] bg-card border rounded-xl shadow-2xl z-50 flex flex-col transition-all ${open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && <span className="text-[10px] text-muted-foreground">{unreadCount} non lue(s)</span>}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead} disabled={unreadCount === 0}>Tout marquer lu</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex gap-3"><Skeleton className="w-8 h-8 rounded-full" /><div className="flex-1 space-y-1"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-1/2" /></div></div>)}</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-0 ${!n.read ? 'bg-primary/5' : ''}`} onClick={() => { if (!n.read) markAsRead(n.id); }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{notifIcons[n.type] || <Bell className="w-4 h-4" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
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
  const [role, setRole] = useState('client');
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
        body: JSON.stringify({ email, password, name, companyName, phone, plan, role }),
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
                <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="livreur">Livreur</SelectItem>
                      </SelectContent>
                    </Select>
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
function Sidebar({ current, onNavigate, open, onClose, companyName, planLabel, userRole, pendingCount, whatsappNumber }: { current: View; onNavigate: (v: View) => void; open: boolean; onClose: () => void; companyName: string; planLabel: string; userRole: string; pendingCount: number; whatsappNumber: string }) {
  const whatsappMessage = userRole === 'admin'
    ? 'Bonjour, je souhaite commander une course.\n\nDepart : \nDestination : \nDestinataire : \nType : Standard / Express / Inter-arrondissement'
    : 'Bonjour, je souhaite commander une course.\n\nDepart : \nDestination : \nDestinataire : ';
  const navItems: { id: View; label: string; icon: React.ReactNode; badge?: number }[] = (() => {
    if (userRole === 'admin') return [
      { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'carte', label: 'Carte', icon: <MapPinned className="w-4 h-4" /> },
      { id: 'dispatch', label: 'Dispatch', icon: <Truck className="w-4 h-4" />, badge: pendingCount },
      { id: 'services', label: 'Services admin', icon: <Briefcase className="w-4 h-4" /> },
      { id: 'admin_taches', label: 'Taches admin', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'suivi', label: 'Suivi courses', icon: <Navigation className="w-4 h-4" /> },
      { id: 'facturation', label: 'Facturation', icon: <Receipt className="w-4 h-4" /> },
      { id: 'livreurs', label: 'Livreurs', icon: <Bike className="w-4 h-4" /> },
      { id: 'entreprises', label: 'Entreprises', icon: <Building2 className="w-4 h-4" /> },
      { id: 'mandats', label: 'Mandats', icon: <Gavel className="w-4 h-4" /> },
      { id: 'sla_monitor', label: 'SLA', icon: <Timer className="w-4 h-4" /> },
      { id: 'whatsapp_bot', label: 'WhatsApp Bot', icon: <MessageCircle className="w-4 h-4" /> },
      { id: 'rapports', label: 'Rapports', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'parametres', label: 'Parametres', icon: <Settings className="w-4 h-4" /> },
    ];
    if (userRole === 'livreur') return [
      { id: 'mes_courses', label: 'Mes courses', icon: <Package className="w-4 h-4" /> },
      { id: 'parametres', label: 'Parametres', icon: <Settings className="w-4 h-4" /> },
    ];
    // client
    return [
      { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'commander', label: 'Commander', icon: <Plus className="w-4 h-4" /> },
      { id: 'services', label: 'Services admin', icon: <Briefcase className="w-4 h-4" /> },
      { id: 'nouvelle_tache', label: 'Nouvelle tache', icon: <ClipboardList className="w-4 h-4" /> },
      { id: 'taches', label: 'Mes taches', icon: <FileCheck2 className="w-4 h-4" /> },
      { id: 'suivi', label: 'Suivi courses', icon: <Navigation className="w-4 h-4" /> },
      { id: 'facturation', label: 'Facturation', icon: <Receipt className="w-4 h-4" /> },
      { id: 'forfaits', label: 'Forfaits', icon: <CreditCard className="w-4 h-4" /> },
      { id: 'paiement', label: 'Paiement', icon: <Wallet className="w-4 h-4" /> },
      { id: 'parametres', label: 'Parametres', icon: <Settings className="w-4 h-4" /> },
    ];
  })();
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
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${current === item.id ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t">
          <div className="bg-gradient-to-r from-primary/5 to-emerald-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold">WhatsApp Business</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Commandez aussi via WhatsApp pour plus de rapidite.</p>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" size="sm" className="w-full mt-2 h-7 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                <MessageCircle className="w-3 h-3" /> Ouvrir WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// VIEWS
// ============================================================

function DashboardView({ companyName, planLabel, companyData, onRefreshDeliveries, userRole }: {
  companyName: string; planLabel: string; companyData: Company | null; onRefreshDeliveries?: () => void; userRole?: string;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  // Stats PRODESK
  const [prodeskStats, setProdeskStats] = useState<{ total: number; enCours: number; terminees: number; slaRate: number; mandatsActifs: number; breachedCount: number } | null>(null);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

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

  const fetchProdeskStats = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?limit=0');
      if (res.ok) {
        const data = await res.json();
        const all = data.tasks || [];
        const enCours = all.filter((t: any) => ['en_attente', 'en_cours', 'en_validation'].includes(t.status));
        const terminees = all.filter((t: any) => t.status === 'termine');
        const breached = all.filter((t: any) => t.slaBreached);
        const total = all.length;
        const slaRate = total > 0 ? Math.round(((total - breached.length) / total) * 100) : 100;
        setProdeskStats({ total, enCours: enCours.length, terminees: terminees.length, slaRate, mandatsActifs: 0, breachedCount: breached.length });
      }
    } catch { /* tables pas encore creees */ }
    try {
      const res = await fetch('/api/mandates?status=actif&limit=1');
      if (res.ok) {
        const data = await res.json();
        setProdeskStats(prev => prev ? { ...prev, mandatsActifs: data.total || 0 } : null);
      }
    } catch { /* ignore */ }
    // Dernières tâches
    try {
      const res = await fetch('/api/tasks?limit=5&sort=newest');
      if (res.ok) {
        const data = await res.json();
        setRecentTasks(data.tasks || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const promises = [fetchStats(), fetchDeliveries()];
      if (userRole === 'admin') promises.push(fetchProdeskStats());
      await Promise.all(promises);
      setLoading(false);
    };
    load();
  }, [fetchStats, fetchDeliveries, fetchProdeskStats, userRole]);

  // Auto-refresh (remplace Socket.io sur Vercel)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchDeliveries();
      if (userRole === 'admin') fetchProdeskStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchDeliveries, fetchProdeskStats, userRole]);

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

      {/* Stats Grid — Livraison */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Courses actives" value={String(stats?.livraisonsActives ?? 0)} subtitle="En cours maintenant" icon={<Package className="w-5 h-5" />} loading={loading} />
        <StatCard title="Livrees aujourd'hui" value={String(stats?.completeesAujourdhui ?? 0)} subtitle="Ce jour" icon={<CheckCircle2 className="w-5 h-5" />} trend="+12%" trendUp loading={loading} />
        <StatCard title="Temps moyen" value={`${stats?.tempsMoyenPriseEnCharge ?? 0} min`} subtitle="Prise en charge" icon={<Timer className="w-5 h-5" />} trend="-3 min" trendUp loading={loading} />
        <StatCard title="Ce mois" value={`${monthlyCourses}/${planLimit}`} subtitle="Courses utilisees" icon={<BarChart3 className="w-5 h-5" />} loading={loading} />
      </div>

      {/* Stats Grid — PRODESK (admin uniquement) */}
      {userRole === 'admin' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Taches en cours" value={String(prodeskStats?.enCours ?? '—')} subtitle="Services administratifs" icon={<ClipboardList className="w-5 h-5" />} loading={loading} />
          <StatCard title="SLA respecte" value={prodeskStats ? `${prodeskStats.slaRate}%` : '—'} subtitle="Taux de conformite" icon={<Shield className="w-5 h-5" />} loading={loading} />
          <StatCard title="Mandats actifs" value={String(prodeskStats?.mandatsActifs ?? '—')} subtitle="En vigueur" icon={<Gavel className="w-5 h-5" />} loading={loading} />
          <StatCard title="SLA depasse" value={String(prodeskStats?.breachedCount ?? '—')} subtitle="Hors delai" icon={<AlertTriangle className="w-5 h-5" />} loading={loading} />
        </div>
      )}

      {userRole === 'admin' && recentTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Dernieres taches admin</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5">
                Voir tout <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTasks.slice(0, 4).map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{t.reference}</span>
                    <Badge variant={t.slaBreached ? 'destructive' : 'outline'} className="text-[10px] px-1.5">{t.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.title}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{t.family?.replace(/_/g, ' ') || ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
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

      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp Business</CardTitle>
          <CardDescription>Configurez le numero WhatsApp pour recevoir les commandes de vos clients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Numero WhatsApp (avec indicatif, sans +)</label>
            <Input placeholder="242066120648" defaultValue="242066105805" />
            <p className="text-xs text-muted-foreground">Format : indicatif pays + numero. Ex: 242066120648 pour le Congo</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-emerald-800 mb-1">Comment ca marche ?</p>
            <p className="text-xs text-emerald-700 leading-relaxed">Le bouton "Ouvrir WhatsApp" dans la sidebar ouvre WhatsApp avec un message pre-rempli. Vos clients peuvent ainsi commander directement. Pour un bot automatique, vous pourrez connecter l'API WhatsApp Business plus tard.</p>
          </div>
          <Button variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => window.open('https://wa.me/242066105805?text=Test', '_blank')}>
            <MessageCircle className="w-4 h-4" /> Tester le lien WhatsApp
          </Button>
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
// DISPATCH VIEW (admin only)
// ============================================================
function DispatchView() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [dispatchStats, setDispatchStats] = useState<DispatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('tous');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [res, statsRes] = await Promise.all([
        fetch('/api/dispatch'),
        fetch('/api/dispatch/stats'),
      ]);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.livraisons || []);
        setLivreurs(data.livreurs || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setDispatchStats(statsData);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAssign = async (livreurId: string) => {
    if (!selectedDelivery) return;
    setAssigning(selectedDelivery.id);
    try {
      const res = await fetch('/api/dispatch/assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: selectedDelivery.id, livreurId }),
      });
      if (res.ok) {
        toast.success(`Course ${selectedDelivery.reference} assignee avec succes`);
        setAssignDialogOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.erreur || "Erreur lors de l'assignation");
      }
    } catch { toast.error('Erreur serveur'); } finally { setAssigning(null); }
  };

  const handleStatusChange = async (deliveryId: string, newStatus: string, ref: string) => {
    setStatusUpdating(deliveryId);
    try {
      const res = await fetch(`/api/dispatch/${deliveryId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Course ${ref} - ${statusConfig[newStatus]?.label || newStatus}`);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.erreur || 'Erreur de changement de statut');
      }
    } catch { toast.error('Erreur serveur'); } finally { setStatusUpdating(null); }
  };

  const priorityColors: Record<string, string> = {
    urgente: 'border-l-4 border-l-red-500',
    haute: 'border-l-4 border-l-amber-500',
    normale: 'border-l-4 border-l-sky-400',
  };
  const availableLivreurs = livreurs.filter(l => l.status === 'disponible');
  const getNextStatus = (status: string): string | null => {
    const map: Record<string, string> = { en_attente: 'prise_en_charge', prise_en_charge: 'en_course', en_course: 'livre' };
    return map[status] || null;
  };
  const filtered = filterStatus === 'tous' ? deliveries : deliveries.filter(d => d.status === filterStatus);
  const maxZone = Math.max(...(dispatchStats?.repartitionZones || []).map(z => z.count), 1);
  const zoneColors = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-purple-500'];
  const zonePositions = [[30, 30], [70, 25], [25, 70], [65, 65], [50, 50]];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Centre de Dispatch</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestion des courses et assignation des livreurs en temps reel</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live</Badge>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchData}><Eye className="w-3.5 h-3.5" /> Rafraichir</Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="En attente" value={String(dispatchStats?.totalEnAttente ?? 0)} subtitle="A assigner" icon={<Clock className="w-5 h-5" />} loading={loading} />
        <StatCard title="Actives" value={String(dispatchStats?.totalActives ?? 0)} subtitle="En cours" icon={<Navigation className="w-5 h-5" />} loading={loading} />
        <StatCard title="Livreurs dispo" value={String(dispatchStats?.totalLivreursDispo ?? 0)} subtitle={"sur " + livreurs.length} icon={<Bike className="w-5 h-5" />} loading={loading} />
        <StatCard title="Tps moyen" value={dispatchStats ? `${dispatchStats.tempsMoyenAssignation} min` : '...'} subtitle="Assignation" icon={<Timer className="w-5 h-5" />} loading={loading} />
        <StatCard title="Revenus" value={dispatchStats ? `${(dispatchStats.revenusAujourdhui / 1000).toFixed(1)} k` : '...'} subtitle="FCFA aujourd'hui" icon={<CircleDollarSign className="w-5 h-5" />} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Zone Map */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Repartition zones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(dispatchStats?.repartitionZones || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune donnee</p>
            ) : (
              (dispatchStats?.repartitionZones || []).map((z, i) => (
                <div key={z.zone}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{z.zone}</span>
                    <span className="text-muted-foreground">{z.count}</span>
                  </div>
                  <div className="h-6 bg-muted rounded-lg overflow-hidden">
                    <div className={`h-full rounded-lg ${zoneColors[i % zoneColors.length]} transition-all duration-500 flex items-center justify-end pr-1.5`} style={{ width: `${Math.max((z.count / maxZone) * 100, 10)}%` }}>
                      <span className="text-[9px] text-white font-bold">{Math.round((z.count / maxZone) * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
            <Separator />
            <div className="relative w-full h-32 bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 rounded-xl overflow-hidden border">
              <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                <defs><pattern id="dgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#16a34a" strokeWidth="0.3"/></pattern></defs>
                <rect width="100%" height="100%" fill="url(#dgrid)" />
              </svg>
              {(dispatchStats?.repartitionZones || []).map((z, i) => {
                const pos = zonePositions[i % zonePositions.length];
                const size = Math.max(8, Math.min(24, z.count * 6));
                return (
                  <div key={z.zone} className="absolute flex flex-col items-center" style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, transform: 'translate(-50%, -50%)' }}>
                    <div className="rounded-full bg-primary/80 text-white flex items-center justify-center font-bold text-[10px] animate-pulse" style={{ width: size, height: size }}>{z.count}</div>
                    <span className="text-[8px] mt-0.5 font-medium text-muted-foreground whitespace-nowrap">{z.zone}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Deliveries list */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Courses a traiter ({filtered.length})</CardTitle>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {['tous', 'en_attente', 'prise_en_charge', 'en_course'].map(f => (
                <Button key={f} variant={filterStatus === f ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(f)} className="text-[11px] h-7">
                  {f === 'tous' ? 'Toutes' : (statusConfig[f]?.label || f)}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="max-h-[550px] overflow-y-auto">
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="p-4 rounded-xl bg-muted/50"><Skeleton className="h-4 w-1/3 mb-2" /><Skeleton className="h-3 w-2/3" /></div>))}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Truck className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Aucune course a traiter</p></div>
            ) : (
              <div className="space-y-3">
                {filtered.map(d => {
                  const nextStatus = getNextStatus(d.status);
                  return (
                    <div key={d.id} className={`rounded-xl bg-muted/50 hover:bg-muted transition-colors p-4 ${priorityColors[d.priority] || ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold">{d.reference}</span>
                            <StatusBadge status={d.status} />
                            {d.priority === 'urgente' && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">URGENT</Badge>}
                            {d.priority === 'haute' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">HAUTE</Badge>}
                            {d.company && <span className="text-[10px] text-muted-foreground">{d.company.name}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{d.pickup}</span>
                            <ChevronRight className="w-3 h-3 shrink-0" /><span className="truncate">{d.dropoff}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(d.createdAt)}</span>
                            <span className="font-semibold text-foreground">{formatPrice(d.price)} FCFA</span>
                            {d.livreur && <span className="flex items-center gap-1"><Bike className="w-3 h-3" />{d.livreur.name}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {d.status === 'en_attente' && (
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedDelivery(d); setAssignDialogOpen(true); }}><Users className="w-3 h-3" /> Assigner</Button>
                          )}
                          {nextStatus && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={statusUpdating === d.id} onClick={() => handleStatusChange(d.id, nextStatus, d.reference)}>
                              {statusUpdating === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                              {nextStatus === 'prise_en_charge' && 'Prendre en charge'}
                              {nextStatus === 'en_course' && 'Demarrer course'}
                              {nextStatus === 'livre' && 'Confirmer livraison'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: livreurs panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Equipe livreurs</CardTitle>
            <CardDescription>{availableLivreurs.length} pret(s) sur {livreurs.length}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-3"><Skeleton className="w-9 h-9 rounded-full" /><Skeleton className="h-4 w-28" /></div>))}</div>
            ) : livreurs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun livreur</p>
            ) : (
              <div className="space-y-2">
                {livreurs.map(l => (
                  <div key={l.id} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${l.status === 'disponible' ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-muted/50 opacity-60'}`}>
                    <div className="relative">
                      <Avatar className="w-9 h-9"><AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{l.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${l.status === 'disponible' ? 'bg-emerald-500' : l.status === 'en_course' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{l.name}</p>
                      <p className="text-[11px] text-muted-foreground">{l.vehicle} - {l.zone}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /><span className="text-[10px] font-medium">{l.rating}</span></div>
                        {l.activeDeliveries > 0 && <span className="text-[10px] text-muted-foreground">{l.activeDeliveries} active(s)</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un livreur</DialogTitle>
            <DialogDescription>Course {selectedDelivery?.reference}</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableLivreurs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun livreur disponible</p>
            ) : (
              availableLivreurs.map(l => (
                <button key={l.id} className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-muted transition-colors text-left" onClick={() => handleAssign(l.id)} disabled={assigning === selectedDelivery?.id}>
                  <Avatar className="w-9 h-9"><AvatarFallback className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold">{l.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{l.name}</p>
                    <p className="text-[11px] text-muted-foreground">{l.vehicle} - {l.zone} - {l.coursesDone} courses</p>
                  </div>
                  <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /><span className="text-xs font-medium">{l.rating}</span></div>
                </button>
              ))
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Annuler</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// MES COURSES VIEW (livreur only)
// ============================================================
function MesCoursesView() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState<{ totalCourses: number; activeToday: number; completedToday: number; monthlyEarnings: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [gpsActive, setGpsActive] = useState<string | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [delRes, statsRes] = await Promise.all([
        fetch('/api/livreurs/me/deliveries'),
        fetch('/api/livreurs/me/stats'),
      ]);
      if (delRes.ok) { const d = await delRes.json(); setDeliveries(d.livraisons || []); }
      if (statsRes.ok) { setStats(await statsRes.json()); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (deliveryId: string, newStatus: string, ref: string) => {
    setStatusUpdating(deliveryId);
    try {
      const res = await fetch(`/api/dispatch/${deliveryId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      if (res.ok) { toast.success(`Course ${ref} - ${statusConfig[newStatus]?.label || newStatus}`); fetchData(); }
      else { const data = await res.json(); toast.error(data.erreur || 'Erreur de changement de statut'); }
    } catch { toast.error('Erreur serveur'); } finally { setStatusUpdating(null); }
  };

  const toggleGps = (deliveryId: string) => {
    if (gpsActive === deliveryId) {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
      setGpsActive(null);
      toast.info('GPS desactive');
    } else {
      setGpsActive(deliveryId);
      toast.success('GPS active - localisation en cours');
      gpsIntervalRef.current = setInterval(() => {
        const lat = -4.776 + (Math.random() - 0.5) * 0.02;
        const lng = 11.863 + (Math.random() - 0.5) * 0.02;
        fetch('/api/livreurs/gps', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deliveryId, lat, lng }) }).catch(() => {});
      }, 5000);
    }
  };

  useEffect(() => { return () => { if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current); }; }, []);

  const activeDeliveries = deliveries.filter(d => !['livre', 'annulee'].includes(d.status));
  const completedDeliveries = deliveries.filter(d => ['livre', 'annulee'].includes(d.status));
  const weeklyData = [12, 8, 15, 10, 18, 14, stats?.completedToday || 0];
  const maxWeekly = Math.max(...weeklyData, 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Mes courses</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerez vos livraisons en cours</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> En ligne</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Actives" value={String(stats?.activeToday ?? 0)} subtitle="En cours" icon={<Navigation className="w-5 h-5" />} loading={loading} />
        <StatCard title="Completees" value={String(stats?.completedToday ?? 0)} subtitle="Aujourd'hui" icon={<CheckCircle2 className="w-5 h-5" />} loading={loading} />
        <StatCard title="Revenus mois" value={stats ? `${(stats.monthlyEarnings / 1000).toFixed(0)} k` : '0'} subtitle="FCFA" icon={<CircleDollarSign className="w-5 h-5" />} loading={loading} />
        <StatCard title="Total carriere" value={String(deliveries.filter(d => d.status === 'livre').length)} subtitle="Livrees" icon={<Star className="w-5 h-5" />} loading={loading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Deliveries */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Courses actives ({activeDeliveries.length})</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchData}><Eye className="w-3.5 h-3.5" /> Rafraichir</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="p-3 rounded-xl bg-muted/50"><Skeleton className="h-4 w-1/3 mb-2" /><Skeleton className="h-3 w-2/3" /></div>))}</div>
            ) : activeDeliveries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Package className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Aucune course active</p></div>
            ) : (
              <div className="space-y-3">
                {activeDeliveries.map(d => (
                  <div key={d.id} className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold">{d.reference}</span>
                          <StatusBadge status={d.status} />
                          {d.priority === 'urgente' && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">URGENT</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{d.pickup}</span>
                          <ChevronRight className="w-3 h-3 shrink-0" /><span className="truncate">{d.dropoff}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(d.createdAt)}</span>
                          {d.recipientName && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{d.recipientName}</span>}
                          <span className="font-semibold text-foreground">{formatPrice(d.price)} FCFA</span>
                        </div>
                        {d.company && <p className="text-[10px] text-muted-foreground mt-1">Client: {d.company.name}</p>}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {d.status === 'prise_en_charge' && (
                          <Button size="sm" className="h-7 text-xs gap-1" disabled={statusUpdating === d.id} onClick={() => handleStatusChange(d.id, 'en_course', d.reference)}>
                            {statusUpdating === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                            Demarrer
                          </Button>
                        )}
                        {d.status === 'en_course' && (
                          <>
                            <Button size="sm" variant={gpsActive === d.id ? 'default' : 'outline'} className="h-7 text-xs gap-1 border-emerald-300" onClick={() => toggleGps(d.id)}>
                              <div className={`w-2 h-2 rounded-full ${gpsActive === d.id ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} /> GPS
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50" disabled={statusUpdating === d.id} onClick={() => handleStatusChange(d.id, 'livre', d.reference)}>
                              {statusUpdating === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Livre
                            </Button>
                          </>
                        )}
                        {d.recipientPhone && (
                          <a href={`tel:${d.recipientPhone}`} className="inline-flex items-center justify-center h-7 w-7 rounded-lg border hover:bg-muted transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    {d.status === 'en_course' && gpsActive === d.id && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-emerald-600">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        GPS actif - Position envoyee toutes les 5 secondes
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right sidebar - Earnings + History */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Activite semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {['L', 'M', 'M', 'J', 'V', 'S', 'A'].map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold">{weeklyData[i]}</span>
                    <div className="w-full bg-muted rounded-t-md overflow-hidden flex-1 flex items-end">
                      <div className={`w-full rounded-t-md ${i === 6 ? 'bg-primary' : 'bg-primary/50'} transition-all duration-500`} style={{ height: `${Math.max((weeklyData[i] / maxWeekly) * 100, 5)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{day}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Historique</CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              {completedDeliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune course terminee</p>
              ) : (
                <div className="space-y-2">
                  {completedDeliveries.slice(0, 10).map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${d.status === 'livre' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {d.status === 'livre' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold">{d.reference}</span>
                        <p className="text-xs text-muted-foreground truncate">{d.pickup} {String.fromCharCode(8594)} {d.dropoff}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatPrice(d.price)} FCFA</p>
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RAPPORTS VIEW (admin/client)
// ============================================================
function RapportsView() {
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports/monthly?month=${selectedMonth}`);
        if (res.ok) {
          const data = await res.json();
          setReport(data);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedMonth]);

  const months = [
    { value: '2026-07', label: 'Juillet 2026' },
    { value: '2026-06', label: 'Juin 2026' },
    { value: '2026-05', label: 'Mai 2026' },
  ];

  const typeColors: Record<string, string> = { standard: 'bg-primary', express: 'bg-amber-500', 'inter-arrondissement': 'bg-teal-500' };
  const typeLabels: Record<string, string> = { standard: 'Standard', express: 'Express', 'inter-arrondissement': 'Inter-arrond.' };
  const maxType = report ? Math.max(...(report.coursesByType || []).map((t: any) => t.count), 1) : 1;
  const maxWeek = report ? Math.max(...(report.weeklyBreakdown || []).map((w: any) => w.count), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Rapports</h2>
          <p className="text-sm text-muted-foreground mt-1">Analyse detaillee de votre activite</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-8 w-16 mb-2" /><Skeleton className="h-4 w-24" /></CardContent></Card>)}</div>
      ) : report ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total courses" value={String(report.totalCourses || 0)} subtitle="Ce mois" icon={<Package className="w-5 h-5" />} trend={report.comparison?.volumeChange ? `${report.comparison.volumeChange > 0 ? '+' : ''}${report.comparison.volumeChange}%` : undefined} trendUp={(report.comparison?.volumeChange || 0) > 0} />
            <StatCard title="Chiffre d'affaires" value={report.totalRevenue ? `${(report.totalRevenue / 1000).toFixed(0)} k` : '0'} subtitle="FCFA" icon={<CircleDollarSign className="w-5 h-5" />} trend={report.comparison?.revenueChange ? `${report.comparison.revenueChange > 0 ? '+' : ''}${report.comparison.revenueChange}%` : undefined} trendUp={(report.comparison?.revenueChange || 0) > 0} />
            <StatCard title="Temps moyen" value={`${report.avgTime || 0} min`} subtitle="Par livraison" icon={<Timer className="w-5 h-5" />} />
            <StatCard title="Taux de livraison" value={report.totalCourses > 0 ? `${Math.round(((report.coursesByStatus?.find((s: any) => s.status === 'livre')?.count || 0) / report.totalCourses) * 100)}%` : '0%'} subtitle="Livrees / Total" icon={<CheckCircle2 className="w-5 h-5" />} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Bar chart: Courses by type */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Courses par type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(report.coursesByType || []).map((t: any) => (
                  <div key={t.type}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{typeLabels[t.type] || t.type}</span>
                      <span className="text-muted-foreground">{t.count}</span>
                    </div>
                    <div className="h-8 bg-muted rounded-lg overflow-hidden">
                      <div className={`h-full rounded-lg ${typeColors[t.type] || 'bg-primary'} transition-all duration-500 flex items-center justify-end pr-2`} style={{ width: `${Math.max((t.count / maxType) * 100, 8)}%` }}>
                        {t.count > 0 && <span className="text-[10px] text-white font-bold">{Math.round((t.count / maxType) * 100)}%</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top 5 Destinations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Top 5 destinations</CardTitle>
              </CardHeader>
              <CardContent>
                {(report.topDestinations || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucune donnee disponible</p>
                ) : (
                  <div className="space-y-3">
                    {(report.topDestinations || []).map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.destination}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{d.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Weekly breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Repartition hebdomadaire</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-48">
                {(report.weeklyBreakdown || []).map((w: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs font-semibold">{w.count}</span>
                    <div className="w-full bg-muted rounded-t-lg overflow-hidden flex-1 flex items-end">
                      <div className={`w-full rounded-t-lg ${i === (report.weeklyBreakdown || []).length - 1 ? 'bg-primary' : 'bg-primary/60'} transition-all duration-500`} style={{ height: `${Math.max((w.count / maxWeek) * 100, 5)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">S{i + 1}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Download button */}
          <div className="flex justify-center">
            <Button variant="outline" className="gap-2" onClick={() => toast.info('Le rapport sera genere et envoye par email.')}>
              <Download className="w-4 h-4" /> Telecharger le rapport
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucune donnee pour cette periode</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAIEMENT VIEW (client)
// ============================================================
function PaiementView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'factures' | 'historique'>('factures');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [provider, setProvider] = useState('airtel_money');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [payStep, setPayStep] = useState<'form' | 'ussd' | 'confirming' | 'result'>('form');
  const [transactionId, setTransactionId] = useState('');
  const [payResult, setPayResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invRes, payRes] = await Promise.all([fetch('/api/invoices?status=en_attente'), fetch('/api/payments/history')]);
      if (invRes.ok) { const d = await invRes.json(); setInvoices(d.factures || []); }
      if (payRes.ok) { const d = await payRes.json(); setPayments(d.paiements || []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPayDialog = (inv: Invoice) => {
    setSelectedInvoice(inv); setProvider('airtel_money'); setPhoneNumber('');
    setPayStep('form'); setTransactionId(''); setPayResult(null); setPayDialogOpen(true);
  };

  const handleInitPay = async () => {
    if (!selectedInvoice || !phoneNumber) return;
    setPayStep('ussd');
    try {
      const res = await fetch('/api/payments/mobile-money', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: selectedInvoice.id, provider, phoneNumber }),
      });
      const data = await res.json();
      if (res.ok) { setTransactionId(data.transactionId); setTimeout(() => handleConfirm(data.transactionId), 3000); }
      else { setPayResult({ success: false, message: data.erreur || 'Erreur' }); setPayStep('result'); }
    } catch { setPayResult({ success: false, message: 'Erreur serveur' }); setPayStep('result'); }
  };

  const handleConfirm = async (txId: string) => {
    setPayStep('confirming');
    try {
      const res = await fetch('/api/payments/mobile-money/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: txId }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'reussi') {
        setPayResult({ success: true, message: `Paiement de ${formatPrice(selectedInvoice?.amount || 0)} FCFA effectue. Transaction: ${txId}` });
        toast.success('Paiement effectue avec succes !'); fetchData();
      } else { setPayResult({ success: false, message: data.message || data.erreur || 'Echec du paiement' }); toast.error(data.message || 'Paiement echoue'); }
    } catch { setPayResult({ success: false, message: 'Erreur serveur' }); } finally { setPayStep('result'); }
  };

  const totalUnpaid = invoices.reduce((s, i) => s + i.amount, 0);
  const pColors: Record<string, string> = { airtel_money: 'bg-red-600', moov_money: 'bg-sky-500' };
  const pAbbr: Record<string, string> = { airtel_money: 'AM', moov_money: 'MM' };
  const pLabels: Record<string, string> = { airtel_money: 'Airtel Money', moov_money: 'Moov Money' };

  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold">Paiement</h2><p className="text-sm text-muted-foreground mt-1">Reglez vos factures via Mobile Money</p></div>
      <div className="flex gap-2">
        <Button variant={tab === 'factures' ? 'default' : 'outline'} size="sm" onClick={() => setTab('factures')} className="gap-1.5"><Receipt className="w-3.5 h-3.5" /> Factures {invoices.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 ml-1">{invoices.length}</Badge>}</Button>
        <Button variant={tab === 'historique' ? 'default' : 'outline'} size="sm" onClick={() => setTab('historique')} className="gap-1.5"><FileCheck2 className="w-3.5 h-3.5" /> Historique</Button>
      </div>

      {tab === 'factures' && (<>
        <StatCard title="Total a payer" value={`${formatPrice(totalUnpaid)} FCFA`} subtitle={`${invoices.length} facture(s) en attente`} icon={<Wallet className="w-5 h-5" />} loading={loading} />
        <div className="grid sm:grid-cols-2 gap-4">
          {['airtel_money', 'moov_money'].map(p => (
            <Card key={p} className={`border-2 hover:shadow-md cursor-pointer ${p === 'airtel_money' ? 'border-red-200' : 'border-sky-200'}`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${pColors[p]} flex items-center justify-center text-white font-bold text-sm`}>{pAbbr[p]}</div>
                <div><p className="font-semibold">{pLabels[p]}</p><p className="text-xs text-muted-foreground">Paiement rapide et securise</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Factures en attente</CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {loading ? (<div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50"><Skeleton className="w-10 h-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="h-8 w-32" /></div>))}</div>)
            : invoices.length === 0 ? (<div className="text-center py-12 text-muted-foreground"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Aucune facture en attente</p></div>)
            : (<div className="space-y-3">{invoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-amber-700" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold">{inv.reference}</span><StatusBadge status={inv.status} /></div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><span>{inv.period}</span><span>-</span><span>{inv.coursesCount} courses</span></div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatPrice(inv.amount)} <span className="text-[10px] text-muted-foreground">FCFA</span></p>
                  <Button size="sm" className="mt-1 h-7 text-xs gap-1" onClick={() => openPayDialog(inv)}><Wallet className="w-3 h-3" /> Payer</Button>
                </div>
              </div>
            ))}</div>)}
          </CardContent>
        </Card>
      </>)}

      {tab === 'historique' && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Historique des paiements</CardTitle></CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {loading ? (<div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/50"><Skeleton className="w-10 h-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div></div>))}</div>)
            : payments.length === 0 ? (<div className="text-center py-12 text-muted-foreground"><CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Aucun paiement effectue</p></div>)
            : (<div className="space-y-2">{payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-[10px] ${pColors[p.provider] || 'bg-gray-500'}`}>{pAbbr[p.provider] || 'MM'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold">{formatPrice(p.amount)} FCFA</span><StatusBadge status={p.status === 'reussi' ? 'payee' : p.status} /></div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground"><span>{p.phoneNumber}</span>{p.invoice && <span>- {p.invoice.reference} ({p.invoice.period})</span>}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.transactionId} - {formatDateFull(p.createdAt)}</p>
                </div>
              </div>
            ))}</div>)}
          </CardContent>
        </Card>
      )}

      <Dialog open={payDialogOpen} onOpenChange={(o) => { if (!o) setPayDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Payer avec Mobile Money</DialogTitle><DialogDescription>{selectedInvoice?.reference} - {formatPrice(selectedInvoice?.amount || 0)} FCFA</DialogDescription></DialogHeader>
          {payStep === 'form' && (<div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">{['airtel_money', 'moov_money'].map(p => (
              <button key={p} onClick={() => setProvider(p)} className={`p-3 rounded-xl border-2 text-center transition-all ${provider === p ? (p === 'airtel_money' ? 'border-red-500 bg-red-50' : 'border-sky-500 bg-sky-50') : 'border-border'}`}>
                <div className={`w-10 h-10 rounded-lg ${pColors[p]} flex items-center justify-center text-white font-bold text-xs mx-auto mb-2`}>{pAbbr[p]}</div>
                <p className="text-xs font-semibold">{pLabels[p]}</p>
              </button>
            ))}</div>
            <div className="space-y-2"><label className="text-sm font-medium">Numero de telephone</label><Input placeholder="+242 06 XXX XXXX" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} /></div>
            <div className="bg-muted/50 rounded-xl p-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Montant</span><span className="font-bold">{formatPrice(selectedInvoice?.amount || 0)} FCFA</span></div></div>
          </div>)}
          {payStep === 'ussd' && (<div className="space-y-4 text-center py-4">
            <div className={`w-16 h-16 rounded-2xl ${pColors[provider]} flex items-center justify-center text-white font-bold text-xl mx-auto`}>{pAbbr[provider]}</div>
            <p className="text-sm font-medium">Envoi de la demande USSD...</p><p className="text-xs text-muted-foreground">*126#{phoneNumber}#</p>
            <div className="flex items-center justify-center gap-2 pt-2"><div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} /><div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} /><div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} /></div>
            <p className="text-xs text-muted-foreground">En attente de confirmation...</p>
          </div>)}
          {payStep === 'confirming' && (<div className="text-center py-6"><Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" /><p className="text-sm font-medium mt-4">Traitement en cours</p></div>)}
          {payStep === 'result' && payResult && (<div className={`p-6 rounded-xl text-center ${payResult.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
            {payResult.success ? <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" /> : <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />}
            <p className={`text-sm font-semibold ${payResult.success ? 'text-emerald-700' : 'text-red-700'}`}>{payResult.success ? 'Paiement reussi !' : 'Paiement echoue'}</p>
            <p className={`text-xs mt-2 ${payResult.success ? 'text-emerald-600' : 'text-red-600'}`}>{payResult.message}</p>
            {transactionId && <p className="text-[10px] text-muted-foreground mt-2">Ref: {transactionId}</p>}
          </div>)}
          <DialogFooter>
            {payStep === 'form' && <><Button variant="outline" onClick={() => setPayDialogOpen(false)}>Annuler</Button><Button className="gap-2" onClick={handleInitPay} disabled={!phoneNumber}><Wallet className="w-4 h-4" /> Envoyer</Button></>}
            {payStep === 'result' && <Button onClick={() => setPayDialogOpen(false)}>Fermer</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// ENTREPRISES VIEW (admin)
// ============================================================
function EntreprisesView() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [companyDetail, setCompanyDetail] = useState<any>(null);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.entreprises || []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const fetchDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/companies/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCompanyDetail(data);
      }
    } catch {} finally { setDetailLoading(false); }
  };

  const handleSelectCompany = (c: Company) => {
    setSelectedCompany(c);
    setCompanyDetail(null);
    fetchDetail(c.id);
  };

  const planColors: Record<string, string> = {
    decouverte: 'bg-sky-100 text-sky-700 border-sky-200',
    business: 'bg-purple-100 text-purple-700 border-purple-200',
    premium: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Entreprises</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestion des entreprises clientes et de leurs abonnements</p>
        </div>
        <Badge variant="outline" className="gap-1.5">{companies.length} entreprise(s)</Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Company List */}
        <div className="lg:col-span-1 space-y-3">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-5 w-2/3 mb-2" /><Skeleton className="h-3 w-1/2" /></CardContent></Card>)}</div>
          ) : companies.map(c => (
            <Card key={c.id} className={`cursor-pointer hover:shadow-md transition-all ${selectedCompany?.id === c.id ? 'ring-2 ring-primary' : ''}`} onClick={() => handleSelectCompany(c)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] ${planColors[c.plan] || ''}`}>{planLabels[c.plan] || c.plan}</Badge>
                      <span className="text-[10px] text-muted-foreground">{c.planLimit} courses/mois</span>
                    </div>
                  </div>
                </div>
                {c.sector && <p className="text-[11px] text-muted-foreground mt-2 ml-[52px]">{c.sector}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Company Detail */}
        <div className="lg:col-span-2">
          {!selectedCompany ? (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Selectionnez une entreprise pour voir ses details</p>
              </CardContent>
            </Card>
          ) : detailLoading ? (
            <Card className="h-full min-h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></Card>
          ) : companyDetail ? (
            <div className="space-y-4">
              {/* Header */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{companyDetail.entreprise?.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={planColors[companyDetail.entreprise?.plan] || ''}>{planLabels[companyDetail.entreprise?.plan] || companyDetail.entreprise?.plan}</Badge>
                          {companyDetail.entreprise?.nif && <span className="text-xs text-muted-foreground">NIF: {companyDetail.entreprise.nif}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-4 text-sm">
                    {companyDetail.entreprise?.rccm && <div><span className="text-muted-foreground">RCCM:</span> <span className="font-medium">{companyDetail.entreprise.rccm}</span></div>}
                    {companyDetail.entreprise?.address && <div><span className="text-muted-foreground">Adresse:</span> <span className="font-medium">{companyDetail.entreprise.address}</span></div>}
                    {companyDetail.entreprise?.email && <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{companyDetail.entreprise.email}</span></div>}
                    {companyDetail.entreprise?.phone && <div><span className="text-muted-foreground">Telephone:</span> <span className="font-medium">{companyDetail.entreprise.phone}</span></div>}
                    {companyDetail.entreprise?.sector && <div><span className="text-muted-foreground">Secteur:</span> <span className="font-medium">{companyDetail.entreprise.sector}</span></div>}
                    <div><span className="text-muted-foreground">Inscrite le:</span> <span className="font-medium">{formatDateFull(companyDetail.entreprise?.createdAt)}</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              {companyDetail.statistiques && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard title="Courses ce mois" value={String(companyDetail.statistiques.coursesCeMois || 0)} icon={<Package className="w-5 h-5" />} />
                  <StatCard title="Factures en attente" value={String(companyDetail.statistiques.facturesEnAttente || 0)} icon={<Receipt className="w-5 h-5" />} />
                  <StatCard title="Total facture" value={companyDetail.statistiques.totalFacture ? `${formatPrice(companyDetail.statistiques.totalFacture)} F` : '0 F'} icon={<CircleDollarSign className="w-5 h-5" />} />
                  <StatCard title="Total paye" value={companyDetail.statistiques.totalPaye ? `${formatPrice(companyDetail.statistiques.totalPaye)} F` : '0 F'} icon={<CheckCircle2 className="w-5 h-5" />} />
                </div>
              )}

              {/* Plan usage bar */}
              {companyDetail.entreprise && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">Utilisation du forfait</span>
                      <span className="text-xs text-muted-foreground">{companyDetail.statistiques?.coursesCeMois || 0} / {companyDetail.entreprise.planLimit} courses</span>
                    </div>
                    <Progress value={Math.min(((companyDetail.statistiques?.coursesCeMois || 0) / companyDetail.entreprise.planLimit) * 100, 100)} className="h-3" />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Erreur de chargement</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WHATSAPP BOT VIEW (admin - chatbot management)
// ============================================================
function WhatsAppBotView() {
  const [simMessage, setSimMessage] = useState('');
  const [simFrom, setSimFrom] = useState('242066000000');
  const [simResult, setSimResult] = useState<{ reply: string; parsed: { action: string; params: Record<string, string> } } | null>(null);
  const [logs, setLogs] = useState<Array<{ id: string; title: string; message: string; createdAt: string; read: boolean }>>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('simulateur');

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSimulate = async () => {
    if (!simMessage.trim()) return;
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: simFrom, message: simMessage }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult({ reply: data.reply, parsed: data.parsed });
        fetchLogs();
      } else {
        setSimResult({ reply: 'Erreur de simulation', parsed: { action: 'error', params: {} } });
      }
    } catch {
      setSimResult({ reply: 'Erreur de connexion au serveur', parsed: { action: 'error', params: {} } });
    }
    setSimLoading(false);
  };

  const quickCommands = [
    { label: 'Menu aide', msg: 'aide' },
    { label: 'Commander', msg: 'commander:' },
    { label: 'Commande complete', msg: 'commander:\ndépart=BGFI Centre-ville\ndestination=TotalEnergies Loandjili\ndestinataire=Jean Mouamba\ntel=065123456\ndesc=Documents confidentiels' },
    { label: 'Suivi', msg: 'suivi CMD-2024-0001' },
    { label: 'Historique', msg: 'historique' },
    { label: 'Annuler', msg: 'annuler CMD-2024-0008' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">WhatsApp Bot</h2>
        <p className="text-sm text-muted-foreground mt-1">Automatisation des commandes via WhatsApp — Simulation et gestion</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="simulateur">Simulateur</TabsTrigger>
          <TabsTrigger value="logs">Conversation Logs</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* SIMULATEUR */}
        <TabsContent value="simulateur" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Simuler un message client</CardTitle>
                <CardDescription className="text-xs">Testez le bot comme si un client envoyait ce message via WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Numero du client</label>
                  <Input value={simFrom} onChange={e => setSimFrom(e.target.value)} placeholder="242066000000" className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Message</label>
                  <Textarea value={simMessage} onChange={e => setSimMessage(e.target.value)} placeholder="Tapez un message ou utilisez une commande rapide..." className="mt-1 min-h-[100px] text-sm" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickCommands.map(qc => (
                    <Button key={qc.label} variant="outline" size="sm" className="text-xs h-7" onClick={() => setSimMessage(qc.msg)}>
                      {qc.label}
                    </Button>
                  ))}
                </div>
                <Button onClick={handleSimulate} disabled={simLoading || !simMessage.trim()} className="w-full gap-2">
                  {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer la simulation
                </Button>
              </CardContent>
            </Card>

            {/* Result panel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Reponse du bot</CardTitle>
                {simResult && (
                  <Badge variant="outline" className="text-xs w-fit">
                    Action: {simResult.parsed.action}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {simResult ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                    {simResult.reply}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Envoyez un message pour voir la reponse du bot</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Conversation Logs</CardTitle>
                  <CardDescription className="text-xs">Derniers echanges WhatsApp (recus via le webhook)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs} className="h-7 text-xs gap-1">
                  <RefreshCw className="w-3 h-3" /> Rafraichir
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Aucun log. Les conversations apparaitront ici une fois le webhook actif.</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.map(log => (
                    <div key={log.id} className="border rounded-lg p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-700">{log.title}</span>
                        <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{log.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIG */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Statut de connexion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Mode Simulation</p>
                    <p className="text-xs text-amber-600">Le bot repond localement. Pour la production, configurez Meta API ci-dessous.</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b"><span className="text-muted-foreground">Webhook URL</span><code className="bg-muted px-1.5 py-0.5 rounded">/api/whatsapp/webhook</code></div>
                  <div className="flex justify-between py-1.5 border-b"><span className="text-muted-foreground">Verify Token</span><code className="bg-muted px-1.5 py-0.5 rounded">{process.env.NEXT_PUBLIC_WHATSAPP_MODE === 'live' ? 'Configure' : 'coursier-pn-verify-2024'}</code></div>
                  <div className="flex justify-between py-1.5"><span className="text-muted-foreground">Messages aujourd'hui</span><span className="font-semibold">{logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Commandes supportees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { cmd: 'aide / bonjour / menu', desc: 'Affiche le menu principal' },
                  { cmd: 'commander: ...', desc: 'Cree une nouvelle course' },
                  { cmd: 'suivi CMD-XXXX-XXX', desc: 'Suit une livraison en temps reel' },
                  { cmd: 'historique', desc: 'Affiche les dernieres courses' },
                  { cmd: 'annuler CMD-XXXX-XXX', desc: 'Annule une course en attente' },
                ].map(c => (
                  <div key={c.cmd} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                    <code className="text-[11px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">{c.cmd}</code>
                    <span className="text-xs text-muted-foreground">{c.desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Variables d'environnement Meta API</CardTitle>
                <CardDescription className="text-xs">Pour passer en production, ajoutez ces variables dans votre fichier .env</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1">
                  <p><span className="text-muted-foreground"># Obtenu depuis Meta Developer Dashboard</span></p>
                  <p>WHATSAPP_PHONE_NUMBER_ID=<span className="text-amber-600">votre_phone_number_id</span></p>
                  <p>WHATSAPP_ACCESS_TOKEN=<span className="text-amber-600">votre_access_token</span></p>
                  <p>WHATSAPP_VERIFY_TOKEN=<span className="text-amber-600">coursier-pn-verify-2024</span></p>
                  <p>WHATSAPP_BUSINESS_NUMBER=<span className="text-amber-600">242066105805</span></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// CARTE VIEW (admin - real-time map)
// ============================================================
function CarteView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Carte temps reel</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivi GPS des livreurs et courses actives a Pointe-Noire</p>
        </div>
        <Badge variant="outline" className="gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          En direct
        </Badge>
      </div>
      <TrackingMap />
    </div>
  );
}

// ============================================================
// GLOBAL SEARCH
// ============================================================
function GlobalSearch({ onClose, onNavigate }: { onClose: () => void; onNavigate: (v: View) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Delivery[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/deliveries?search=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults((data.livraisons || []).slice(0, 8));
        }
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="max-w-2xl mx-auto" onKeyDown={handleKeyDown}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Rechercher par reference, adresse, destinataire..."
          className="pl-9 pr-9 h-10"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        {!searching && query && <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => { setQuery(''); setResults([]); }} />}
      </div>
      {results.length > 0 && (
        <Card className="mt-2 max-h-80 overflow-y-auto">
          <CardContent className="p-2">
            {results.map(d => (
              <button key={d.id} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors" onClick={() => onNavigate('suivi')}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${d.priority === 'urgente' ? 'bg-red-100 text-red-600' : d.priority === 'haute' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'}`}>
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold">{d.reference}</span><StatusBadge status={d.status} /></div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{d.pickup} → {d.dropoff}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold">{formatPrice(d.price)} <span className="text-[10px] text-muted-foreground">F</span></p>
                  <p className="text-[10px] text-muted-foreground">{formatDateFull(d.createdAt)}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      {query.length >= 2 && !searching && results.length === 0 && (
        <div className="text-center py-6 text-muted-foreground"><p className="text-sm">Aucun resultat pour &quot;{query}&quot;</p></div>
      )}
      {query.length < 2 && (
        <div className="text-center py-4 text-muted-foreground"><p className="text-xs">Tapez au moins 2 caracteres pour rechercher</p></div>
      )}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function Home() {
  const { data: session, status } = useSession();
  const userRole = (session?.user as Record<string, string>)?.role || 'client';
  const [currentView, setCurrentView] = useState<View>(() => {
    if (userRole === 'livreur') return 'mes_courses';
    return 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [deliveryRefreshKey, setDeliveryRefreshKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshDeliveries = useCallback(() => {
    setDeliveryRefreshKey(k => k + 1);
  }, []);

  // Fetch pending count for admin dispatch badge
  useEffect(() => {
    if (userRole !== 'admin') return;
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/dispatch');
        if (res.ok) {
          const data = await res.json();
          setPendingCount((data.livraisons || []).filter((d: Delivery) => d.status === 'en_attente').length);
        }
      } catch { /* ignore */ }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  // Polling global (remplace Socket.io sur Vercel)
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      refreshDeliveries();
      if (userRole === 'admin') {
        fetch('/api/dispatch').then(r => r.json()).then(d => {
          setPendingCount((d.livraisons || []).filter((x: Delivery) => x.status === 'en_attente').length);
        }).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [session, userRole, refreshDeliveries]);

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
  const planLabel = 'Mon forfait';

  const viewMap: Record<View, React.ReactNode> = {
    dashboard: <DashboardView key={deliveryRefreshKey} companyName={companyName} planLabel={planLabel} companyData={null} onRefreshDeliveries={refreshDeliveries} userRole={userRole} />,
    commander: <CommanderView />,
    suivi: <SuiviView />,
    facturation: <FacturationView />,
    forfaits: <ForfaitsView />,
    livreurs: <LivreursView />,
    parametres: <ParametresView />,
    dispatch: <DispatchView />,
    carte: <CarteView />,
    entreprises: <EntreprisesView />,
    whatsapp_bot: <WhatsAppBotView />,
    mes_courses: <MesCoursesView />,
    rapports: <RapportsView />,
    paiement: <PaiementView />,
    services: <ServicesView />,
    nouvelle_tache: <NouvelleTacheView />,
    taches: <TachesView />,
    admin_taches: <AdminTachesView />,
    mandats: <MandatsView />,
    sla_monitor: <SLAMonitorView />,
  };

  const pageTitle: Record<View, string> = {
    dashboard: 'Tableau de bord',
    commander: 'Commander une course',
    suivi: 'Suivi des courses',
    facturation: 'Facturation',
    forfaits: 'Forfaits',
    livreurs: 'Livreurs',
    parametres: 'Parametres',
    dispatch: 'Dispatch',
    carte: 'Carte temps reel',
    entreprises: 'Entreprises',
    whatsapp_bot: 'WhatsApp Bot',
    mes_courses: 'Mes courses',
    rapports: 'Rapports',
    paiement: 'Paiement',
    services: 'Services administratifs',
    nouvelle_tache: 'Nouvelle demande',
    taches: 'Mes taches administratives',
    admin_taches: 'Gestion des taches',
    mandats: 'Mandats',
    sla_monitor: 'Suivi SLA',
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar current={currentView} onNavigate={setCurrentView} open={sidebarOpen} onClose={() => setSidebarOpen(false)} companyName={companyName} planLabel={planLabel} userRole={userRole} pendingCount={pendingCount} whatsappNumber='242066105805' />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 lg:px-6 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>

          <h2 className="font-semibold text-sm hidden sm:block">{pageTitle[currentView]}</h2>

          <div className="flex-1" />

          {/* Search */}
          <Button variant="ghost" size="icon" className="relative" onClick={() => { setSearchOpen(!searchOpen); setNotifOpen(false); }}>
            <Search className="w-4 h-4" />
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative" onClick={() => { setNotifOpen(!notifOpen); setSearchOpen(false); }}>
              <Bell className="w-4 h-4" />
            </Button>
            <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
          </div>

          {/* Sign out */}
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: '/' })}>
            <LogOut className="w-4 h-4" />
          </Button>
        </header>

        {/* Search Overlay */}
        {searchOpen && (
          <div className="border-b px-4 lg:px-6 py-3 bg-muted/30">
            <GlobalSearch onClose={() => setSearchOpen(false)} onNavigate={(v) => { setCurrentView(v); setSearchOpen(false); }} />
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {viewMap[currentView]}
        </main>
      </div>

      <Toaster richColors closeButton position="bottom-right" />
    </div>
  );
}

