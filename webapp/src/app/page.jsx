"use client";
import React, { useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Upload,
  Filter,
  RefreshCw,
  Bug,
  AlertTriangle,
  Settings,
  X,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// =============================
// Utilidades
// =============================
const parseNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  s = s.replace(/%/g, "").replace(/\s/g, "");
  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;
  if (commaCount > 0 && dotCount === 0) s = s.replace(/,/g, ".");
  if (/\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(String(v))) s = s.replace(/\./g, "");
  const n = Number(s.replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
};

const normalizeHeader = (h) => {
  if (!h) return null;
  const k = String(h).toLowerCase().trim();
  const map = new Map([
    ["n. producto", "nproducto"],
    ["n producto", "nproducto"],
    ["nº producto", "nproducto"],
    ["producto", "nproducto"],
    ["nombre producto", "nombre"],
    ["tpv id", "tpvid"],
    ["tpvid", "tpvid"],
    ["coste", "coste"],
    ["precio vent", "precio"],
    ["precio venta", "precio"],
    ["precio", "precio"],
    ["cos %", "cos"],
    ["cos%", "cos"],
    ["qty sold", "qty"],
    ["qty", "qty"],
    ["unidades", "qty"],
  ]);
  return map.get(k) || null;
};

const fmt0 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct0 = (v) => `${fmt0.format(v)}%`;
const pct1 = (v) => `${fmt1.format(v)}%`;

const clamp = (v, min, max) => (Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min);

// =============================
// Componente principal
// =============================
export default function BCGWebApp() {
  const [rows, setRows] = useState([]);
  const [productQuery, setProductQuery] = useState("");
  const [sizeMetric, setSizeMetric] = useState("revenue");
  const [shareBasis, setShareBasis] = useState("revenue");

  const [showSettings, setShowSettings] = useState(false);
  const [cosThreshold, setCosThreshold] = useState(25);
  const [topRevenuePct, setTopRevenuePct] = useState(25);
  const [starCosGuard, setStarCosGuard] = useState(true);

  const [useLogX, setUseLogX] = useState(false);
  const [skippedInfo, setSkippedInfo] = useState({ total: 0, byReason: {} });
  const [lastLoadNote, setLastLoadNote] = useState("");
  const [hovered, setHovered] = useState(null);
  const [sortBy, setSortBy] = useState("revenue"); // revenue|qty|price|cost|cos|share|name
  const [sortDir, setSortDir] = useState("desc");
  const [brandName, setBrandName] = useState("Nobu Ibiza Bay");

  const fileInputRef = useRef(null);
  const [uploadKey, setUploadKey] = useState(0);

  const changeSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const handleFile = async (file) => {
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { cellDates: true });
      const ws = wb.Sheets["DatosVentas"] || wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("No se encontró ninguna hoja en el archivo.");

      const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!rowsRaw.length) throw new Error("La hoja está vacía.");
      const header = rowsRaw[0];

      const idx = {};
      header.forEach((h, i) => {
        const key = normalizeHeader(h);
        if (key && !(key in idx)) idx[key] = i;
      });
      const required = ["nproducto", "nombre", "coste", "precio", "qty"];
      const missing = required.filter((k) => !(k in idx));
      if (missing.length) {
        setRows([]);
        setSkippedInfo({ total: 0, byReason: {} });
        setLastLoadNote(`Faltan columnas obligatorias: ${missing.join(", ")}.`);
        return;
      }

      let skipped = 0;
      const byReason = { camposRequeridos: 0 };

      const parsed = rowsRaw
        .slice(1)
        .map((arr, rIndex) => ({
          NProducto: String(arr[idx["nproducto"]] ?? "").trim(),
          Nombre: String(arr[idx["nombre"]] ?? "").trim(),
          TPVid: idx["tpvid"] != null ? String(arr[idx["tpvid"]] ?? "").trim() : "",
          Coste: parseNumber(arr[idx["coste"]]),
          Precio: parseNumber(arr[idx["precio"]]),
          CoS: idx["cos"] != null ? parseNumber(arr[idx["cos"]]) : null,
          Qty: parseNumber(arr[idx["qty"]]) ?? 0,
          __row: rIndex + 2,
        }))
        .filter((r) => {
          const ok = r.NProducto && r.Nombre && r.Precio != null && r.Coste != null;
          if (!ok) {
            skipped++;
            byReason.camposRequeridos++;
          }
          return ok;
        });

      if (!parsed.length) {
        setRows([]);
        setSkippedInfo({ total: skipped, byReason });
        setLastLoadNote("No se pudo cargar ninguna fila.");
        return;
      }

      const byProd = new Map();
      for (const r of parsed) {
        const k = r.NProducto;
        if (!byProd.has(k)) byProd.set(k, { ...r });
        else {
          const g = byProd.get(k);
          g.Qty += r.Qty;
          g.Precio = r.Precio ?? g.Precio;
          g.Coste = r.Coste ?? g.Coste;
        }
      }

      setRows(Array.from(byProd.values()));
      setSkippedInfo({ total: skipped, byReason });
      setLastLoadNote(`${byProd.size} productos cargados.`);
    } catch (err) {
      console.error(err);
      alert("No se pudo leer el Excel. Revisa las cabeceras o usa la plantilla.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadKey((k) => k + 1);
    }
  };

  // =============================
  // Datos derivados para el gráfico
  // =============================
  const bcgData = useMemo(() => {
    if (!rows?.length) return [];

    const totalUnits = rows.reduce((acc, r) => acc + (r.Qty || 0), 0) || 1;
    const totalRevenue = rows.reduce((acc, r) => acc + ((r.Precio || 0) * (r.Qty || 0)), 0) || 1;

    return rows
      .map((r) => {
        const revenue = (r.Precio || 0) * (r.Qty || 0);
        const share = shareBasis === "units" ? (r.Qty || 0) / totalUnits : revenue / totalRevenue;
        const markupRaw = r.Precio > 0 ? (r.Coste / r.Precio) * 100 : 0; // CoS%
        const markup = Math.min(100, markupRaw);
        const size =
          sizeMetric === "margin"
            ? Math.max(0, (r.Precio - r.Coste) * (r.Qty || 0))
            : revenue;
        return {
          key: r.NProducto,
          name: r.Nombre,
          share: Number(share.toFixed(4)),
          markup: Number(markup.toFixed(1)),
          markupRaw: Number(markupRaw.toFixed(1)),
          size,
          revenue,
          qty: r.Qty || 0,
          price: r.Precio || 0,
          cost: r.Coste || 0,
        };
      })
      .sort((a, b) => b.size - a.size);
  }, [rows, sizeMetric, shareBasis]);

  const starKeys = useMemo(() => {
    const candidates = starCosGuard
      ? bcgData.filter((d) => (d.markupRaw ?? d.markup) <= cosThreshold)
      : bcgData;

    const sorted = [...candidates].sort((a, b) => b.revenue - a.revenue);
    const set = new Set();
    let cum = 0;
    const totalRevenue = sorted.reduce((acc, d) => acc + d.revenue, 0) || 1;
    const limit = clamp(topRevenuePct, 0, 100) / 100;

    let i = 0;
    let revCut = null;
    for (; i < sorted.length; i++) {
      const d = sorted[i];
      if (cum / totalRevenue < limit - 1e-9) {
        set.add(d.key);
        cum += d.revenue;
        revCut = d.revenue;
      } else {
        break;
      }
    }
    if (revCut != null) {
      while (i < sorted.length && sorted[i].revenue === revCut) {
        set.add(sorted[i].key);
        i++;
      }
    }
    return set;
  }, [bcgData, topRevenuePct, cosThreshold, starCosGuard]);

  const shareThreshold = useMemo(() => {
    if (!bcgData.length) return 0;
    const shares = bcgData.filter((d) => starKeys.has(d.key)).map((d) => d.share);
    if (!shares.length) return 0;
    return Math.min(...shares);
  }, [bcgData, starKeys]);

  const xDomain = useMemo(() => {
    if (!bcgData.length) return [useLogX ? 0.001 : 0, 1];
    const shares = bcgData.map((d) => d.share).filter((v) => Number.isFinite(v) && v > 0);
    const minAllowed = useLogX ? 0.001 : 0;
    const maxAllowed = 1;
    const minData = shares.length ? Math.min(...shares) : minAllowed;
    const maxData = shares.length ? Math.max(...shares) : 0.1;
    const c = Math.min(Math.max(shareThreshold || (minData + maxData) / 2, minAllowed), maxAllowed);

    if (useLogX) {
      const minEff = Math.max(minAllowed, Math.min(minData, c));
      const maxEff = Math.min(maxAllowed, Math.max(maxData, c));
      const logC = Math.log(c);
      const d = Math.max(logC - Math.log(minEff), Math.log(maxEff) - logC);
      let lower = Math.exp(logC - d);
      let upper = Math.exp(logC + d);
      lower = Math.max(minAllowed, lower);
      upper = Math.min(maxAllowed, upper);
      return [lower, upper];
    } else {
      let half = Math.max(c - minData, maxData - c);
      half = Math.max(half, 0.02); // ancho mínimo
      let lower = c - half;
      let upper = c + half;
      if (lower < minAllowed) {
        const overflow = minAllowed - lower;
        lower = minAllowed;
        upper = Math.min(maxAllowed, upper + overflow);
      }
      if (upper > maxAllowed) {
        const overflow = upper - maxAllowed;
        upper = maxAllowed;
        lower = Math.max(minAllowed, lower - overflow);
      }
      return [lower, upper];
    }
  }, [bcgData, shareThreshold, useLogX]);

  const yDomain = useMemo(() => {
    if (!bcgData.length) return [cosThreshold - 50, cosThreshold + 50];
    const ys = bcgData.map((d) => d.markup).filter((v) => Number.isFinite(v));
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : 100;
    const c = cosThreshold;
    const half = Math.max(c - minY, maxY - c, 10);
    return [c - half, c + half];
  }, [bcgData, cosThreshold]);

  const centers = useMemo(() => {
    const [xMin, xMax] = xDomain;
    const [yMin, yMax] = yDomain;
    const xMid = shareThreshold;
    const yMid = cosThreshold;
    const geoMid = (a, b) => Math.exp((Math.log(Math.max(a, 1e-6)) + Math.log(Math.max(b, 1e-6))) / 2);
    const xLeftMid = useLogX ? geoMid(xMin, xMid) : (xMin + xMid) / 2;
    const xRightMid = useLogX ? geoMid(xMid, xMax) : (xMid + xMax) / 2;
    const yLow = (yMin + yMid) / 2;
    const yHigh = (yMid + yMax) / 2;
    return { xMin, xMax, xMid, xLeftMid, xRightMid, yMid, yLow, yHigh };
  }, [xDomain, yDomain, shareThreshold, cosThreshold, useLogX]);

  const classified = useMemo(() => {
    return bcgData.map((d) => {
      if (starKeys.has(d.key)) return { ...d, cat: "Estrella" };
      const highShare = d.share >= shareThreshold;
      const goodMarkup = (d.markupRaw ?? d.markup) <= cosThreshold;
      const cat = highShare && goodMarkup
        ? "Vaca"
        : !highShare && goodMarkup
        ? "Interrogante"
        : "Perro";
      return { ...d, cat };
    });
  }, [bcgData, shareThreshold, starKeys, cosThreshold]);

  const highlighted = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return classified.filter((d) => d.name.toLowerCase().includes(q));
  }, [classified, productQuery]);

  const downloadCSV = () => {
    const header = [
      "Nombre",
      "CuotaRelativa",
      "Markup%",
      "Tamaño",
      "Facturacion",
      "Unidades",
      "Precio",
      "Coste",
      "Categoria",
    ];
    const lines = [header.join(",")].concat(
      classified.map((d) =>
        [
          `${d.name.replaceAll('"', '""')}`,
          d.share,
          d.markup,
          d.size,
          d.revenue,
          d.qty,
          d.price,
          d.cost,
          d.cat,
        ].join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = bcg_restauracion.csv;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadDemo = () => {
    // "Casos de prueba" incorporados
    const demo = [
      { NProducto: "1001", Nombre: "Black Cod", Coste: 18, Precio: 36, Qty: 260 }, // CoS 50%
      { NProducto: "1002", Nombre: "Sushi Deluxe", Coste: 22, Precio: 20.5, Qty: 200 }, // CoS 107.3% (debe ser Perro si guard activo)
      { NProducto: "1003", Nombre: "Wagyu Gyoza", Coste: 3, Precio: 14, Qty: 320 }, // CoS 21.4%
      { NProducto: "1004", Nombre: "Spicy Edamame", Coste: 1.1, Precio: 7, Qty: 500 }, // CoS 15.7%
      { NProducto: "1005", Nombre: "Mochi", Coste: 1.8, Precio: 6, Qty: 180 }, // CoS 30%
    ];
    setRows(demo);
    setSkippedInfo({ total: 0, byReason: {} });
    setLastLoadNote("Datos de prueba cargados (5 productos).");
  };

  const bcgColors = { Estrella: "#2563eb", Vaca: "#16a34a", Interrogante: "#f59e0b", Perro: "#ef4444" };

  const legendExplanations = useMemo(() => ({
    Estrella: `Productos que conforman el ${fmt1.format(topRevenuePct)}% inicial de la facturación acumulada${starCosGuard ? ` y con CoS ≤ ${fmt1.format(cosThreshold)}%` : ""}.`,
    Vaca: `Alta popularidad y CoS bajo (≤ ${fmt1.format(cosThreshold)}%).`,
    Interrogante: `Baja popularidad y CoS bajo (≤ ${fmt1.format(cosThreshold)}%). Probar promoción/ubicación.`,
    Perro: `CoS alto (> ${fmt1.format(cosThreshold)}%). Candidato a revisar precio/coste o retirar.`,
  }), [cosThreshold, topRevenuePct, starCosGuard]);

  const shareThresholdNowPct = useMemo(() => pct1(shareThreshold * 100), [shareThreshold]);

  const sortedTable = useMemo(() => {
    const data = [...classified];
    const getter = (d) => {
      switch (sortBy) {
        case "qty": return d.qty;
        case "price": return d.price;
        case "cost": return d.cost;
        case "cos": return d.markup; // ordenar por valor de eje para coherencia visual
        case "share": return d.share; // 0-1
        case "name": return d.name?.toLowerCase() || "";
        default: return d.revenue; // revenue
      }
    };
    data.sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      if (typeof va === "string" || typeof vb === "string") {
        return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return data;
  }, [classified, sortBy, sortDir]);

  // =============================
  // Render
  // =============================
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen w-full bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="shadow-md">
            <CardHeader className="relative flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="text-2xl">Matriz BCG – {brandName} (Cuota vs CoS%)</CardTitle>
                <p className="text-sm text-slate-500">
                  Sube tu Excel con cabeceras mínimas: <b>N. Producto, Nombre Producto, Coste, Precio Vent, Qty Sold</b>.
                  La cuota se calcula sobre el <b>total</b> (no sobre el máximo).<br />
                  Eje Y = <b>CoS%</b> = (Coste / Precio) · 100. Umbral ajustable: <b>{fmt1.format(cosThreshold)}%</b>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm">
                  <Upload className="h-4 w-4" />
                  <span>Subir Excel</span>
                  <input
                    key={uploadKey}
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onClick={(e) => { e.currentTarget.value = ""; }}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </label>
                <Button variant="secondary" onClick={loadDemo}>
                  <Bug className="mr-2 h-4 w-4" /> Cargar demo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRows([]);
                    setProductQuery("");
                    setSkippedInfo({ total: 0, byReason: {} });
                    setLastLoadNote("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    setUploadKey((k) => k + 1);
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
                </Button>
                <Button onClick={downloadCSV} disabled={!classified.length}>
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {lastLoadNote && (
                <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  <AlertTriangle className="h-4 w-4" /> {lastLoadNote}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">
                    Buscar plato <span className="text-slate-400">(resalta sin ocultar)</span>
                  </label>
                  <Input
                    placeholder="Nombre contiene..."
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 inline-flex items-center gap-1">
                    Tamaño de burbuja
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-700 cursor-help">i</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-snug">
                        Controla el tamaño de cada burbuja: «Facturación» usa ingresos (Precio×Unidades); «Margen total» usa (Precio−Coste)×Unidades.
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <select
                    className="rounded-xl border px-3 py-2"
                    value={sizeMetric}
                    onChange={(e) => setSizeMetric(e.target.value)}
                  >
                    <option value="revenue">Facturación</option>
                    <option value="margin">Margen total</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 inline-flex items-center gap-1">
                    Cuota basada en
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-700 cursor-help">i</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-snug">
                        Define cómo se calcula la cuota relativa (eje X): «Unidades» usa cantidades vendidas; «Facturación» usa ingresos. La cuota se calcula sobre el total del dataset (no sobre el producto líder).
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <select
                    className="rounded-xl border px-3 py-2"
                    value={shareBasis}
                    onChange={(e) => setShareBasis(e.target.value)}
                  >
                    <option value="units">Unidades</option>
                    <option value="revenue">Facturación</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs font-medium text-slate-600 inline-flex items-center gap-1">
                    <span>Umbral de cuota (derivado de Top % facturación)</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-700 cursor-help">i</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-snug">
                        Línea vertical que separa alta/baja cuota. Se calcula como la cuota mínima de los productos clasificados como Estrella según el Top % de facturación.
                      </TooltipContent>
                    </Tooltip>
                    <span className="ml-2 text-[11px] text-slate-400">(actual: {shareThresholdNowPct})</span>
                  </label>
                  <input
                    className="rounded-xl border px-3 py-2 bg-slate-50 text-slate-600"
                    value={"Derivado de Top % facturación"}
                    disabled
                    readOnly
                  />
                </div>

                <div className="flex items-end gap-3 text-sm text-slate-500">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={useLogX}
                      onChange={(e) => setUseLogX(e.target.checked)}
                    />
                    <span>Escala log en X</span>
                  </label>
                </div>
                <div className="flex items-end text-sm text-slate-500">
                  <Filter className="mr-2 h-4 w-4" />
                  {classified.length ? `${classified.length} platos` : "Sin datos aún"}
                </div>
              </div>

              {skippedInfo.total > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-medium">
                    <Bug className="h-4 w-4" /> Se ignoraron {skippedInfo.total} filas por problemas de datos.
                  </div>
                  <ul className="ml-6 list-disc">
                    {Object.entries(skippedInfo.byReason).map(([k, v]) => (
                      <li key={k}>
                        {k}: {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="h-[520px] w-full rounded-2xl bg-white p-3 shadow">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      scale={useLogX ? "log" : "auto"}
                      dataKey={"share"}
                      name="Cuota Relativa"
                      domain={xDomain}
                      tickFormatter={(v) => pct0(v * 100)}
                      label={{ value: "Cuota de mercado relativa", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis
                      type="number"
                      dataKey={"markup"}
                      name={"CoS %"}
                      domain={yDomain}
                      allowDataOverflow
                      tickFormatter={(v) => pct0(v)}
                      label={{ value: "CoS % (Coste/Precio)", angle: -90, position: "insideLeft" }}
                    />
                    <ZAxis
                      type="number"
                      dataKey="size"
                      range={[60, 1200]}
                      name={sizeMetric === "revenue" ? "Facturación" : "Margen total"}
                    />
                    <RTooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active) return null;
                        const chosen = hovered || (payload && payload[payload.length - 1]?.payload);
                        if (!chosen) return null;
                        return (
                          <div className="rounded-xl border bg-white/95 p-2 text-xs shadow">
                            <div className="mb-1 font-medium">{chosen.name}</div>
                            <div>Cuota relativa: <b>{pct0(chosen.share * 100)}</b></div>
                            <div>CoS: <b>{pct1(chosen.markupRaw ?? chosen.markup)}</b></div>
                            <div>Unidades: <b>{fmt0.format(chosen.qty)}</b></div>
                            <div>Precio: <b>{fmt1.format(chosen.price)}€</b> · Coste: <b>{fmt1.format(chosen.cost)}€</b></div>
                            <div>Facturación: <b>{fmt0.format(chosen.revenue)}€</b></div>
                          </div>
                        );
                      }}
                    />

                    <ReferenceLine x={shareThreshold} stroke="#475569" strokeDasharray="6 6" />
                    <ReferenceLine y={cosThreshold} stroke="#475569" strokeDasharray="6 6" />

                    <ReferenceDot x={centers.xLeftMid} y={centers.yHigh} r={0} isFront label={{ value: "🐶", position: "center", fontSize: 42, opacity: 0.18 }} />
                    <ReferenceDot x={centers.xRightMid} y={centers.yHigh} r={0} isFront label={{ value: "🐄", position: "center", fontSize: 42, opacity: 0.18 }} />
                    <ReferenceDot x={centers.xLeftMid} y={centers.yLow} r={0} isFront label={{ value: "❓", position: "center", fontSize: 42, opacity: 0.18 }} />
                    <ReferenceDot x={centers.xRightMid} y={centers.yLow} r={0} isFront label={{ value: "⭐", position: "center", fontSize: 42, opacity: 0.18 }} />

                    {Object.entries({ Estrella: "#2563eb", Interrogante: "#f59e0b", Perro: "#ef4444", Vaca: "#16a34a" }).map(
                      ([cat, color]) => (
                        <Scatter
                          key={cat}
                          name={cat}
                          data={classified.filter((d) => d.cat === cat)}
                          fill={color}
                          opacity={productQuery ? 0.3 : 1}
                          onMouseEnter={(o) => o && o.payload && setHovered(o.payload)}
                          onMouseLeave={() => setHovered(null)}
                        />
                      )
                    )}

                    {highlighted.map((d) => (
                      <ReferenceDot
                        key={`hl_${d.key}`}
                        x={d.share}
                        y={d.markup}
                        r={12}
                        isFront
                        stroke="#111827"
                        fill="none"
                        strokeWidth={2}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center gap-4 px-2 text-sm">
                {Object.entries({
                  Estrella: bcgColors.Estrella,
                  Interrogante: bcgColors.Interrogante,
                  Perro: bcgColors.Perro,
                  Vaca: bcgColors.Vaca,
                }).map(([cat, color]) => (
                  <div key={cat} className="inline-flex items-center gap-2" title={legendExplanations[cat]}>
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-slate-700">{cat}</span>
                  </div>
                ))}
                <span className="text-slate-500">(Pasa el puntero sobre cada categoría para ver el significado)</span>
              </div>

              <div className="rounded-2xl border bg-white p-3 shadow">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-600">Mostrando {sortedTable.length} de {classified.length}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-slate-600">Ordenar por</label>
                    <select className="rounded-lg border px-2 py-1" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="revenue">Facturación</option>
                      <option value="qty">Unidades</option>
                      <option value="price">Precio</option>
                      <option value="cost">Coste</option>
                      <option value="cos">CoS %</option>
                      <option value="share">Cuota %</option>
                      <option value="name">Plato</option>
                    </select>
                    <select className="rounded-lg border px-2 py-1" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                      <option value="asc">Ascendente</option>
                      <option value="desc">Descendente</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-auto rounded-2xl border bg-white shadow">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left" aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => changeSort('name')}>
                          Plato <span className="text-slate-400">{sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right" aria-sort={sortBy === 'qty' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => changeSort('qty')}>
                          Unidades <span className="text-slate-400">{sortBy === 'qty' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right" aria-sort={sortBy === 'price' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => changeSort('price')}>
                          Precio (€) <span className="text-slate-400">{sortBy === 'price' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right" aria-sort={sortBy === 'cost' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => changeSort('cost')}>
                          Coste (€) <span className="text-slate-400">{sortBy === 'cost' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right" aria-sort={sortBy === 'cos' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => changeSort('cos')}>
                          CoS % <span className="text-slate-400">{sortBy === 'cos' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right" aria-sort={sortBy === 'revenue' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => changeSort('revenue')}>
                          Facturación (€) <span className="text-slate-400">{sortBy === 'revenue' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right" aria-sort={sortBy === 'share' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => changeSort('share')}>
                          Cuota Rel. <span className="text-slate-400">{sortBy === 'share' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left">BCG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTable.map((d) => (
                      <tr key={d.key} className="border-t">
                        <td className="px-3 py-2">{d.name}</td>
                        <td className="px-3 py-2 text-right">{fmt0.format(d.qty)}</td>
                        <td className="px-3 py-2 text-right">{fmt1.format(d.price)}€</td>
                        <td className="px-3 py-2 text-right">{fmt1.format(d.cost)}€</td>
                        <td className="px-3 py-2 text-right">{pct1(d.markupRaw ?? d.markup)}</td>
                        <td className="px-3 py-2 text-right">{fmt0.format(d.revenue)}€</td>
                        <td className="px-3 py-2 text-right">{pct0(d.share * 100)}</td>
                        <td className="px-3 py-2">
                          <span
                            className="rounded-full px-2 py-1 text-xs"
                            style={{ backgroundColor: `${bcgColors[d.cat]}20`, color: bcgColors[d.cat] }}
                            title={legendExplanations[d.cat]}
                          >
                            {d.cat}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!sortedTable.length && (
                      <tr>
                        <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                          Sube el Excel con tus datos o pulsa <b>Cargar demo</b>.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <button
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:scale-105 hover:bg-slate-800"
          title="Ajustes"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="h-5 w-5" />
        </button>

        {showSettings && (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]">
            <div className="absolute inset-0 flex items-end justify-center p-4 md:items-center">
              <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Ajustes</h3>
                  <button
                    className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                    onClick={() => setShowSettings(false)}
                    aria-label="Cerrar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Nombre de marca</label>
                    <Input className="mt-1" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">CoS % (umbral Y)</label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-28"
                        step="0.1"
                        min="0"
                        max="100"
                        value={cosThreshold}
                        onChange={(e) => setCosThreshold(clamp(Number(e.target.value), 0, 100))}
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Define qué es "bueno": CoS ≤ umbral.</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Top % facturación → Estrellas</label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-28"
                        step="0.5"
                        min="0"
                        max="100"
                        value={topRevenuePct}
                        onChange={(e) => setTopRevenuePct(clamp(Number(e.target.value), 0, 100))}
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Marca como Estrella los productos que suman el primer {fmt1.format(topRevenuePct)}% de la facturación acumulada.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Criterio para Estrella</label>
                    <label className="mt-1 inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={starCosGuard}
                        onChange={(e) => setStarCosGuard(e.target.checked)}
                      />
                      <span>Exigir CoS ≤ umbral para ser Estrella</span>
                    </label>
                    <p className="mt-1 text-xs text-slate-500">Si está activado, los productos con CoS por encima del umbral nunca serán Estrella; se clasificarán como Vaca/Interrogante o Perro según su cuota.</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Umbral de cuota (derivado)</label>
                    <p className="mt-1 text-xs text-slate-600">
                      Se deriva automáticamente del Top % de facturación: es la <b>cuota mínima</b> entre los productos clasificados como Estrella.
                      &nbsp;Actual: <b>{shareThresholdNowPct}</b>
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowSettings(false)}>Cerrar</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
