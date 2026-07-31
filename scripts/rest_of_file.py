with open('src/app/page.tsx', 'w') as f:
    f.write('  if (status === \'loading") {
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
    dashboard: <DashboardView key={deliveryRefreshKey} companyName={companyName} planLabel={planLabel} companyData={null} onRefreshDeliveries={refreshDeliveries} />,
    commander: <CommanderView />,
    suivi: <SuiviView />,
    facturation: <FacturationView />,
    forfaits: <ForfaitsView />,
    livreurs: <LivreursView />,
    parametres: <ParametresView />,
    dispatch: <DispatchView />,
    mes_courses: <MesCoursesView />,
    rapports: <RapportsView />,
    paiement: <PaiementView />,
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
    mes_courses: 'Mes courses',
    rapports: 'Rapports',
    paiement: 'Paiement',
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar current={currentView} onNavigate={setCurrentView} open={sidebarOpen} onClose={() => setSidebarOpen(false)} companyName={companyName} planLabel={planLabel} userRole={userRole} pendingCount={pendingCount} />

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
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative" onClick={() => setNotifOpen(!notifOpen)}>
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
          </div>

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
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
