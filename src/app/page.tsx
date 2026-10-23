'use client';

import dynamic from 'next/dynamic';

// The app reads localStorage and uses WebGL, so it renders on the client only.
const App = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => <div className="grid h-screen place-items-center text-mist">Loading the green…</div>,
});

export default function Home() {
  return <App />;
}
