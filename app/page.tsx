'use client';
import dynamic from 'next/dynamic';

const MobileWarRoom = dynamic(() => import('./mobile-war-room'), { ssr: false, loading: () => null });
const DesktopWarRoom = dynamic(() => import('./desktop-war-room'), { ssr: false, loading: () => null });

export default function Home() {
  return (
    <>
      <div className="mobile-only"><MobileWarRoom /></div>
      <div className="desktop-only"><DesktopWarRoom /></div>
    </>
  );
}