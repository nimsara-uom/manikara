'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { environmentFor, gemGeometry, gemMaterial, radialTexture } from '@/lib/gem3d';

/** Interactive turntable of the stone in its recorded colour. Drag to turn. */
export function GemViewer({ colorHex, label, bg = '#e9e3d8' }: { colorHex: string; label: string; bg?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    const env = environmentFor(renderer);
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.6, 6.2);
    camera.lookAt(0, -0.15, 0);

    const gem = new THREE.Mesh(gemGeometry(), gemMaterial(colorHex));
    gem.rotation.set(0.18, 0.4, 0.06);
    scene.add(gem);
    for (const [x, y, z] of [[3, 4, 4], [-3, 3, 2]]) {
      const l = new THREE.PointLight(0xffffff, 30);
      l.position.set(x, y, z);
      scene.add(l);
    }
    const shadowTex = radialTexture('rgba(40,30,20,.22)', 'rgba(40,30,20,0)');
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.98;
    scene.add(shadow);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dragging = false, lastX = 0, lastY = 0;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      gem.rotation.y += (e.clientX - lastX) * 0.01;
      gem.rotation.x = Math.max(-0.8, Math.min(0.9, gem.rotation.x + (e.clientY - lastY) * 0.01));
      lastX = e.clientX; lastY = e.clientY;
    };
    const up = () => { dragging = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    let frame = 0;
    const tick = () => {
      if (!dragging && !still) gem.rotation.y += 0.004;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      gem.geometry.dispose();
      gem.material.dispose();
      shadowTex.dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [colorHex, bg]);

  return (
    <div ref={host} role="img" aria-label={`3D model of ${label}`}
      style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }} />
  );
}
