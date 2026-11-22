import React, { useEffect, useRef } from 'react';

export const GoldenSeedsCanvas: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return;
    }

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 40 procedural floating seeds
    const particleCount = 40;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.8 + 1.2,
      speedX: (Math.random() - 0.4) * 0.4 + 0.15,
      speedY: -Math.random() * 0.45 - 0.1,
      opacity: Math.random() * 0.5 + 0.3,
      oscillation: Math.random() * Math.PI * 2,
      oscillationSpeed: Math.random() * 0.02 + 0.01,
    }));

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // 1. Soft Morning Sun Godrays (radiating from top-left)
      const sunX = width * 0.15;
      const sunY = height * 0.08;
      const rayGradient = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, Math.max(width, height) * 0.85);
      rayGradient.addColorStop(0, 'rgba(255, 235, 175, 0.22)');
      rayGradient.addColorStop(0.35, 'rgba(255, 215, 120, 0.08)');
      rayGradient.addColorStop(0.7, 'rgba(16, 185, 129, 0.03)');
      rayGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = rayGradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Render 40 floating golden seed particles
      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        p.oscillation += p.oscillationSpeed;
        p.x += p.speedX + Math.sin(p.oscillation) * 0.35;
        p.y += p.speedY;

        // Wrap around screen boundaries
        if (p.y < -10) p.y = height + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.x < -10) p.x = width + 10;

        const pulseOpacity = p.opacity * (0.8 + 0.2 * Math.sin(time * 2 + i));

        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(254, 240, 138, ${pulseOpacity * 0.35})`;
        ctx.fill();

        // Seed Core (Golden Sprout Speck)
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.65, Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 251, 235, ${pulseOpacity})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-1 ${className}`}
      aria-hidden="true"
    />
  );
};
