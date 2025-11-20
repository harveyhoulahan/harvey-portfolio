"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface FlowingBackgroundProps {
  variant?: 'subtle' | 'medium' | 'strong';
}

export default function FlowingBackground({ variant = 'subtle' }: FlowingBackgroundProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Determine intensity based on page and variant
  const isHomepage = pathname === '/';
  const intensity = variant === 'strong' ? 0.15 : variant === 'medium' ? 0.08 : 0.04;
  const animationSpeed = variant === 'strong' ? 20 : variant === 'medium' ? 30 : 40;

  return (
    <>
      {/* Animated gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        {/* Main red orb */}
        <div 
          className="absolute rounded-full blur-3xl animate-float-slow"
          style={{
            width: '600px',
            height: '600px',
            background: `radial-gradient(circle, rgba(220, 38, 38, ${intensity * 2}) 0%, transparent 70%)`,
            top: '10%',
            right: '10%',
            animationDuration: `${animationSpeed}s`,
            animationDelay: '0s',
          }}
        />
        
        {/* Secondary red orb */}
        <div 
          className="absolute rounded-full blur-3xl animate-float-slow"
          style={{
            width: '500px',
            height: '500px',
            background: `radial-gradient(circle, rgba(239, 68, 68, ${intensity}) 0%, transparent 70%)`,
            bottom: '20%',
            left: '5%',
            animationDuration: `${animationSpeed + 5}s`,
            animationDelay: '2s',
          }}
        />

        {/* Accent orb - darker red */}
        <div 
          className="absolute rounded-full blur-3xl animate-float-slow"
          style={{
            width: '400px',
            height: '400px',
            background: `radial-gradient(circle, rgba(185, 28, 28, ${intensity * 1.5}) 0%, transparent 70%)`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animationDuration: `${animationSpeed + 10}s`,
            animationDelay: '4s',
          }}
        />

        {/* Small accent orbs */}
        <div 
          className="absolute rounded-full blur-2xl animate-float-slow"
          style={{
            width: '300px',
            height: '300px',
            background: `radial-gradient(circle, rgba(252, 165, 165, ${intensity * 0.8}) 0%, transparent 70%)`,
            top: '70%',
            right: '30%',
            animationDuration: `${animationSpeed - 5}s`,
            animationDelay: '1s',
          }}
        />
      </div>

      {/* Flowing grid pattern */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{ 
          zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(220, 38, 38, ${intensity * 0.4}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(220, 38, 38, ${intensity * 0.4}) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          maskImage: 'radial-gradient(ellipse 80% 50% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 50%, black 40%, transparent 100%)',
        }}
      />

      {/* Noise texture overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          zIndex: 1,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
        }}
      />

      {/* Vignette effect */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(0, 0, 0, 0.4) 100%)',
        }}
      />
    </>
  );
}
