'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, MapPin, Clock, Phone, FileText, BarChart3, Users, Truck,
  ChevronRight, Search, Plus, Bell, Settings, TrendingUp,
  CheckCircle2, Circle, AlertCircle, Zap, Shield, Receipt,
  ArrowUpRight, ArrowDownRight, Star, CreditCard,
  Building2, Calendar, Filter, Eye, Timer, LayoutDashboard,
  CircleDollarSign, Download, Loader2, RefreshCw, Monitor, Calculator, FolderOpen, Briefcase, FileCheck, ClipboardList, Gavel, AlertTriangle, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================
interface Service {
  id: string; name: string; slug: string; family: string; description?: string;
  priceUnit: number; isRecurring: boolean; slaHours: number; slaUrgentHours: number;
  isActive: boolean; icon: string; order: number; _count?: { tasks: number };
}

interface Task {
  id: string; reference: string; title: string; description?: string; family: string;
  status: string; priority: string; urgent: boolean; price: number;
  paymentMode: string; slaDeadline?: string; slaBreached: boolean;
  completionNote?: string; completedAt?: string;
  createdAt: string; updatedAt: string;
  service?: { id: string; name: string; icon: string } | null;
  client?: { id: string; name: string; email: string } | null;
  company?: { id: string; name: string } | null;
  assignedUser?: { id: string; name: string } | null;
  mandate?: { id: string; reference: string; type: string; status: string } | null;
  timeline?: TaskTimelineItem[];
  documents?: TaskDocumentItem[];
  _count?: { timeline: number; documents: number };
}

interface TaskTimelineItem {
  id: string; event: string; comment?: string; timestamp: string;
}

interface TaskDocumentItem {
  id: string; name: string; type: string; fileUrl?: string; fileSize?: number; createdAt: string;
}

interface Mandate {
  id: string; reference: string; type: string; description?: string; status: string;
  startDate?: string; endDate?: string; createdAt: string;
  company?: { id: string; name: string } | null;
  _count?: { tasks: number };
}

// ============================================================
// HELPERS
// ============================================================
const formatPrice = (p: number) => p.toLocaleString('fr-FR');
const formatDate = (d: string) => { try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
const formatDateFull = (d: string) => { try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; } };

const taskStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  en_attente: { label: 'En attente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
  en_cours: { label: 'En cours', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: <Loader2 className="w-3 h-3" /> },
  en_validation: { label: 'En validation', color: 'bg-violet-100 text-violet-800 border-violet-200', icon: <Eye className="w-3 h-3" /> },
  termine: { label: 'Termine', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  annule: { label: 'Annule', color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="w-3 h-3" /> },
};

const familyConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  digital_office: { label: 'Bureau Digital', icon: <Monitor className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
  cnss_social: { label: 'CNSS / Social', icon: <Shield className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
  fiscalite: { label: 'Fiscalite', icon: <Calculator className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
  sfec: { label: 'SFEC', icon: <Receipt className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50' },
  documentaire: { label: 'Gestion Documentaire', icon: <FolderOpen className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
  secretariat: { label: 'Secretariat / Back-office', icon: <Briefcase className="w-4 h-4" />, color: 'text-slate-600 bg-slate-50' },
};

const serviceIconMap: Record<string, React.ReactNode> = {
  monitor: <Monitor className="w-5 h-5" />,
  shield: <Shield className="w-5 h-5" />,
  calculator: <Calculator className="w-5 h-5" />,
  receipt: <Receipt className="w-5 h-5" />,
  folder: <FolderOpen className="w-5 h-5" />,
  briefcase: <Briefcase className="w-5 h-5" />,
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  normale: { label: 'Normale', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  haute: { label: 'Haute', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
};

const paymentModeLabels: Record<string, string> = {
  forfait: 'Forfait',
  mobile_money: 'Mobile Money',
  virement: 'Virement bancaire',
};

const mandateTypeLabels: Record<string, string> = {
  fiscal: 'Fiscal',
  social: 'Social',
  cnss: 'CNSS',
  dgid: 'DGID',
  autre: 'Autre',
};

const mandateStatusConfig: Record<string, { label: string; color: string }> = {
  actif: { label: 'Actif', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  expire: { label: 'Expire', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  revoque: { label: 'Revoque', color: 'bg-red-100 text-red-800 border-red-200' },
};

const timelineEventLabels: Record<string, string> = {
  demande_creee: 'Demande creee',
  en_traitement: 'Pris en charge',
  soumis: 'Soumis pour validation',
  valide: 'Valide',
  annule: 'Annule',
  preuve_fournie: 'Preuve fournie',
  document_uploade: 'Document uploade',
  commentaire: 'Commentaire ajoute',
};

const familyCardColors: Record<string, string> = {
  digital_office: 'border-l-blue-500',
  cnss_social: 'border-l-emerald-500',
  fiscalite: 'border-l-amber-500',
  sfec: 'border-l-violet-500',
  documentaire: 'border-l-orange-500',
  secretariat: 'border-l-slate-500',
};

const familyCardAccent: Record<string, string> = {
  digital_office: 'bg-blue-50 text-blue-600',
  cnss_social: 'bg-emerald-50 text-emerald-600',
  fiscalite: 'bg-amber-50 text-amber-600',
  sfec: 'bg-violet-50 text-violet-600',
  documentaire: 'bg-orange-50 text-orange-600',
  secretariat: 'bg-slate-50 text-slate-600',
};

const TaskStatusBadge = ({ status }: { status: string }) => {
  const cfg = taskStatusConfig[status] || taskStatusConfig.en_attente;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1 text-xs font-medium`}>
      {cfg.icon} {cfg.label}
    </Badge>
  );
};

const FamilyBadge = ({ family }: { family: string }) => {
  const cfg = familyConfig[family];
  if (!cfg) return <Badge variant="outline" className="text-xs">{family}</Badge>;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1 text-xs font-medium`}>
      {cfg.icon} {cfg.label}
    </Badge>
  );
};

const getServiceIcon = (icon: string) => serviceIconMap[icon] || <FileText className="w-5 h-5" />;

// ============================================================
// COMPONENT 1: ServicesView
// ============================================================
export function ServicesView() {
  const [services, setServices] = useState<(Service & { taskCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/services');
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      } else {
        toast.error('Erreur lors du chargement des services');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Services administratifs</h2>
          <p className="text-sm text-muted-foreground mt-1">Catalogue complet de nos services de back-office et formalites administratives</p>
        </div>
        <Button className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Nouvelle demande
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-5 w-3/4 mt-3" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : services.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground mt-3">Aucun service disponible</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => {
            const fcfg = familyConfig[svc.family];
            const accentClass = familyCardAccent[svc.family] || 'bg-slate-50 text-slate-600';
            const borderClass = familyCardColors[svc.family] || 'border-l-slate-400';
            return (
              <Card key={svc.id} className={`overflow-hidden border-l-4 ${borderClass} hover:shadow-md transition-shadow`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${accentClass}`}>
                      {getServiceIcon(svc.icon)}
                    </div>
                    <div className="flex items-center gap-2">
                      {svc.isRecurring && (
                        <Badge variant="outline" className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                          <RefreshCw className="w-2.5 h-2.5 mr-1" /> Recurrent
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-base font-semibold mt-3">{svc.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {svc.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{svc.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> SLA {svc.slaHours}h / {svc.slaUrgentHours}h
                    </span>
                    <span className="flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" /> {(svc as Service & { taskCount?: number }).taskCount || 0} tache(s)
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-primary">{formatPrice(svc.priceUnit)} FCFA</p>
                    {fcfg && (
                      <Badge variant="secondary" className="text-[10px]">
                        {fcfg.label}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT 2: NouvelleTacheView
// ============================================================
export function NouvelleTacheView() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normale');
  const [urgent, setUrgent] = useState(false);
  const [paymentMode, setPaymentMode] = useState('forfait');
  const [mandateId, setMandateId] = useState('');
  const [notes, setNotes] = useState('');

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/services');
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const selectedService = services.find(s => s.id === selectedServiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId || !title.trim()) {
      toast.error('Veuillez selectionner un service et saisir un titre');
      return;
    }
    try {
      setSubmitting(true);
      const body: Record<string, unknown> = {
        serviceId: selectedServiceId,
        title: title.trim(),
        description: description.trim() || undefined,
        family: selectedService?.family,
        priority,
        urgent,
        paymentMode,
        mandateId: mandateId.trim() || undefined,
        completionNote: notes.trim() || undefined,
      };
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Demande creee avec succes !');
        setTitle('');
        setDescription('');
        setNotes('');
        setSelectedServiceId('');
        setMandateId('');
        setPriority('normale');
        setUrgent(false);
        setPaymentMode('forfait');
      } else {
        const data = await res.json();
        toast.error(data.erreur || "Erreur lors de la creation");
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Nouvelle demande de service</h2>
        <p className="text-sm text-muted-foreground mt-1">Remplissez le formulaire pour soumettre une nouvelle demande administrative</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Service Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Service <span className="text-red-500">*</span></label>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selectionnez un service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map(svc => {
                      const fcfg = familyConfig[svc.family];
                      return (
                        <SelectItem key={svc.id} value={svc.id}>
                          <div className="flex items-center gap-2">
                            <span className={fcfg?.color || ''}>{fcfg?.icon}</span>
                            <span className="font-medium">{svc.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{formatPrice(svc.priceUnit)} FCFA</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {selectedService && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-xs">
                  <div className={familyConfig[selectedService.family]?.color || 'bg-slate-50 text-slate-600'}>
                    {getServiceIcon(selectedService.icon)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{selectedService.name}</p>
                    {selectedService.description && <p className="text-muted-foreground mt-0.5">{selectedService.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatPrice(selectedService.priceUnit)} FCFA</p>
                    <p className="text-muted-foreground">SLA {urgent ? selectedService.slaUrgentHours : selectedService.slaHours}h</p>
                  </div>
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Titre de la demande <span className="text-red-500">*</span></label>
              <Input
                placeholder="Ex: Declaration CNSS mensuelle - Janvier 2025"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Decrivez votre demande en detail..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Priority & Urgent */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priorite</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Urgent</label>
                <Button
                  type="button"
                  variant={urgent ? 'default' : 'outline'}
                  className={`w-full justify-start gap-2 ${urgent ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  onClick={() => setUrgent(!urgent)}
                >
                  <Zap className="w-4 h-4" />
                  {urgent ? 'Oui - Traitement prioritaire' : 'Non'}
                </Button>
              </div>
            </div>

            {/* Payment Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode de paiement</label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forfait">
                    <span className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> Forfait</span>
                  </SelectItem>
                  <SelectItem value="mobile_money">
                    <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Mobile Money</span>
                  </SelectItem>
                  <SelectItem value="virement">
                    <span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Virement bancaire</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mandate Reference */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reference mandat <span className="text-muted-foreground font-normal">(optionnel)</span></label>
              <Input
                placeholder="Ex: MND-20250115-001"
                value={mandateId}
                onChange={e => setMandateId(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Instructions / Notes supplementaires</label>
              <Textarea
                placeholder="Informations complementaires, instructions speciales..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Separator />

            {/* Submit */}
            <Button type="submit" className="w-full gap-2" disabled={submitting || !selectedServiceId || !title.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {submitting ? 'Envoi en cours...' : 'Soumettre la demande'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// COMPONENT 3: TachesView
// ============================================================
export function TachesView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (familyFilter !== 'all') params.set('family', familyFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        toast.error('Erreur lors du chargement des taches');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, familyFilter, search, page]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const fetchTaskDetail = useCallback(async (taskId: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTaskDetail(data.task);
      }
    } catch {
      toast.error('Erreur lors du chargement du detail');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      setTaskDetail(null);
    } else {
      setExpandedTask(taskId);
      fetchTaskDetail(taskId);
    }
  };

  const statusTabs = [
    { value: 'all', label: 'Toutes' },
    { value: 'en_attente', label: 'En attente' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'en_validation', label: 'Validation' },
    { value: 'termine', label: 'Terminees' },
    { value: 'annule', label: 'Annulees' },
  ];

  const getSlaInfo = (task: Task) => {
    if (!task.slaDeadline) return null;
    const now = new Date().getTime();
    const deadline = new Date(task.slaDeadline).getTime();
    const diffMs = deadline - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (task.slaBreached || diffMs < 0) {
      return { text: `SLA depasse de ${Math.abs(diffHours).toFixed(1)}h`, color: 'text-red-600 font-semibold' };
    }
    if (diffHours < 1) {
      return { text: `SLA dans ${Math.round(diffHours * 60)} min`, color: 'text-amber-600 font-medium' };
    }
    return { text: `SLA dans ${diffHours.toFixed(1)}h`, color: 'text-emerald-600' };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Mes demandes</h2>
        <p className="text-sm text-muted-foreground mt-1">Suivez l'avancement de vos demandes de services administratifs</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par reference, titre..."
            className="pl-9"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" size="icon">
          <Search className="w-4 h-4" />
        </Button>
      </form>

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {statusTabs.map(tab => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'default' : 'outline'}
            size="sm"
            className="text-xs whitespace-nowrap shrink-0"
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Family Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={familyFilter} onValueChange={v => { setFamilyFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-56 h-8 text-xs">
            <SelectValue placeholder="Filtrer par famille" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les familles</SelectItem>
            {Object.entries(familyConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="flex items-center gap-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-5 w-48 flex-1" /><Skeleton className="h-5 w-20" /></div><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground mt-3">Aucune demande trouvee</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Modifiez vos filtres ou creez une nouvelle demande</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const slaInfo = getSlaInfo(task);
            const isExpanded = expandedTask === task.id;
            return (
              <div key={task.id}>
                <Card
                  className={`cursor-pointer hover:shadow-md transition-all ${isExpanded ? 'ring-2 ring-primary/20' : ''} ${task.slaBreached && task.status !== 'termine' && task.status !== 'annule' ? 'border-red-200 bg-red-50/30' : ''}`}
                  onClick={() => handleExpand(task.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="font-mono text-[10px]">{task.reference}</Badge>
                        {task.urgent && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px] gap-1"><Zap className="w-2.5 h-2.5" /> Urgent</Badge>}
                      </div>
                      <p className="flex-1 font-medium text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <FamilyBadge family={task.family} />
                        <TaskStatusBadge status={task.status} />
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-muted-foreground">
                      {task.service && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{task.service.name}</span>}
                      {task.assignedUser && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{task.assignedUser.name}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateFull(task.createdAt)}</span>
                      {slaInfo && <span className={`flex items-center gap-1 ${slaInfo.color}`}><Timer className="w-3 h-3" />{slaInfo.text}</span>}
                      {task.price > 0 && <span className="font-medium text-foreground">{formatPrice(task.price)} FCFA</span>}
                    </div>
                  </CardContent>
                </Card>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="mt-1">
                    <Card>
                      <CardContent className="p-4">
                        {loadingDetail ? (
                          <div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-20 w-full" /></div>
                        ) : taskDetail ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div><span className="text-muted-foreground">Reference :</span> <span className="font-mono font-medium">{taskDetail.reference}</span></div>
                              <div><span className="text-muted-foreground">Statut :</span> <TaskStatusBadge status={taskDetail.status} /></div>
                              <div><span className="text-muted-foreground">Famille :</span> <FamilyBadge family={taskDetail.family} /></div>
                              <div><span className="text-muted-foreground">Priorite :</span> <Badge variant="outline" className={priorityConfig[taskDetail.priority]?.color || ''}>{priorityConfig[taskDetail.priority]?.label || taskDetail.priority}</Badge></div>
                              <div><span className="text-muted-foreground">Paiement :</span> <span className="font-medium">{paymentModeLabels[taskDetail.paymentMode] || taskDetail.paymentMode}</span></div>
                              <div><span className="text-muted-foreground">Prix :</span> <span className="font-bold">{formatPrice(taskDetail.price)} FCFA</span></div>
                              {taskDetail.assignedUser && <div><span className="text-muted-foreground">Assigne a :</span> <span className="font-medium">{taskDetail.assignedUser.name}</span></div>}
                            </div>

                            {taskDetail.description && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                                <p className="text-sm bg-muted/50 rounded-lg p-3">{taskDetail.description}</p>
                              </div>
                            )}

                            {taskDetail.mandate && (
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                                <Gavel className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Mandat :</span>
                                <span className="font-mono font-medium">{taskDetail.mandate.reference}</span>
                                <Badge variant="outline" className="text-[10px]">{mandateTypeLabels[taskDetail.mandate.type] || taskDetail.mandate.type}</Badge>
                              </div>
                            )}

                            {taskDetail.timeline && taskDetail.timeline.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Historique</p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                  {taskDetail.timeline.map(t => (
                                    <div key={t.id} className="flex items-start gap-2 text-xs">
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span className="font-medium">{timelineEventLabels[t.event] || t.event}</span>
                                        {t.comment && <span className="text-muted-foreground ml-1">- {t.comment}</span>}
                                        <p className="text-muted-foreground mt-0.5">{formatDateFull(t.timestamp)} a {formatDate(t.timestamp)}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {taskDetail.documents && taskDetail.documents.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Documents ({taskDetail.documents.length})</p>
                                <div className="space-y-1.5">
                                  {taskDetail.documents.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
                                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="font-medium flex-1 truncate">{doc.name}</span>
                                      <Badge variant="secondary" className="text-[10px]">{doc.type}</Badge>
                                      {doc.fileUrl && (
                                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {taskDetail.completionNote && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Note de completion</p>
                                <p className="text-sm bg-emerald-50 rounded-lg p-3 text-emerald-800 border border-emerald-100">{taskDetail.completionNote}</p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Precedent</Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT 4: AdminTachesView
// ============================================================
export function AdminTachesView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, enAttente: 0, enCours: 0, slaBrisee: 0 });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (familyFilter !== 'all') params.set('family', familyFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const allTasks = data.tasks || [];
        setTasks(allTasks);
        setTotalPages(data.pagination?.pages || 1);
        // Compute local stats
        setStats({
          total: data.pagination?.total || 0,
          enAttente: allTasks.filter(t => t.status === 'en_attente').length,
          enCours: allTasks.filter(t => t.status === 'en_cours').length,
          slaBrisee: allTasks.filter(t => t.slaBreached).length,
        });
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, familyFilter, search, page]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const fetchTaskDetail = useCallback(async (taskId: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTaskDetail(data.task);
      }
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      setTaskDetail(null);
    } else {
      setExpandedTask(taskId);
      fetchTaskDetail(taskId);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      setUpdatingStatus(taskId);
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Statut mis a jour : ${taskStatusConfig[newStatus]?.label || newStatus}`);
        fetchTasks();
        if (expandedTask === taskId) fetchTaskDetail(taskId);
      } else {
        toast.error('Erreur lors de la mise a jour');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredTasks = companySearch
    ? tasks.filter(t => t.company?.name?.toLowerCase().includes(companySearch.toLowerCase()))
    : tasks;

  const getSlaInfo = (task: Task) => {
    if (!task.slaDeadline) return null;
    const now = new Date().getTime();
    const deadline = new Date(task.slaDeadline).getTime();
    const diffMs = deadline - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (task.slaBreached || diffMs < 0) {
      return { text: `SLA depasse de ${Math.abs(diffHours).toFixed(1)}h`, color: 'text-red-600 font-semibold' };
    }
    if (diffHours < 1) {
      return { text: `SLA dans ${Math.round(diffHours * 60)} min`, color: 'text-amber-600 font-medium' };
    }
    return { text: `SLA dans ${diffHours.toFixed(1)}h`, color: 'text-emerald-600' };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Administration des taches</h2>
        <p className="text-sm text-muted-foreground mt-1">Gestion de toutes les demandes de services administratifs</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><ClipboardList className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total taches</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700"><Clock className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">En attente</p>
                <p className="text-lg font-bold">{stats.enAttente}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-100 text-sky-700"><Loader2 className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">En cours</p>
                <p className="text-lg font-bold">{stats.enCours}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-700"><AlertTriangle className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">SLA brisee</p>
                <p className={`text-lg font-bold ${stats.slaBrisee > 0 ? 'text-red-600' : ''}`}>{stats.slaBrisee}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par reference, titre..." className="pl-9" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" size="icon"><Search className="w-4 h-4" /></Button>
        </form>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filtrer par entreprise" className="pl-9 w-full sm:w-56" value={companySearch} onChange={e => setCompanySearch(e.target.value)} />
        </div>
      </div>

      {/* Status & Family Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
          {[
            { value: 'all', label: 'Toutes' },
            { value: 'en_attente', label: 'En attente' },
            { value: 'en_cours', label: 'En cours' },
            { value: 'en_validation', label: 'Validation' },
            { value: 'termine', label: 'Terminees' },
            { value: 'annule', label: 'Annulees' },
          ].map(tab => (
            <Button key={tab.value} variant={statusFilter === tab.value ? 'default' : 'outline'} size="sm" className="text-xs whitespace-nowrap shrink-0" onClick={() => { setStatusFilter(tab.value); setPage(1); }}>{tab.label}</Button>
          ))}
        </div>
        <Select value={familyFilter} onValueChange={v => { setFamilyFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
            <SelectValue placeholder="Famille" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les familles</SelectItem>
            {Object.entries(familyConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="flex items-center gap-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-5 w-48 flex-1" /><Skeleton className="h-5 w-20" /></div><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground mt-3">Aucune tache trouvee</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map(task => {
            const slaInfo = getSlaInfo(task);
            const isExpanded = expandedTask === task.id;
            return (
              <div key={task.id}>
                <Card
                  className={`hover:shadow-md transition-all ${isExpanded ? 'ring-2 ring-primary/20' : ''} ${task.slaBreached && task.status !== 'termine' && task.status !== 'annule' ? 'border-red-300 bg-red-50/40' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleExpand(task.id)}>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="font-mono text-[10px]">{task.reference}</Badge>
                        {task.urgent && <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px] gap-1"><Zap className="w-2.5 h-2.5" /> Urgent</Badge>}
                      </div>
                      {task.company && <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="w-2.5 h-2.5" />{task.company.name}</Badge>}
                      <p className="flex-1 font-medium text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <FamilyBadge family={task.family} />
                        <TaskStatusBadge status={task.status} />
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {task.assignedUser && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{task.assignedUser.name}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateFull(task.createdAt)}</span>
                      {slaInfo && <span className={`flex items-center gap-1 ${slaInfo.color}`}><Timer className="w-3 h-3" />{slaInfo.text}</span>}
                      {task.price > 0 && <span className="font-medium text-foreground">{formatPrice(task.price)} FCFA</span>}
                    </div>

                    {/* Quick status actions (inline) */}
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
                      <span className="text-[10px] text-muted-foreground mr-1">Changer le statut :</span>
                      {Object.entries(taskStatusConfig).map(([key, cfg]) => (
                        <Button
                          key={key}
                          variant={task.status === key ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[10px] px-2 gap-1"
                          disabled={updatingStatus === task.id}
                          onClick={() => updateTaskStatus(task.id, key)}
                        >
                          {updatingStatus === task.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : cfg.icon}
                          {cfg.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {isExpanded && (
                  <div className="mt-1">
                    <Card>
                      <CardContent className="p-4">
                        {loadingDetail ? (
                          <div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-20 w-full" /></div>
                        ) : taskDetail ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div><span className="text-muted-foreground text-xs">Reference :</span> <span className="font-mono font-medium">{taskDetail.reference}</span></div>
                              <div><span className="text-muted-foreground text-xs">Entreprise :</span> <span className="font-medium">{taskDetail.company?.name || '-'}</span></div>
                              <div><span className="text-muted-foreground text-xs">Client :</span> <span className="font-medium">{taskDetail.client?.name || '-'}</span></div>
                              <div><span className="text-muted-foreground text-xs">Statut :</span> <TaskStatusBadge status={taskDetail.status} /></div>
                              <div><span className="text-muted-foreground text-xs">Famille :</span> <FamilyBadge family={taskDetail.family} /></div>
                              <div><span className="text-muted-foreground text-xs">Priorite :</span> <Badge variant="outline" className={priorityConfig[taskDetail.priority]?.color || ''}>{priorityConfig[taskDetail.priority]?.label || taskDetail.priority}</Badge></div>
                              <div><span className="text-muted-foreground text-xs">Paiement :</span> <span className="font-medium">{paymentModeLabels[taskDetail.paymentMode] || taskDetail.paymentMode}</span></div>
                              <div><span className="text-muted-foreground text-xs">Prix :</span> <span className="font-bold">{formatPrice(taskDetail.price)} FCFA</span></div>
                              <div><span className="text-muted-foreground text-xs">Assigne a :</span> <span className="font-medium">{taskDetail.assignedUser?.name || 'Non assigne'}</span></div>
                            </div>

                            {taskDetail.description && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                                <p className="text-sm bg-muted/50 rounded-lg p-3">{taskDetail.description}</p>
                              </div>
                            )}

                            {taskDetail.mandate && (
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                                <Gavel className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Mandat :</span>
                                <span className="font-mono font-medium">{taskDetail.mandate.reference}</span>
                                <Badge variant="outline" className="text-[10px]">{mandateTypeLabels[taskDetail.mandate.type] || taskDetail.mandate.type}</Badge>
                              </div>
                            )}

                            {taskDetail.timeline && taskDetail.timeline.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Historique</p>
                                <ScrollArea className="max-h-48">
                                  <div className="space-y-1.5">
                                    {taskDetail.timeline.map(t => (
                                      <div key={t.id} className="flex items-start gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <span className="font-medium">{timelineEventLabels[t.event] || t.event}</span>
                                          {t.comment && <span className="text-muted-foreground ml-1">- {t.comment}</span>}
                                          <p className="text-muted-foreground mt-0.5">{formatDateFull(t.timestamp)} a {formatDate(t.timestamp)}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}

                            {taskDetail.documents && taskDetail.documents.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Documents ({taskDetail.documents.length})</p>
                                <div className="space-y-1.5">
                                  {taskDetail.documents.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
                                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span className="font-medium flex-1 truncate">{doc.name}</span>
                                      <Badge variant="secondary" className="text-[10px]">{doc.type}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {taskDetail.completionNote && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Note de completion</p>
                                <p className="text-sm bg-emerald-50 rounded-lg p-3 text-emerald-800 border border-emerald-100">{taskDetail.completionNote}</p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Precedent</Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT 5: MandatsView
// ============================================================
export function MandatsView() {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create mandate form
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchMandates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const res = await fetch(`/api/mandates?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMandates(data.mandates || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        toast.error('Erreur lors du chargement des mandats');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchMandates(); }, [fetchMandates]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createType) {
      toast.error('Veuillez selectionner un type de mandat');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch('/api/mandates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: createType,
          description: createDesc.trim() || undefined,
          startDate: createStart || undefined,
          endDate: createEnd || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Mandat cree avec succes !');
        setShowCreate(false);
        setCreateType('');
        setCreateDesc('');
        setCreateStart('');
        setCreateEnd('');
        fetchMandates();
      } else {
        const data = await res.json();
        toast.error(data.erreur || 'Erreur lors de la creation');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setUpdatingId(id);
      const res = await fetch('/api/mandates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(`Mandat mis a jour : ${mandateStatusConfig[status]?.label || status}`);
        fetchMandates();
      } else {
        toast.error('Erreur lors de la mise a jour du mandat');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Gestion des mandats</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerez vos mandats de services administratifs</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Nouveau mandat
        </Button>
      </div>

      {/* Create Mandate Form */}
      {showCreate && (
        <Card className="border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Nouveau mandat</CardTitle>
            <CardDescription>Remplissez les informations pour creer un nouveau mandat</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type de mandat <span className="text-red-500">*</span></label>
                  <Select value={createType} onValueChange={setCreateType}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selectionnez le type" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(mandateTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date de debut</label>
                  <Input type="date" value={createStart} onChange={e => setCreateStart(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de fin</label>
                <Input type="date" value={createEnd} onChange={e => setCreateEnd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea placeholder="Description du mandat..." value={createDesc} onChange={e => setCreateDesc(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button type="submit" disabled={submitting || !createType}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  Creer le mandat
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mandate List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="flex items-center gap-3"><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-16" /></div><Skeleton className="h-4 w-full mt-2" /></CardContent></Card>
          ))}
        </div>
      ) : mandates.length === 0 ? (
        <Card className="p-12 text-center">
          <Gavel className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground mt-3">Aucun mandat trouve</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {mandates.map(m => {
            const statusCfg = mandateStatusConfig[m.status] || mandateStatusConfig.actif;
            const taskCount = (m as Mandate & { tasks?: unknown[] }).tasks?.length || 0;
            return (
              <Card key={m.id} className={`hover:shadow-md transition-shadow ${m.status === 'revoque' ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="font-mono text-[10px]">{m.reference}</Badge>
                      <Badge variant="outline" className="text-[10px]">{mandateTypeLabels[m.type] || m.type}</Badge>
                    </div>
                    <p className="flex-1 text-sm truncate">{m.description || 'Sans description'}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.company && <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="w-2.5 h-2.5" />{m.company.name}</Badge>}
                      <Badge variant="outline" className={`${statusCfg.color} text-[10px]`}>{statusCfg.label}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Cree le {formatDateFull(m.createdAt)}</span>
                    {m.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Du {formatDateFull(m.startDate)}</span>}
                    {m.endDate && <span>jusqu'au {formatDateFull(m.endDate)}</span>}
                    <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" />{taskCount} tache(s)</span>
                  </div>

                  {/* Admin actions */}
                  {m.status === 'actif' && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
                      <span className="text-[10px] text-muted-foreground mr-1">Actions :</span>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" disabled={updatingId === m.id} onClick={() => handleUpdateStatus(m.id, 'expire')}>
                        {updatingId === m.id && <Loader2 className="w-2.5 h-2.5 animate-spin" />} Marquer expire
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 text-red-600 hover:text-red-700" disabled={updatingId === m.id} onClick={() => handleUpdateStatus(m.id, 'revoque')}>
                        Revoquer
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Precedent</Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT 6: SLAMonitorView
// ============================================================
export function SLAMonitorView() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalActive: 0, totalBreached: 0, totalCompleted: 0, completedOnTime: 0,
    breachRate: 0, complianceRate: 100,
  });
  const [breachedTasks, setBreachedTasks] = useState<Task[]>([]);
  const [approachingTasks, setApproachingTasks] = useState<Task[]>([]);
  const [statsByFamily, setStatsByFamily] = useState<{ family: string; total: number; responseTime: { avgMinutes: number; count: number } }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/sla');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || { totalActive: 0, totalBreached: 0, totalCompleted: 0, completedOnTime: 0, breachRate: 0, complianceRate: 100 });
        setBreachedTasks(data.breachedTasks || []);
        setApproachingTasks(data.approachingTasks || []);
        setStatsByFamily(data.statsByFamily || []);
      } else {
        toast.error('Erreur lors du chargement des donnees SLA');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getSlaColor = (task: Task) => {
    if (task.slaBreached) return 'border-red-300 bg-red-50/40';
    if (task.slaDeadline) {
      const diff = new Date(task.slaDeadline).getTime() - Date.now();
      if (diff < 60 * 60 * 1000) return 'border-amber-300 bg-amber-50/40';
    }
    return '';
  };

  const maxFamilyTotal = Math.max(...statsByFamily.map(s => s.total), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Monitoring SLA</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivi des niveaux de service et alertes de depassement</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Taches actives</p>
                {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold tracking-tight">{summary.totalActive}</p>}
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Timer className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">SLA depasse</p>
                {loading ? <Skeleton className="h-8 w-12" /> : <p className={`text-2xl font-bold tracking-tight ${summary.totalBreached > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{summary.totalBreached}</p>}
              </div>
              <div className="p-2.5 rounded-xl bg-red-100 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Taux de conformite</p>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <p className={`text-2xl font-bold tracking-tight ${summary.complianceRate >= 90 ? 'text-emerald-600' : summary.complianceRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{summary.complianceRate}%</p>
                    <Progress value={summary.complianceRate} className={`h-1.5 mt-1 ${summary.complianceRate >= 90 ? '[&>div]:bg-emerald-500' : summary.complianceRate >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`} />
                  </>
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Temps moyen de reponse</p>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <p className="text-2xl font-bold tracking-tight">
                    {(() => {
                      const total = statsByFamily.reduce((acc, s) => acc + s.responseTime.avgMinutes * s.responseTime.count, 0);
                      const count = statsByFamily.reduce((acc, s) => acc + s.responseTime.count, 0);
                      const avgMin = count > 0 ? Math.round(total / count) : 0;
                      if (avgMin >= 60) return `${Math.floor(avgMin / 60)}h ${avgMin % 60}min`;
                      return `${avgMin} min`;
                    })()}
                  </p>
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-sky-100 text-sky-600"><Zap className="w-5 h-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breached">
        <TabsList>
          <TabsTrigger value="breached" className="gap-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            SLA depasse ({breachedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="approaching" className="gap-1.5 text-xs">
            <Timer className="w-3.5 h-3.5" />
            Approchant ({approachingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="family" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            Par famille
          </TabsTrigger>
        </TabsList>

        <TabsContent value="breached" className="mt-4">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardContent></Card>)}</div>
          ) : breachedTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
              <p className="text-muted-foreground mt-3">Aucun SLA depasse - Tout est dans les delais !</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {breachedTasks.map(task => (
                <Card key={task.id} className="border-red-300 bg-red-50/40">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="font-mono text-[10px]">{task.reference}</Badge>
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px] gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Depasse</Badge>
                      </div>
                      <p className="flex-1 font-medium text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <TaskStatusBadge status={task.status} />
                        {task.company && <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="w-2.5 h-2.5" />{task.company.name}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {task.service && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{task.service.name}</span>}
                      {task.assignedUser && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{task.assignedUser.name}</span>}
                      {task.slaDeadline && <span className="text-red-600 font-medium flex items-center gap-1"><Timer className="w-3 h-3" />Echeance : {formatDateFull(task.slaDeadline)} {formatDate(task.slaDeadline)}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approaching" className="mt-4">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardContent></Card>)}</div>
          ) : approachingTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="w-10 h-10 mx-auto text-amber-400" />
              <p className="text-muted-foreground mt-3">Aucun SLA approchant dans l'heure</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {approachingTasks.map(task => (
                <Card key={task.id} className="border-amber-300 bg-amber-50/40">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="font-mono text-[10px]">{task.reference}</Badge>
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-1"><Clock className="w-2.5 h-2.5" /> Approchant</Badge>
                      </div>
                      <p className="flex-1 font-medium text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <TaskStatusBadge status={task.status} />
                        {task.company && <Badge variant="outline" className="text-[10px] gap-1"><Building2 className="w-2.5 h-2.5" />{task.company.name}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {task.service && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{task.service.name}</span>}
                      {task.assignedUser && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{task.assignedUser.name}</span>}
                      {task.slaDeadline && <span className="text-amber-600 font-medium flex items-center gap-1"><Timer className="w-3 h-3" />Echeance : {formatDateFull(task.slaDeadline)} {formatDate(task.slaDeadline)}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="family" className="mt-4">
          {loading ? (
            <Card><CardContent className="p-6 space-y-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="w-24 h-4" /><Skeleton className="flex-1 h-6" /></div>)}</CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Statistiques par famille de service</CardTitle>
                <CardDescription className="text-xs">Repartition des taches et temps de reponse moyen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsByFamily.map(sf => {
                  const fcfg = familyConfig[sf.family];
                  const pct = maxFamilyTotal > 0 ? (sf.total / maxFamilyTotal) * 100 : 0;
                  return (
                    <div key={sf.family} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${fcfg?.color || 'bg-slate-50 text-slate-600'}`}>
                        {fcfg?.icon || <FileText className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{fcfg?.label || sf.family}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{sf.total} tache(s)</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {sf.responseTime.avgMinutes >= 60
                                ? `${Math.floor(sf.responseTime.avgMinutes / 60)}h ${sf.responseTime.avgMinutes % 60}min`
                                : `${sf.responseTime.avgMinutes} min`
                              }
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${sf.family === 'digital_office' ? 'bg-blue-500' : sf.family === 'cnss_social' ? 'bg-emerald-500' : sf.family === 'fiscalite' ? 'bg-amber-500' : sf.family === 'sfec' ? 'bg-violet-500' : sf.family === 'documentaire' ? 'bg-orange-500' : 'bg-slate-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {statsByFamily.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucune donnee disponible</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
