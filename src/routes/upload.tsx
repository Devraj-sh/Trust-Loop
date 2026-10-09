import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useTransition, useId } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Search,
  History,
  UserCheck,
  RefreshCw,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/trustloop/app-shell";
import { Meter, Panel, Pill, Stat, riskTone } from "@/components/trustloop/primitives";
import {
  parseCsv,
  detectColumns,
  validateUploadedData,
  reconstructCustomerHistory,
  analyzeUploadedReturn,
  CANONICAL_FIELDS,
  type ColumnDetectionResult,
  type NormalizedOrderRecord,
  type ValidationReport,
  type CustomerHistoricalMetrics,
  type CsvAnalysisResult,
} from "@/lib/trustloop/csv-pipeline";
import {
  DECISION_LABELS,
  DECISION_TONE,
  formatCurrency,
  formatPercent,
  type ConditionCode,
  type ReasonCode,
  REASON_CODES,
  CONDITIONS,
} from "@/lib/trustloop/domain";
import { getSampleMerchantCsv } from "@/lib/trustloop/api.functions";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Intelligent CSV Upload — TrustLoop" },
      {
        name: "description",
        content:
          "Upload merchant order CSVs to automatically detect columns, reconstruct customer return history, and analyze return risks.",
      },
    ],
  }),
  component: CsvUploadPage,
});

function CsvUploadPage() {
  const [isPending, startTransition] = useTransition();
  const getSampleFn = useServerFn(getSampleMerchantCsv);

  // Workflow State: 1 = upload, 2 = mapping, 3 = ready & analyze
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // File metadata & raw rows
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([]);

  // Column Mapping State
  const [mappings, setMappings] = useState<Record<string, string | null>>({});
  const [detectionResults, setDetectionResults] = useState<ColumnDetectionResult[]>([]);

  // Normalized Data & Validation
  const [normalizedOrders, setNormalizedOrders] = useState<NormalizedOrderRecord[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // Return Selection & Investigation State
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  const [filterOnlyReturns, setFilterOnlyReturns] = useState<boolean>(false);
  const [selectedReason, setSelectedReason] = useState<ReasonCode>("DEFECTIVE");
  const [selectedCondition, setSelectedCondition] = useState<ConditionCode>("LIKE_NEW");

  // Analysis result
  const [analysisResult, setAnalysisResult] = useState<CsvAnalysisResult | null>(null);

  const fileInputId = useId();

  // Process raw CSV text
  const handleCsvText = (text: string, name: string, sizeStr?: string) => {
    try {
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error("The uploaded CSV is empty or has no readable rows.");
        return;
      }

      setFileName(name);
      setFileSize(sizeStr || `${(text.length / 1024).toFixed(1)} KB`);
      setCsvHeaders(parsed.headers);
      setCsvRawRows(parsed.rows);

      // Auto-detect columns
      const detected = detectColumns(parsed.headers);
      setDetectionResults(detected);

      // Build initial mapping dict
      const initialMap: Record<string, string | null> = {};
      detected.forEach((d) => {
        initialMap[d.targetField] = d.detectedColumn;
      });
      setMappings(initialMap);

      setStep(2);
      toast.success(`Loaded ${parsed.rows.length.toLocaleString()} rows with ${parsed.headers.length} columns.`);
    } catch (err: any) {
      toast.error(`Error parsing CSV: ${err.message}`);
    }
  };

  // Handle file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
      handleCsvText(text, file.name, sizeStr);
    };
    reader.readAsText(file);
  };

  // Load sample dataset
  const handleLoadSample = async () => {
    startTransition(async () => {
      try {
        const text = await getSampleFn();
        if (!text) {
          toast.error("Sample CSV file could not be found locally.");
          return;
        }
        handleCsvText(text, "merchant_orders.csv", "65.2 KB");
      } catch (err: any) {
        toast.error(`Failed to load sample: ${err.message}`);
      }
    });
  };

  // Update a single column mapping
  const handleMappingChange = (fieldKey: string, newCol: string) => {
    setMappings((prev) => ({
      ...prev,
      [fieldKey]: newCol === "__none__" ? null : newCol,
    }));
  };

  // Confirm mapping and validate
  const handleConfirmMapping = () => {
    // Validate required fields
    const missingRequired = CANONICAL_FIELDS.filter(
      (f) => f.required && !mappings[f.key],
    );

    if (missingRequired.length > 0) {
      toast.error(
        `Please map all required fields: ${missingRequired.map((f) => f.label).join(", ")}`,
      );
      return;
    }

    const { normalized, report } = validateUploadedData(csvRawRows, mappings);
    setNormalizedOrders(normalized);
    setValidationReport(report);

    // Pick first returned order or first order as default selection
    const firstReturn = normalized.find((o) => o.is_returned);
    const initialPick = firstReturn ? firstReturn.order_id : normalized[0]?.order_id || "";
    setSelectedOrderId(initialPick);

    if (initialPick) {
      try {
        const res = analyzeUploadedReturn({
          orderId: initialPick,
          allOrders: normalized,
          reason: selectedReason,
          condition: selectedCondition,
        });
        setAnalysisResult(res);
      } catch {
        // ignore
      }
    }

    setStep(3);
    toast.success(`Data validated: ${report.uniqueOrders.toLocaleString()} orders ready for return analysis.`);
  };

  // When selected order changes
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (!orderId || normalizedOrders.length === 0) return;
    try {
      const res = analyzeUploadedReturn({
        orderId,
        allOrders: normalizedOrders,
        reason: selectedReason,
        condition: selectedCondition,
      });
      setAnalysisResult(res);
    } catch (err: any) {
      toast.error(`Analysis error: ${err.message}`);
    }
  };

  // Re-run analysis on reason/condition change
  const handleRerunAnalysis = (reason: ReasonCode, condition: ConditionCode) => {
    setSelectedReason(reason);
    setSelectedCondition(condition);
    if (!selectedOrderId || normalizedOrders.length === 0) return;
    try {
      const res = analyzeUploadedReturn({
        orderId: selectedOrderId,
        allOrders: normalizedOrders,
        reason,
        condition,
      });
      setAnalysisResult(res);
    } catch (err: any) {
      toast.error(`Analysis error: ${err.message}`);
    }
  };

  // Filtered orders for selector
  const filteredOrders = normalizedOrders.filter((o) => {
    if (filterOnlyReturns && !o.is_returned) return false;
    if (!orderSearchQuery) return true;
    const q = orderSearchQuery.toLowerCase();
    return (
      o.order_id.toLowerCase().includes(q) ||
      o.customer_id.toLowerCase().includes(q) ||
      (o.product_name || "").toLowerCase().includes(q) ||
      (o.customer_city || "").toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Intelligent Data Ingestion"
        title="Upload Data & Analyze Returns"
        description="Upload your e-commerce order and customer history CSV. TrustLoop automatically detects columns, reconstructs multi-order customer history, and feeds the context into the return risk engine."
        action={
          step > 1 && (
            <button
              onClick={() => {
                setStep(1);
                setAnalysisResult(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all"
            >
              <RefreshCw className="size-3.5" />
              Upload New CSV
            </button>
          )
        }
      />

      {/* Progress Stepper */}
      <div className="mb-8 flex items-center justify-between max-w-2xl border-b border-slate-200 pb-4 text-xs font-semibold font-mono">
        <div className={`flex items-center gap-2 ${step >= 1 ? "text-[#1769E0]" : "text-slate-400"}`}>
          <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${step >= 1 ? "bg-[#1769E0] text-white" : "bg-slate-200 text-slate-600"}`}>
            1
          </span>
          <span>CSV UPLOAD</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-200" />
        <div className={`flex items-center gap-2 ${step >= 2 ? "text-[#1769E0]" : "text-slate-400"}`}>
          <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${step >= 2 ? "bg-[#1769E0] text-white" : "bg-slate-200 text-slate-600"}`}>
            2
          </span>
          <span>COLUMN MAPPING</span>
        </div>
        <div className="h-0.5 w-12 bg-slate-200" />
        <div className={`flex items-center gap-2 ${step >= 3 ? "text-[#1769E0]" : "text-slate-400"}`}>
          <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${step >= 3 ? "bg-[#1769E0] text-white" : "bg-slate-200 text-slate-600"}`}>
            3
          </span>
          <span>SELECT RETURN & ANALYZE</span>
        </div>
      </div>

      {/* STEP 1: CSV UPLOAD */}
      {step === 1 && (
        <div className="space-y-6">
          <Panel
            title="Import Order & Return CSV"
            description="Upload any merchant order CSV file. Supports current-order, previous-orders, customer history, and return flags."
          >
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 sm:p-12 text-center transition-all hover:border-[#1769E0] hover:bg-[#EAF3FF]/20">
              <div className="grid size-14 place-items-center rounded-2xl bg-[#EAF3FF] text-[#1769E0] shadow-xs mb-4">
                <FileSpreadsheet className="size-7" />
              </div>
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                Drag and drop your order CSV here
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md">
                Supports single-order claims or entire customer order histories (from 1 to 50,000+ orders).
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <label
                  htmlFor={fileInputId}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-[#1769E0] px-5 py-2.5 text-xs font-bold text-white shadow-[0_2px_0_0_#0D47A1] hover:bg-[#1558BE] transition-all"
                >
                  <Upload className="size-4" />
                  <span>Browse CSV File</span>
                </label>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                <span className="text-xs text-slate-400 font-mono">or</span>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleLoadSample}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>{isPending ? "Loading Sample..." : "Load Indian Merchant Orders Sample (500 orders)"}</span>
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B1F3A]">Auto-Detects Columns</p>
                  <p className="text-slate-500 mt-0.5">Intelligently maps order numbers, customer IDs, dates, INR amounts, and return status.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B1F3A]">Reconstructs Customer History</p>
                  <p className="text-slate-500 mt-0.5">Calculates previous orders, return rates, 30-day velocity, and lifetime spend dynamically.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B1F3A]">Indian ML Model Scoring</p>
                  <p className="text-slate-500 mt-0.5">Evaluated against the trained 38-feature Indian E-Commerce XGBoost model without retraining.</p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* STEP 2: CSV MAPPING SCREEN */}
      {step === 2 && (
        <div className="space-y-6">
          {/* File Info Banner per Section 13 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="FILE"
              value={fileName}
              hint={fileSize}
              icon={<FileSpreadsheet className="size-4" />}
            />
            <Stat
              label="ROWS"
              value={csvRawRows.length.toLocaleString()}
              hint="Imported records"
              icon={<Layers className="size-4" />}
            />
            <Stat
              label="COLUMNS"
              value={csvHeaders.length}
              hint="Detected attributes"
              icon={<BarChart3 className="size-4" />}
            />
          </div>

          <Panel
            title="COLUMN MAPPING"
            description="Verify the detected column mappings. High confidence mappings were matched automatically. You can manually adjust any mapping below before confirming."
          >
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 uppercase font-mono text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Standard TrustLoop Field</th>
                    <th className="py-3 px-4">Requirement</th>
                    <th className="py-3 px-4">Detected CSV Column</th>
                    <th className="py-3 px-4">Detection Confidence</th>
                    <th className="py-3 px-4 text-right">Manual Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {CANONICAL_FIELDS.map((field) => {
                    const detected = detectionResults.find((d) => d.targetField === field.key);
                    const currentVal = mappings[field.key];
                    const isMatched = Boolean(currentVal);
                    const confidence = detected?.confidence || "none";

                    return (
                      <tr key={field.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#0B1F3A]">{field.label}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{field.key}</p>
                        </td>
                        <td className="py-3 px-4">
                          {field.required ? (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                              Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                          {currentVal ? (
                            <span className="text-[#1769E0] font-bold">→ {currentVal}</span>
                          ) : (
                            <span className="text-slate-400 italic">Not mapped</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {confidence === "high" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                              ✓ High confidence
                            </span>
                          )}
                          {confidence === "medium" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                              Medium confidence
                            </span>
                          )}
                          {confidence === "low" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                              Low confidence
                            </span>
                          )}
                          {confidence === "none" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-400">
                              Unmapped
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <select
                            value={currentVal || "__none__"}
                            onChange={(e) => handleMappingChange(field.key, e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs focus:border-[#1769E0] focus:outline-none"
                          >
                            <option value="__none__">-- Do not map --</option>
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Upload
              </button>

              <button
                type="button"
                onClick={handleConfirmMapping}
                className="inline-flex items-center gap-2 rounded-full bg-[#1769E0] px-6 py-2.5 text-xs font-bold text-white shadow-[0_3px_0_0_#0D47A1] hover:bg-[#1558BE] transition-all"
              >
                <span>CONFIRM & ANALYZE</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* STEP 3: DATA VALIDATED & RETURN ANALYSIS */}
      {step === 3 && (
        <div className="space-y-8">
          {/* DATA READY Banner per Section 14 */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-bold text-[#0B1F3A]">DATA READY</h2>
                    <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-900 font-mono">
                      VALIDATED
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {validationReport?.uniqueOrders.toLocaleString()} orders ·{" "}
                    {validationReport?.uniqueCustomers.toLocaleString()} customers ·{" "}
                    {validationReport?.totalReturns.toLocaleString()} returns (
                    {formatPercent(validationReport?.returnRate || 0, 1)})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-50 transition-all"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Adjust Mappings</span>
                </button>
              </div>
            </div>

            {/* Validation issues if any */}
            {validationReport && validationReport.issues.length > 0 && (
              <div className="mt-3.5 pt-3 border-t border-emerald-200/70 space-y-1 text-xs text-amber-800">
                {validationReport.issues.map((issue, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                    <span>
                      <strong className="font-mono text-[11px]">{issue.code}:</strong> {issue.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 15: # SELECT RETURN TO ANALYZE */}
          <Panel
            title="# SELECT RETURN TO ANALYZE"
            description="Choose the specific order or return claim to investigate. TrustLoop will reconstruct that customer's complete prior order and return history to evaluate risk."
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Order ID, Customer ID, City, or Product..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#1769E0] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterOnlyReturns(!filterOnlyReturns)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    filterOnlyReturns
                      ? "border-rose-300 bg-rose-50 text-rose-800 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ShieldAlert className="size-3.5" />
                  <span>Returned Orders Only ({validationReport?.totalReturns})</span>
                </button>
              </div>
            </div>

            {/* Order Selector Dropdown / Grid */}
            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 space-y-1.5">
              {filteredOrders.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400">No matching orders found.</p>
              ) : (
                filteredOrders.slice(0, 100).map((ord) => {
                  const isSelected = ord.order_id === selectedOrderId;
                  return (
                    <button
                      key={ord.order_id}
                      type="button"
                      onClick={() => handleSelectOrder(ord.order_id)}
                      className={`w-full text-left rounded-xl p-3 text-xs transition-all flex flex-wrap items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-white border-2 border-[#1769E0] shadow-[0_2px_0_0_#1769E0]"
                          : "bg-white/90 border border-slate-200/80 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`grid size-8 place-items-center rounded-lg text-xs font-bold font-mono ${
                          isSelected ? "bg-[#1769E0] text-white" : "bg-slate-100 text-slate-700"
                        }`}>
                          ORD
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#0B1F3A] font-mono">{ord.order_id}</span>
                            <span className="text-[11px] text-slate-400 font-mono">({ord.customer_id})</span>
                            {ord.is_returned && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.2 text-[10px] font-bold text-rose-700 border border-rose-200">
                                RETURNED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {ord.product_name || "General E-Commerce Item"} · {ord.customer_city || "India"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="font-bold text-[#0B1F3A] tabular-nums font-mono">
                            {formatCurrency(ord.order_amount)}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{ord.order_date}</p>
                        </div>
                        <span className={`text-xs font-bold ${isSelected ? "text-[#1769E0]" : "text-slate-300"}`}>
                          {isSelected ? "● SELECTED" : "Select"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {filteredOrders.length > 100 && (
              <p className="mt-2 text-[11px] text-slate-400 font-mono text-center">
                Showing top 100 results of {filteredOrders.length.toLocaleString()} matching records. Use search above to narrow down.
              </p>
            )}
          </Panel>

          {/* Section 16: AUTOMATIC HISTORY RETRIEVAL & CONTEXT */}
          {analysisResult && (
            <div className="space-y-6">
              <Panel
                title="RECONSTRUCTED CUSTOMER HISTORY"
                description={`Automatically calculated from ${analysisResult.history.total_orders} historical transactions for customer ${analysisResult.currentOrder.customer_id}.`}
              >
                {/* Historical Metrics Grid per Section 8 & 9 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Historical Orders
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#0B1F3A] tabular-nums font-mono">
                      {analysisResult.history.total_orders}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Previous Returns
                    </p>
                    <p className="mt-1 text-lg font-bold text-rose-600 tabular-nums font-mono">
                      {analysisResult.history.previous_return_count}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Return Rate
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#0B1F3A] tabular-nums font-mono">
                      {formatPercent(analysisResult.history.previous_return_rate, 1)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Total Spend
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#0B1F3A] tabular-nums font-mono">
                      {formatCurrency(analysisResult.history.total_spent)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Returns Last 30d
                    </p>
                    <p className="mt-1 text-lg font-bold text-amber-600 tabular-nums font-mono">
                      {analysisResult.history.returns_last_30_days}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Avg Delivery Days
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#0B1F3A] tabular-nums font-mono">
                      {analysisResult.history.average_delivery_days.toFixed(1)}d
                    </p>
                  </div>
                </div>

                {/* Side-by-side: Current Order vs Customer History Context */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[#BFDBFE] bg-[#EAF3FF]/40 p-4">
                    <h4 className="text-xs font-bold text-[#1769E0] uppercase tracking-wider font-mono">
                      CURRENT INVESTIGATED ORDER
                    </h4>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Order ID:</span>
                        <span className="font-bold font-mono text-[#0B1F3A]">{analysisResult.currentOrder.order_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Current Amount:</span>
                        <span className="font-bold font-mono text-[#0B1F3A]">
                          {formatCurrency(analysisResult.currentOrder.order_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Order Date:</span>
                        <span className="font-mono text-slate-700">{analysisResult.currentOrder.order_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Observed Return Flag:</span>
                        <span className={`font-bold font-mono ${analysisResult.currentOrder.is_returned ? "text-rose-600" : "text-slate-700"}`}>
                          {analysisResult.currentOrder.return_status || "Not Returned"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Location:</span>
                        <span className="text-slate-700 font-medium">
                          {analysisResult.currentOrder.customer_city || "Unknown"}, {analysisResult.currentOrder.customer_state || "India"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
                      HISTORICAL BEHAVIORAL PROFILE
                    </h4>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Average Order Value:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {formatCurrency(analysisResult.history.average_order_value)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Spend Deviation:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {(analysisResult.currentOrder.order_amount / Math.max(1, analysisResult.history.average_order_value)).toFixed(2)}x of avg
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Days Since Last Order:</span>
                        <span className="font-mono text-slate-700">
                          {analysisResult.history.days_since_last_order} days
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Account Lifetime:</span>
                        <span className="font-mono text-slate-700">
                          {analysisResult.history.customer_lifetime_days} days
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Return Value (Last 30d):</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {formatCurrency(analysisResult.history.return_value_last_30_days)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Return Simulation Reason & Condition selectors */}
                <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 font-mono">Claimed Reason:</span>
                    <select
                      value={selectedReason}
                      onChange={(e) => handleRerunAnalysis(e.target.value as ReasonCode, selectedCondition)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs focus:border-[#1769E0]"
                    >
                      {REASON_CODES.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 font-mono">Claimed Condition:</span>
                    <select
                      value={selectedCondition}
                      onChange={(e) => handleRerunAnalysis(selectedReason, e.target.value as ConditionCode)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs focus:border-[#1769E0]"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Panel>

              {/* Section 17 & 18: RETURN ANALYSIS RESULTS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Decision & Action */}
                <Panel
                  title="RECOMMENDED DECISION"
                  description="Evaluated from Indian ML model risk, policy rules, and account history."
                  className="lg:col-span-1"
                >
                  <div className="space-y-4">
                    <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 text-center">
                      <Pill
                        tone={DECISION_TONE[analysisResult.decisionResult.outcome]}
                        className="text-sm px-3.5 py-1 font-bold"
                      >
                        {DECISION_LABELS[analysisResult.decisionResult.outcome]}
                      </Pill>
                      <p className="mt-2 text-xs text-slate-500 font-mono">
                        System Confidence: {formatPercent(analysisResult.decisionResult.confidence, 0)}
                      </p>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600">
                      <p className="font-bold text-[#0B1F3A] uppercase tracking-wider text-[11px] font-mono">
                        DECISION RATIONALE:
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        {analysisResult.decisionResult.rationale.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-center">
                      <Link
                        to="/returns/new"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1769E0] hover:underline"
                      >
                        <span>Open in Trust Passport Creator</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </Panel>

                {/* Indian ML Model Risk & Factor Contributions */}
                <Panel
                  title="INDIAN RETURN-RISK MODEL"
                  description="XGBoost classifier trained on 1.1M Indian E-Commerce transactions (38 features)."
                  className="lg:col-span-2"
                >
                  {analysisResult.modelResult ? (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            Model Risk Score
                          </p>
                          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-[#0B1F3A] tracking-tight">
                            {(analysisResult.modelResult.riskScore * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <Pill tone={riskTone(analysisResult.modelResult.riskLevel)}>
                            {analysisResult.modelResult.riskLevel} RETURN RISK
                          </Pill>
                        </div>
                        <div className="w-full">
                          <Meter
                            value={analysisResult.modelResult.riskScore}
                            tone={riskTone(analysisResult.modelResult.riskLevel)}
                          />
                        </div>
                      </div>

                      {/* Feature Contributions */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono mb-2">
                          Top Feature Drivers (Indian Feature Schema)
                        </h4>
                        <div className="space-y-2">
                          {analysisResult.modelResult.contributions.slice(0, 5).map((c, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`size-2 rounded-full ${c.contribution > 0 ? "bg-rose-500" : "bg-emerald-500"}`} />
                                <span className="font-semibold text-slate-800 font-mono">{c.feature}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-400">val: {c.value}</span>
                                <span className={`font-mono font-bold ${c.contribution > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                  {c.contribution > 0 ? "+" : "-"}
                                  {(Math.abs(c.contribution) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Regional Hotspot context */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 font-mono">Geographic Hotspot Tier:</span>
                          <span className="font-medium text-slate-600">
                            {analysisResult.geoResult.areaName} ({analysisResult.geoResult.riskTier})
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">
                          Hotspot Score: {analysisResult.geoResult.hotspotScore}/100
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500">
                      <p className="font-bold text-amber-700">Insufficient data for complete ML prediction.</p>
                      <p className="mt-1">{analysisResult.insufficientMessage}</p>
                    </div>
                  )}
                </Panel>
              </div>

              {/* Customer's Historical Orders Table */}
              <Panel
                title="CHRONOLOGICAL CUSTOMER ORDER LOG"
                description={`All recorded orders for customer ${analysisResult.currentOrder.customer_id} in the uploaded file.`}
              >
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 uppercase font-mono text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Delivery</th>
                        <th className="py-2.5 px-3">Rating</th>
                        <th className="py-2.5 px-3 text-right">Return Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-mono">
                      {analysisResult.history.historicalOrders.map((ord) => {
                        const isThis = ord.order_id === analysisResult.currentOrder.order_id;
                        return (
                          <tr
                            key={ord.order_id}
                            className={isThis ? "bg-[#EAF3FF]/40 font-bold" : "hover:bg-slate-50"}
                          >
                            <td className="py-2.5 px-3">
                              <span className={isThis ? "text-[#1769E0]" : "text-slate-800"}>
                                {ord.order_id} {isThis ? "(Current)" : ""}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{ord.order_date}</td>
                            <td className="py-2.5 px-3 text-slate-800">{formatCurrency(ord.order_amount)}</td>
                            <td className="py-2.5 px-3 text-slate-600 font-sans truncate max-w-xs">
                              {ord.product_name || "Item"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{ord.delivery_days ?? 5}d</td>
                            <td className="py-2.5 px-3 text-slate-500">{ord.customer_rating ?? 4.0}★</td>
                            <td className="py-2.5 px-3 text-right">
                              {ord.is_returned ? (
                                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                  Returned
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Not Returned</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
