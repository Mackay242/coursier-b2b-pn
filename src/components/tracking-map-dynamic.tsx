'use client';

import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('./tracking-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] rounded-xl bg-muted/30 flex items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        </div>
        <p className="text-sm text-muted-foreground">Chargement de la carte...</p>
      </div>
    </div>
  ),
});

export default TrackingMap;
