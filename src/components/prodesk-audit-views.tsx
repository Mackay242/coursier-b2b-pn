'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText, Building2, Briefcase, ClipboardList, Send, Plus, Search,
  ChevronDown, ChevronRight, Eye, Download, Copy, Printer,
  BookOpen, Users, MapPin, Phone, Mail, Globe, Link2,
  CheckCircle2, Clock, AlertCircle, Loader2, ArrowRight, Filter
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================
interface Procedure {
  id: string; serviceFamily: string; title: string; description?: string;
  steps: string; requiredDocuments: string; estimatedDuration?: string;
  cost?: string; order: number;
}

interface Partner {
  id: string; name: string; type: string; slug: string; address?: string;
  phone?: string; email?: string; website?: string; contactPerson?: string;
  description?: string;
  linkType?: string; linkDescription?: string; serviceName?: string; serviceSlug?: string;
}

interface JobDescription {
  id: string; serviceFamily: string; title: string; department: string;
  mission: string; responsibilities: string; requiredSkills: string;
  requiredDiplomas: string; experience?: string; tools: string; reportsTo?: string;
}

interface CorrTemplate {
  id: string; title: string; slug: string; serviceFamily?: string;
  category: string; subject: string; body: string; footer?: string;
}

interface Correspondence {
  id: string; reference: string; templateId?: string; templateTitle?: string;
  taskId?: string; companyId?: string; companyName?: string; companyNif?: string;
  partnerId?: string; partnerName?: string; category: string; subject: string;
  body: string; status: string; sentAt?: string; createdAt: string;
}

const familyLabels: Record<string, string> = {
  digital_office: 'Bureau Digital',
  cnss_social: 'CNSS / Social',
  fiscalite: 'Fiscalité',
  sfec: 'SFEC',
  documentaire: 'Gestion Documentaire',
  secretariat: 'Secrétariat',
};

const categoryLabels: Record<string, string> = {
  courrier_sortant: 'Courrier sortant',
  courrier_entrant: 'Courrier entrant',
  demande: 'Demande',
  reclamation: 'Réclamation',
  attestation: 'Attestation',
  rapport: 'Rapport',
};

const statusColors: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  emis: 'bg-blue-100 text-blue-700',
  recu: 'bg-green-100 text-green-700',
  archive: 'bg-amber-100 text-amber-700',
};

const linkTypeLabels: Record<string, string> = {
  mandat: 'Mandat',
  depot: 'Dépôt de dossier',
  declaration: 'Déclaration',
  paiement: 'Paiement',
  information: 'Information',
};

const parseJSON = (str: string): string[] => {
  try { return JSON.parse(str); } catch { return [str]; }
};

// ============================================================
// C — VUE PARTENAIRES / INSTITUTIONS
// ============================================================
export function PartenairesView() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterService, setFilterService] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterService === 'all' ? '/api/partners' : `/api/partners?service=${filterService}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners || []);
      }
    } catch {} finally { setLoading(false); }
  }, [filterService]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  // Grouper par institution
  const grouped = partners.reduce((acc, p) => {
    const key = p.id;
    if (!acc[key]) acc[key] = { ...p, links: [] };
    if (p.serviceName) {
      acc[key].links.push({ type: p.linkType, desc: p.linkDescription, service: p.serviceName });
    }
    return acc;
  }, {} as Record<string, any>);

  const institutions = Object.values(grouped);
  const typeCount = { institution: 0, ministere: 0, cabinet: 0 };
  institutions.forEach((p: any) => { if (typeCount[p.type as keyof typeof typeCount] !== undefined) typeCount[p.type as keyof typeof typeCount]++; });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Partenaires & Institutions</h2>
          <p className="text-sm text-muted-foreground">Mapping complet des institutions congolaises et leurs liaisons avec nos services</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1"><Building2 className="w-3 h-3" /> {institutions.length} partenaires</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-2xl font-bold">{typeCount.institution}</p><p className="text-xs text-muted-foreground">Institutions</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><BookOpen className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-2xl font-bold">{typeCount.ministere}</p><p className="text-xs text-muted-foreground">Ministères</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Link2 className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold">{partners.filter(p => p.serviceName).length}</p><p className="text-xs text-muted-foreground">Liaisons actives</p></div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Filtrer par service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les services</SelectItem>
            <SelectItem value="svc_fiscalite">Fiscalité</SelectItem>
            <SelectItem value="svc_cnss_social">CNSS / Social</SelectItem>
            <SelectItem value="svc_sfec">SFEC</SelectItem>
            <SelectItem value="svc_digital">Bureau Digital</SelectItem>
            <SelectItem value="svc_documentaire">Gestion Documentaire</SelectItem>
            <SelectItem value="svc_secretariat">Secrétariat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {institutions.map((inst: any) => (
            <Card key={inst.id} className="overflow-hidden">
              <button onClick={() => setExpanded(expanded === inst.id ? null : inst.id)} className="w-full text-left">
                <CardHeader className="pb-3 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${inst.type === 'ministere' ? 'bg-purple-50 text-purple-600' : inst.type === 'cabinet' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{inst.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px]">{inst.type}</Badge>
                          {inst.links && inst.links.length > 0 && <span className="text-xs text-muted-foreground">{inst.links.length} liaison(s)</span>}
                        </div>
                      </div>
                    </div>
                    {expanded === inst.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </CardHeader>
              </button>
              {expanded === inst.id && (
                <CardContent className="px-5 pb-4 pt-0 border-t">
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Coordonnées</p>
                      {inst.address && <p className="text-sm flex items-start gap-2"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />{inst.address}</p>}
                      {inst.phone && <p className="text-sm flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{inst.phone}</p>}
                      {inst.email && <p className="text-sm flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{inst.email}</p>}
                      {inst.website && <p className="text-sm flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-muted-foreground" />{inst.website}</p>}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Liaisons avec nos services</p>
                      {inst.links && inst.links.length > 0 ? inst.links.map((link: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
                          <Badge variant="outline" className="text-[10px] shrink-0">{linkTypeLabels[link.type] || link.type}</Badge>
                          <span className="font-medium">{link.service}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground text-xs">{link.desc}</span>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Aucune liaison active</p>}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// A — VUE PROCÉDURES
// ============================================================
export function ProceduresView() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFamily, setFilterFamily] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchProcedures = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterFamily === 'all' ? '/api/procedures' : `/api/procedures?family=${filterFamily}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProcedures(data.procedures || []);
      }
    } catch {} finally { setLoading(false); }
  }, [filterFamily]);

  useEffect(() => { fetchProcedures(); }, [fetchProcedures]);

  const familyProcedures: [string, Procedure[]][] = filterFamily === 'all'
    ? Object.entries(procedures.reduce((acc, p) => { (acc[p.serviceFamily] = acc[p.serviceFamily] || []).push(p); return acc; }, {} as Record<string, Procedure[]>))
    : [[filterFamily, procedures.filter(p => p.serviceFamily === filterFamily)]];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Procédures administratives</h2>
          <p className="text-sm text-muted-foreground">Guide étape par étape pour chaque service administratif</p>
        </div>
        <Badge variant="outline" className="gap-1 w-fit"><ClipboardList className="w-3 h-3" /> {procedures.length} procédures</Badge>
      </div>

      <Select value={filterFamily} onValueChange={setFilterFamily}>
        <SelectTrigger className="w-64"><SelectValue placeholder="Filtrer par service" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les services</SelectItem>
          {Object.entries(familyLabels).map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : (
        <div className="space-y-6">
          {familyProcedures.map(([family, procs]) => (
            <div key={family}>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={family === 'fiscalite' ? 'bg-red-50 text-red-700' : family === 'cnss_social' ? 'bg-green-50 text-green-700' : family === 'sfec' ? 'bg-purple-50 text-purple-700' : family === 'digital_office' ? 'bg-blue-50 text-blue-700' : family === 'documentaire' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}>
                  {familyLabels[family] || family}
                </Badge>
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{(procs as Procedure[]).length} procédure(s)</span>
              </div>
              <div className="space-y-3">
                {(procs as Procedure[]).map(proc => {
                  const steps = parseJSON(proc.steps);
                  const docs = parseJSON(proc.requiredDocuments);
                  const isOpen = expanded === proc.id;
                  return (
                    <Card key={proc.id} className="overflow-hidden">
                      <button onClick={() => setExpanded(isOpen ? null : proc.id)} className="w-full text-left">
                        <CardHeader className="pb-3 pt-4 px-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-semibold">{proc.title}</CardTitle>
                              <p className="text-xs text-muted-foreground mt-1">{proc.estimatedDuration || 'Durée non définie'} {proc.cost ? `| ${proc.cost}` : ''}</p>
                            </div>
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </CardHeader>
                      </button>
                      {isOpen && (
                        <CardContent className="px-5 pb-4 pt-0 border-t">
                          {proc.description && <p className="text-sm text-muted-foreground mt-3 mb-4">{proc.description}</p>}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide mb-3">Étapes de la procédure</p>
                              <div className="space-y-2">
                                {steps.map((step, i) => (
                                  <div key={i} className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                                    <p className="text-sm leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide mb-3">Documents requis</p>
                              <div className="space-y-1.5">
                                {docs.map((doc, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    {doc}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// B — VUE FICHES DE POSTE
// ============================================================
export function FichesPosteView() {
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/job-descriptions');
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobDescriptions || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Fiches de poste PRODESK</h2>
        <p className="text-sm text-muted-foreground">Descriptions des postes, missions et compétences requises par service</p>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const skills = parseJSON(job.requiredSkills);
            const diplomas = parseJSON(job.requiredDiplomas);
            const responsibilities = parseJSON(job.responsibilities);
            const tools = parseJSON(job.tools);
            const isOpen = expanded === job.id;
            return (
              <Card key={job.id} className="overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : job.id)} className="w-full text-left">
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-sm font-semibold">{job.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px]">{familyLabels[job.serviceFamily] || job.serviceFamily}</Badge>
                            <span className="text-xs text-muted-foreground">{job.experience || 'Non spécifié'}</span>
                          </div>
                        </div>
                      </div>
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </CardHeader>
                </button>
                {isOpen && (
                  <CardContent className="px-5 pb-4 pt-0 border-t">
                    <div className="mt-4 space-y-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1">Mission principale</p>
                        <p className="text-sm leading-relaxed">{job.mission}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2">Responsabilités</p>
                        <div className="space-y-1.5">
                          {responsibilities.map((r, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              {r}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2">Compétences</p>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>)}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2">Diplômes</p>
                          <div className="space-y-1">
                            {diplomas.map((d, i) => <p key={i} className="text-sm">{d}</p>)}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2">Outils</p>
                          <div className="flex flex-wrap gap-1.5">
                            {tools.map((t, i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>)}
                          </div>
                        </div>
                      </div>
                      {job.reportsTo && (
                        <p className="text-xs text-muted-foreground">Rend compte à : <span className="font-medium text-foreground">{job.reportsTo}</span></p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// D — VUE CORRESPONDANCE ADMINISTRATIVE
// ============================================================
export function CorrespondanceView() {
  const [activeTab, setActiveTab] = useState<string>('generer');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Correspondance administrative</h2>
        <p className="text-sm text-muted-foreground">Génération et suivi des courriers officiels</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generer" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Générer</TabsTrigger>
          <TabsTrigger value="historique" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="generer" className="mt-4"><CorrespondenceGenerator /></TabsContent>
        <TabsContent value="historique" className="mt-4"><CorrespondenceHistory /></TabsContent>
      </Tabs>
    </div>
  );
}

// — Generateur de correspondance
function CorrespondenceGenerator() {
  const [templates, setTemplates] = useState<CorrTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CorrTemplate | null>(null);
  const [category, setCategory] = useState<string>('demande');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [preview, setPreview] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({
    entreprise: '', representant: '', nif: '', rccm: '',
    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
  });

  // Charger les templates par catégorie
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/correspondence/templates?category=${category}`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch {}
    })();
    setSelectedTemplate(null);
    setPreview('');
  }, [category]);

  // Charger les partenaires
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/partners');
        if (res.ok) {
          const data = await res.json();
          const unique = (data.partners || []).reduce((acc: any[], p: any) => {
            if (!acc.find((x: any) => x.id === p.id)) acc.push(p);
            return acc;
          }, []);
          setPartners(unique);
        }
      } catch {}
    })();
  }, []);

  // Auto-preview
  useEffect(() => {
    if (!selectedTemplate) { setPreview(''); return; }
    let body = selectedTemplate.body;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      body = body.replace(regex, value || `{{${key}}}`);
    });
    setPreview(body);
  }, [selectedTemplate, variables]);

  // Extraire les variables du template
  const extractVars = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))];
  };

  const templateVars = selectedTemplate ? extractVars(selectedTemplate.body + ' ' + selectedTemplate.subject) : [];

  const handleGenerate = async (status: string = 'brouillon') => {
    if (!selectedTemplate && !preview) { toast.error('Sélectionnez un modèle ou saisissez un courrier'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/correspondence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate?.id,
          variables,
          category,
          subject: selectedTemplate?.subject || 'Sans objet',
          bodyText: preview,
          status,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Correspondance ${data.correspondence.reference} créée !`);
        if (status === 'emis') {
          toast.success('Marquée comme émise');
        }
      } else {
        const err = await res.json();
        toast.error(err.erreur || 'Erreur de génération');
      }
    } catch { toast.error('Erreur réseau'); } finally { setGenerating(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Panneau gauche — Configuration */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">1. Type de correspondance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">2. Choisir un modèle</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {templates.length === 0 && <p className="text-sm text-muted-foreground">Aucun modèle pour cette catégorie</p>}
              {templates.map(tpl => (
                <button key={tpl.id} onClick={() => setSelectedTemplate(tpl)}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${selectedTemplate?.id === tpl.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <p className="font-medium">{tpl.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.serviceFamily ? familyLabels[tpl.serviceFamily] : 'Générique'}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {templateVars.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">3. Informations de l'entreprise</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {templateVars.map(v => (
                <div key={v}>
                  <label className="text-xs font-medium text-muted-foreground">{v.replace(/_/g, ' ')}</label>
                  {v.includes('detail') || v.includes('synthese') || v.includes('ordre_du_jour') || v.includes('decisions') || v.includes('prochaines_etapes') || v.includes('services_realises') ? (
                    <Textarea value={variables[v] || ''} onChange={e => setVariables(prev => ({ ...prev, [v]: e.target.value }))} placeholder={v.replace(/_/g, ' ')} className="mt-1" rows={3} />
                  ) : (
                    <Input value={variables[v] || ''} onChange={e => setVariables(prev => ({ ...prev, [v]: e.target.value }))} placeholder={v.replace(/_/g, ' ')} className="mt-1" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button onClick={() => handleGenerate('brouillon')} disabled={generating} className="flex-1" variant="outline">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Enregistrer brouillon
          </Button>
          <Button onClick={() => handleGenerate('emis')} disabled={generating} className="flex-1">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Générer et émettre
          </Button>
        </div>
      </div>

      {/* Panneau droit — Aperçu */}
      <Card className="sticky top-20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Aperçu du courrier</CardTitle>
            {preview && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(preview); toast.success('Copié !'); }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {preview ? (
            <div className="bg-white border rounded-lg p-6 min-h-[400px] text-sm leading-relaxed whitespace-pre-line font-serif text-gray-800">
              {preview}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sélectionnez un modèle pour voir l'aperçu</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// — Historique des correspondances
function CorrespondenceHistory() {
  const [correspondences, setCorrespondences] = useState<Correspondence[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Correspondence | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchCorrespondences = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const res = await fetch(`/api/correspondence?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCorrespondences(data.correspondences || []);
      }
    } catch {} finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchCorrespondences(); }, [fetchCorrespondences]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(statusColors).map(([k]) => <SelectItem key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : correspondences.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucune correspondance trouvée</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {correspondences.map(c => (
            <Card key={c.id} className="overflow-hidden">
              <button onClick={() => setViewing(viewing?.id === c.id ? null : c)} className="w-full text-left">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{c.reference}</span>
                        <Badge className={`text-[10px] ${statusColors[c.status] || ''}`}>{c.status}</Badge>
                        <Badge variant="outline" className="text-[10px]">{categoryLabels[c.category] || c.category}</Badge>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{c.subject}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {c.companyName && <span>{c.companyName}</span>}
                        {c.partnerName && <span>→ {c.partnerName}</span>}
                        <span>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                  </div>
                </CardContent>
              </button>
              {viewing?.id === c.id && (
                <div className="px-4 pb-4 border-t">
                  <div className="bg-white border rounded-lg p-6 mt-3 text-sm leading-relaxed whitespace-pre-line font-serif text-gray-800">
                    {c.body}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
