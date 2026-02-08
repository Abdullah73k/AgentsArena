/**
 * Top-down 2D map showing bot positions in the Minecraft world.
 *
 * Uses requestAnimationFrame for smooth rendering instead of
 * re-painting on every React render cycle.
 */

import { useRef, useEffect, useCallback, memo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { RiMapLine } from "@remixicon/react";
import type { BotState } from "@/types/bot";

const BOT_COLORS = [
  "#14b8a6", // primary teal
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
];

function MinecraftWorldMapInner({ bots }: { bots: Map<string, BotState> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const botsRef = useRef<Map<string, BotState>>(bots);
  const rafRef = useRef<number>(0);

  // Keep bots ref in sync without triggering re-renders
  botsRef.current = bots;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Only resize if dimensions changed
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const botsArray = Array.from(botsRef.current.values());
    if (botsArray.length === 0) return;

    // Calculate bounds for centering
    const positions = botsArray
      .filter((b) => b.position)
      .map((b) => b.position!);

    if (positions.length === 0) return;

    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minZ = Math.min(...positions.map((p) => p.z));
    const maxZ = Math.max(...positions.map((p) => p.z));

    const rangeX = Math.max(maxX - minX, 20);
    const rangeZ = Math.max(maxZ - minZ, 20);
    const scale = Math.min((w - 60) / rangeX, (h - 60) / rangeZ);
    const centerX = w / 2;
    const centerZ = h / 2;
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    // Draw bots
    botsArray.forEach((bot, i) => {
      if (!bot.position) return;

      const sx = centerX + (bot.position.x - midX) * scale;
      const sy = centerZ + (bot.position.z - midZ) * scale;
      const color = BOT_COLORS[i % BOT_COLORS.length];

      // Glow
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = color + "30";
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "10px 'Geist Variable', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(bot.username, sx, sy - 12);

      // Coords
      ctx.fillStyle = "#888";
      ctx.font = "8px 'Geist Variable', sans-serif";
      ctx.fillText(
        `${Math.round(bot.position.x)}, ${Math.round(bot.position.z)}`,
        sx,
        sy + 16
      );
    });
  }, []);

  useEffect(() => {
    let running = true;

    function loop() {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  const botsArray = Array.from(bots.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiMapLine className="size-4 text-primary" />
          World Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        {botsArray.length === 0 ? (
          <EmptyState
            icon={RiMapLine}
            title="No bots connected"
            description="Bot positions will appear here when the test starts"
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="h-[240px] w-full rounded-none"
            aria-label={`Minecraft world map showing ${botsArray.length} bot positions`}
          />
        )}
      </CardContent>
    </Card>
  );
}

const MinecraftWorldMap = memo(MinecraftWorldMapInner);

export { MinecraftWorldMap };
