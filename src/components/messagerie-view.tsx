'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  MessageCircle, Plus, Search, Send, Lock, Users, FileText,
  ChevronLeft, Clock, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

interface Conversation {
  id: string; title: string; type: string; taskId: string | null;
  serviceId: string | null; myRole: string; lastMessage: string | null;
  lastMessageAt: string | null; lastMessageType: string | null;
  lastSenderName: string | null; unreadCount: number; createdAt: string;
}

interface Message {
  id: string; conversationId: string; senderId: string; content: string;
  type: string; isRead: boolean; createdAt: string;
  senderName: string | null; senderEmail: string | null; senderRole: string | null;
}

export function MessagerieView() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'client';
  const userName = (session?.user as any)?.name || 'Utilisateur';
  const userEmail = session?.user?.email || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [noteMode, setNoteMode] = useState(false);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('dossier');
  const [mobileDetail, setMobileDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const load = async () => { setLoading(true); await fetchConversations(); setLoading(false); };
    load();
  }, [fetchConversations]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchConversations();
      if (selectedId) fetchMessages(selectedId);
    }, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchConversations, fetchMessages, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedId && conversations.length > 0 && !mobileDetail) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId, mobileDetail]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
      fetch('/api/messages/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId }),
      });
    }
  }, [selectedId, fetchMessages]);

  const handleSelect = (id: string) => { setSelectedId(id); setMobileDetail(true); };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, content: newMessage.trim(), type: noteMode ? 'note_interne' : 'text' }),
      });
      if (res.ok) {
        setNewMessage(''); setNoteMode(false);
        await fetchMessages(selectedId);
        await fetchConversations();
      } else { toast.error("Erreur d'envoi"); }
    } catch { toast.error('Erreur reseau'); }
    setSending(false);
  };

  const resetNewConv = () => { setNewTitle(''); setNewType('dossier'); setCreating(false); };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error('Veuillez saisir un titre');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), type: newType }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Conversation creee');
        setShowNew(false);
        resetNewConv();
        setSelectedId(data.conversation.id);
        await fetchConversations();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erreur lors de la creation");
      }
    } catch { toast.error('Erreur reseau'); }
    setCreating(false);
  };

  const selected = conversations.find(c => c.id === selectedId);
  const filtered = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
    if (diffH < 1) return "A l'instant";
    if (diffH < 24) return `Il y a ${diffH}h`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const formatFullTime = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getTypeColor = (type: string) => {
    if (type === 'dossier') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (type === 'interne') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Messagerie interne</h3>
            <p className="text-xs text-muted-foreground">{conversations.length} conversation{conversations.length > 1 ? 's' : ''}{totalUnread > 0 ? ` - ${totalUnread} non lu${totalUnread > 1 ? 's' : ''}` : ''}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nouvelle
        </Button>
      </div>

      <div className="flex-1 flex rounded-xl border bg-card overflow-hidden min-h-0">
        <div className={`${mobileDetail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r`}>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{search ? 'Aucun resultat' : 'Aucune conversation'}</p>
                <p className="text-xs text-muted-foreground mt-1">Cliquez sur Nouvelle pour commencer</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filtered.map(conv => (
                  <button key={conv.id} onClick={() => handleSelect(conv.id)} className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${selectedId === conv.id ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'}`}>
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{getInitials(conv.title)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium truncate ${conv.unreadCount > 0 ? 'font-bold' : ''}`}>{conv.title || 'Sans titre'}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.lastMessageAt as string)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getTypeColor(conv.type)}`}>{conv.type === 'dossier' ? 'Dossier' : conv.type === 'interne' ? 'Interne' : 'Service'}</Badge>
                        {conv.unreadCount > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{conv.unreadCount}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {conv.lastSenderName && <span className="font-medium">{conv.lastSenderName}: </span>}
                        {conv.lastMessageType === 'note_interne' ? <span className="italic">(Note interne)</span> : (conv.lastMessage || '')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className={`${mobileDetail ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {selected ? (
            <>
              <div className="flex items-center gap-3 p-3 border-b">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileDetail(false)}><ChevronLeft className="w-4 h-4" /></Button>
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{getInitials(selected.title)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selected.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getTypeColor(selected.type)}`}>{selected.type === 'dossier' ? 'Dossier' : selected.type === 'interne' ? 'Interne' : 'Service'}</Badge>
                    {selected.taskId && <span className="text-[10px] text-muted-foreground">Dossier: {selected.taskId.slice(0, 8)}...</span>}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-2xl mx-auto">
                  {messages.map((msg, i) => {
                    const isMe = msg.senderEmail === userEmail;
                    const isSystem = msg.type === 'system';
                    const isNote = msg.type === 'note_interne';
                    const showAvatar = !isMe && !isSystem && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <span className="text-[11px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">{msg.content}</span>
                        </div>
                      );
                    }

                    if (isNote) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 max-w-lg">
                            <div className="flex items-center gap-1.5 mb-1">
                              <EyeOff className="w-3 h-3 text-amber-600" />
                              <span className="text-[10px] font-semibold text-amber-700">Note interne</span>
                              <span className="text-[10px] text-amber-600">- {msg.senderName}</span>
                            </div>
                            <p className="text-sm text-amber-900">{msg.content}</p>
                            <p className="text-[10px] text-amber-500 mt-1">{formatFullTime(msg.createdAt)}</p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <Avatar className={`w-8 h-8 shrink-0 mt-1 ${!showAvatar ? 'invisible' : ''}`}>
                            <AvatarFallback className="text-[10px] bg-muted">{getInitials(msg.senderName)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                          {showAvatar && !isMe && (
                            <p className="text-[10px] font-medium text-muted-foreground mb-1 ml-1">
                              {msg.senderName || 'Utilisateur'}
                              {msg.senderRole === 'admin' && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Admin</Badge>}
                            </p>
                          )}
                          <div className={`rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <p className={`text-[10px] text-muted-foreground mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>{formatFullTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">Aucun message</p>
                      <p className="text-xs text-muted-foreground mt-1">Envoyez le premier message</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t p-3">
                {noteMode && userRole === 'admin' && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs text-amber-700 font-medium">Mode note interne (invisible pour le client)</span>
                    <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => setNoteMode(false)}>Annuler</Button>
                  </div>
                )}
                <div className="flex gap-2 max-w-2xl mx-auto">
                  {userRole === 'admin' && !noteMode && (
                    <Button variant="outline" size="icon" className="shrink-0 h-10 w-10" onClick={() => setNoteMode(true)} title="Note interne">
                      <EyeOff className="w-4 h-4" />
                    </Button>
                  )}
                  <Input placeholder={noteMode ? 'Note interne...' : 'Ecrire un message...'} className="flex-1 h-10" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                  <Button size="icon" className="shrink-0 h-10 w-10" onClick={handleSend} disabled={!newMessage.trim() || sending}>
                    <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Selectionnez une conversation</p>
                <p className="text-xs text-muted-foreground mt-1">ou creez-en une nouvelle</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={(open) => { if (!open) resetNewConv(); setShowNew(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Titre</label>
              <Input placeholder="Ex: Suivi dossier CNSS Dupont" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'dossier', label: 'Dossier', icon: <FileText className="w-4 h-4" />, desc: 'Lie a un dossier' },
                  { value: 'interne', label: 'Interne', icon: <Lock className="w-4 h-4" />, desc: 'Equipe uniquement' },
                  { value: 'service', label: 'Service', icon: <Users className="w-4 h-4" />, desc: 'Service specifique' },
                ].map(t => (
                  <button key={t.value} onClick={() => setNewType(t.value)} className={`p-3 rounded-lg border text-left transition-colors ${newType === t.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                    <div className="flex items-center gap-2 mb-1">{t.icon}<span className="text-sm font-medium">{t.label}</span></div>
                    <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creation...' : 'Creer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
