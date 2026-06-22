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
  /** Bump to force a rebuild + re-fit (e.g. a "recenter" button). */
  fitNonce?: number;
}

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
  fitNonce = 0,
}: FamilyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

      // Apply each person's avatar focal point (object-position) to their card
      // image after every render — family-chart only supports object-fit: cover.
      const focals = new Map(
        data
          .filter((d) => d.data.avatar)
          .map((d) => [
            d.id,
            `${d.data.focusX ?? 50}% ${d.data.focusY ?? 50}%`,
          ]),
      );
      const applyFocals = () => {
        cont.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
          const id = img.closest<HTMLElement>("[data-id]")?.dataset.id;
          const pos = id ? focals.get(id) : undefined;
          if (pos) img.style.objectPosition = pos;
        });
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chart as any).afterUpdate = applyFocals;

      // `tree_position: "fit"` works around upstream issue #88 (tree not filling
      // the container on first render).
      chart.updateTree({ initial: true, tree_position: "fit" });
      applyFocals();
    } catch (err) {
      console.error("Failed to render family chart:", err);
      cont.innerHTML =
        '<div class="flex h-full items-center justify-center p-6 text-center text-muted-foreground">Could not draw the tree. Try refreshing.</div>';
    }

    return () => {
      cont.innerHTML = "";
    };
  }, [data, onSelect, orientation, showSiblings, fitNonce]);

  return (
    <div
      ref={containerRef}
      className="f3 h-[70vh] min-h-[420px] w-full rounded-lg border border-border bg-card"
      aria-label="Family tree chart"
      role="img"
    />
  );
}
