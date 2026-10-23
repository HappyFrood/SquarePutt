'use client';

import React, { useEffect, useRef } from 'react';
import { GreenSurface, Vec2 } from '@/lib/green';
import { CameraMode, PuttingShotData } from '@/lib/types';
import { audioEngine } from '@/components/ui/AudioEngine';
import { GreenScene, MarkerSpec, RingSpec, SceneOverlays } from './greenScene';

interface Props {
  surface: GreenSurface;
  ball: Vec2;
  holeRadiusMultiplier: number;
  shot: PuttingShotData | null;
  cameraMode: CameraMode;
  overlays: SceneOverlays;
  idealSamples: [number, number, number][] | null;
  rings: RingSpec[];
  markers: MarkerSpec[];
  outline: { anchor?: Vec2; radiusM?: number };
  /** Increment to put the ball back on its spot after a putt. */
  resetKey: number;
  onRollComplete: () => void;
}

export function PuttingGreenCanvas({
  surface,
  ball,
  holeRadiusMultiplier,
  shot,
  cameraMode,
  overlays,
  idealSamples,
  rings,
  markers,
  outline,
  resetKey,
  onRollComplete,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GreenScene | null>(null);
  const firstLayout = useRef(true);
  const onCompleteRef = useRef(onRollComplete);
  useEffect(() => {
    onCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  useEffect(() => {
    if (!hostRef.current) return;
    const scene = new GreenScene(hostRef.current);
    scene.setCallbacks({
      onStrike: () => audioEngine.playPutterStrike(),
      onCupDrop: () => audioEngine.playCupDrop(),
      onLipOut: () => audioEngine.playLipOut(),
      onRollComplete: () => onCompleteRef.current(),
    });
    sceneRef.current = scene;
    (window as unknown as { __spScene?: GreenScene }).__spScene = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
      firstLayout.current = true;
    };
  }, []);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.setGreen(surface, ball, holeRadiusMultiplier, outline);
    if (firstLayout.current) {
      s.snapCamera();
      firstLayout.current = false;
    }
    // ball is compared by value to avoid rebuilding when a new but identical object arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, ball.x, ball.z, holeRadiusMultiplier, outline.anchor?.x, outline.anchor?.z, outline.radiusM]);

  useEffect(() => {
    if (resetKey > 0) sceneRef.current?.resetBall();
  }, [resetKey]);

  useEffect(() => {
    sceneRef.current?.setOverlays(overlays);
  }, [overlays]);

  useEffect(() => {
    sceneRef.current?.setCameraMode(cameraMode);
  }, [cameraMode]);

  useEffect(() => {
    sceneRef.current?.setIdealLine(idealSamples);
  }, [idealSamples]);

  useEffect(() => {
    sceneRef.current?.setRings(rings);
  }, [rings, surface, ball.x, ball.z, holeRadiusMultiplier]);

  useEffect(() => {
    sceneRef.current?.setMarkers(markers);
  }, [markers, surface]);

  useEffect(() => {
    if (!shot?.trajectoryPoints?.length) return;
    sceneRef.current?.playPutt(shot.trajectoryPoints, shot.trajectoryDt ?? 1 / 60, shot.isHoled, shot.lipOut);
  }, [shot]);

  return (
    <div
      ref={hostRef}
      className={`absolute inset-0 ${cameraMode === 'orbit' ? 'cursor-grab active:cursor-grabbing' : ''}`}
    />
  );
}
