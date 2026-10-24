'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { environmentFor, gemGeometry, gemMaterial, radialTexture } from '@/lib/gem3d';

/** Full-bleed hero scene: a slowly turning stone that leans toward the pointer. */
export function HeroGem({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f0e0d');
    const env = environmentFor(renderer);
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    // Warm glow behind the stone gives the transmission something to refract
    const glowTex = radialTexture('#5e4c37', '#0f0e0d');
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: glowTex, toneMapped: false }));
    glow.position.z = -3;
    scene.add(glow);
    for (const [x, y, z, c] of [[3, 4, 4, 0xfff1d6], [-4, 2, 3, 0xffffff], [0, -3, 2, 0xb8976a]]) {
      const l = new THREE.PointLight(c, 40);
      l.position.set(x, y, z);
      scene.add(l);
    }
    const gem = new THREE.Mesh(gemGeometry(), gemMaterial(color));
    const pivot = new THREE.Group();
    pivot.add(gem);
    scene.add(pivot);
    gem.rotation.x = 0.55;

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      pivot.scale.setScalar(w < 900 ? 0.8 : 1);
      pivot.position.set(w < 900 ? 0 : 0.9, w < 900 ? 0.7 : 0.55, 0);
    };
    addEventListener('resize', resize);
    resize();

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mx = 0, my = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    addEventListener('pointermove', onMove);

    const clock = new THREE.Clock();
    let frame = 0;
    const loop = () => {
      const t = still ? 0 : clock.getElapsedTime(), sy = Math.min(scrollY / innerHeight, 1.2);
      gem.rotation.y = 0.6 + t * 0.25;
      pivot.rotation.x += (my * 0.35 - pivot.rotation.x) * 0.04;
      pivot.rotation.z += (-mx * 0.25 - pivot.rotation.z) * 0.04;
      camera.position.y = -sy * 1.6;
      if (sy < 1.1) renderer.render(scene, camera); // stop drawing once scrolled away
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      gem.geometry.dispose();
      gem.material.dispose();
      glowTex.dispose();
      env.dispose();
      renderer.dispose();
    };
  }, [color]);

  return <canvas ref={ref} id="gl" aria-hidden="true" />;
}
