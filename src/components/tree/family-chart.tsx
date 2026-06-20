"use client";

import { useEffect, useRef } from "react";
import f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import type { FamilyChartDatum } from "@/lib/gedcom/to-family-chart";

interface FamilyChartProps {
  data: FamilyChartDatum[];
  onSelect?: (id: string) => void;
}

/**
 * Client-only wrapper around the `family-chart` (d3) library. It renders the
 * tree into a container ref and rebuilds when the data changes. Cards are large
 * and tappable; tapping a card calls `onSelect` so the parent can open editing.
 */
export function FamilyChart({ data, onSelect }: FamilyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont || data.length === 0) return;

    cont.innerHTML = "";

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
      .setOrientationVertical();

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

    chart.updateTree({ initial: true });

    return () => {
      cont.innerHTML = "";
    };
  }, [data, onSelect]);

  return (
    <div
      ref={containerRef}
      className="f3 h-[70vh] min-h-[420px] w-full rounded-lg border border-border bg-card"
      aria-label="Family tree chart"
      role="img"
    />
  );
}
