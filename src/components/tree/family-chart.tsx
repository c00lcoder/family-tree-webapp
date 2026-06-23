"use client";

import { useEffect, useRef } from "react";
import f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import type { FamilyChartDatum } from "@/lib/gedcom/to-family-chart";

interface FamilyChartProps {
  data: FamilyChartDatum[];
  onSelect?: (id: string) => void;
  orientation?: "vertical" | "horizontal";
  showSiblings?: boolean;
  /** Tint each card by its generation row. */
  showGenerations?: boolean;
  /** Re-center the chart on this person (without a full rebuild). */
  focusId?: string | null;
  /** Bump to force a rebuild + re-fit (e.g. a "recenter" button). */
  fitNonce?: number;
}

// Subtle sepia accents cycled per generation row.
const GENERATION_TINTS = [
  "#8a5a2b",
  "#b98a4e",
  "#6e4b2a",
  "#cf9a5b",
  "#7c5a36",
  "#a9762e",
];

/**
 * Client-only wrapper around the `family-chart` (d3) library. It renders the
 * tree into a container ref and rebuilds when the data changes. Cards are large
 * and tappable; tapping a card calls `onSelect` so the parent can open editing.
 */
export function FamilyChart({
  data,
  onSelect,
  orientation = "vertical",
  showSiblings = false,
  showGenerations = true,
  focusId = null,
  fitNonce = 0,
}: FamilyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);

  // Re-center on a person when picked from the People list (no rebuild).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !focusId) return;
    try {
      chart.updateMainId(focusId);
      chart.updateTree({ tree_position: "main_to_middle" });
    } catch {
      // ignore
    }
  }, [focusId]);

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont || data.length === 0) return;

    cont.innerHTML = "";

    // Guard the whole build: a render error in the upstream library must never
    // leave the chart permanently blank with no recovery.
    try {
      // family-chart accepts the legacy father/mother/spouses/children shape at
      // runtime; cast to satisfy the library's normalized type.
      const chart = f3
        .createChart(
          cont,
          data as unknown as Parameters<typeof f3.createChart>[1],
        )
        .setTransitionTime(600)
        .setCardXSpacing(260)
        .setCardYSpacing(160)
        .setShowSiblingsOfMain(showSiblings);

      if (orientation === "horizontal") chart.setOrientationHorizontal();
      else chart.setOrientationVertical();

      chart
        .setCardHtml()
        .setCardDisplay([["first name", "last name"], []])
        .setStyle("imageRect")
        .setMiniTree(true)
        .setOnHoverPathToMain()
        .setOnCardClick((_e: unknown, d: { data: { id: string } }) => {
          const id = d?.data?.id;
          if (id) onSelect?.(id);
          chart.updateMainId(id);
          chart.updateTree();
        });

      // After every render: (1) apply each person's avatar focal point
      // (family-chart only does object-fit: cover) and (2) accent each card by
      // its generation row. Wrapped so a DOM-shape change upstream can never
      // break the chart — it just skips the cosmetic pass.
      const focals = new Map(
        data
          .filter((d) => d.data.avatar)
          .map((d) => [
            d.id,
            `${d.data.focusX ?? 50}% ${d.data.focusY ?? 50}%`,
          ]),
      );
      const applyOverlays = () => {
        try {
          // One card element per person id.
          const seen = new Set<string>();
          const cards: HTMLElement[] = [];
          cont
            .querySelectorAll<HTMLElement>("[data-id]")
            .forEach((el) => {
              const id = el.dataset.id;
              if (!id || seen.has(id)) return;
              seen.add(id);
              cards.push(el);
            });

          // Avatar focal points.
          for (const el of cards) {
            const pos = focals.get(el.dataset.id!);
            if (pos) {
              const img = el.querySelector("img");
              if (img) (img as HTMLImageElement).style.objectPosition = pos;
            }
          }

          // Generation rows: cluster cards by rendered vertical position.
          for (const el of cards) el.style.boxShadow = "";
          if (showGenerations && cards.length) {
            const withTop = cards
              .map((el) => ({ el, top: el.getBoundingClientRect().top }))
              .sort((a, b) => a.top - b.top);
            let row = -1;
            let lastTop = -Infinity;
            for (const { el, top } of withTop) {
              if (top - lastTop > 24) {
                row += 1;
                lastTop = top;
              }
              const tint = GENERATION_TINTS[row % GENERATION_TINTS.length];
              el.style.boxShadow = `inset 0 6px 0 0 ${tint}`;
            }
          }
        } catch {
          // Cosmetic only — ignore.
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chart as any).afterUpdate = applyOverlays;
      chartRef.current = chart;
      if (focusId) chart.updateMainId(focusId);

      // `tree_position: "fit"` works around upstream issue #88 (tree not filling
      // the container on first render).
      chart.updateTree({ initial: true, tree_position: "fit" });
      applyOverlays();
    } catch (err) {
      console.error("Failed to render family chart:", err);
      cont.innerHTML =
        '<div class="flex h-full items-center justify-center p-6 text-center text-muted-foreground">Could not draw the tree. Try refreshing.</div>';
    }

    return () => {
      chartRef.current = null;
      cont.innerHTML = "";
    };
    // focusId is handled by its own effect (no rebuild), so it's excluded here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, onSelect, orientation, showSiblings, showGenerations, fitNonce]);

  return (
    <div
      ref={containerRef}
      className="f3 h-[70vh] min-h-[420px] w-full rounded-lg border border-border bg-card"
      aria-label="Family tree chart"
      role="img"
    />
  );
}
