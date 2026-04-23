'use client'

import { useState, useRef } from 'react'
import {
  productTypes,
  OrderAnalysisResult,
} from '@/lib/admin-data'
import { Machine } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Clock,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Zap,
  ArrowRight,
  Sparkles,
  Loader2,
  Ban,
  Wrench,
  CheckCircle,
  Upload,
  FileUp,
  X,
  ArrowUp,
  FileCheck,
  ChevronDown,
  Download,
} from 'lucide-react'
import { FilterBar, DateRange, ComparisonMode } from './filter-bar'
import { MaintenanceDonut } from './maintenance-donut'
import { InsightPanel, SegmentName } from './insight-panel'
import { CostTrendChart } from './cost-trend-chart'
import { parseDocument, type ParsedOrderData, type ParsedOrderRow } from '@/lib/document-parser'

interface AdminDashboardProps {
  machines: Machine[]
}

export function AdminDashboard({ machines }: AdminDashboardProps) {
  // ── Filter State ──
  const [dateRange, setDateRange] = useState<DateRange>('this-month')
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('none')

  // ── Donut Interaction State ──
  const [activeSegment, setActiveSegment] = useState<SegmentName>(null)

  // ── Order Engine State ──
  const [orderForm, setOrderForm] = useState({
    quantity: '',
    deadline: '',
    productType: '',
    sellingPrice: '',
  })
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [analysisResult, setAnalysisResult] = useState<OrderAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // ── Document parsing state ──
  const [parsedData, setParsedData] = useState<ParsedOrderData | null>(null)
  const [extractedFields, setExtractedFields] = useState<string[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [showOrderSelector, setShowOrderSelector] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setIsParsing(true)
    try {
      const result = await parseDocument(file)
      if (result && result.extractedFields.length > 0) {
        setParsedData(result)
        setExtractedFields(result.extractedFields)
        // Auto-fill form with extracted data
        setOrderForm(prev => ({
          quantity: result.quantity || prev.quantity,
          deadline: result.deadline || prev.deadline,
          productType: result.productType || prev.productType,
          sellingPrice: result.sellingPrice || prev.sellingPrice,
        }))
      } else {
        setParsedData(null)
        setExtractedFields([])
      }
    } catch {
      console.error('Document parsing failed')
      setParsedData(null)
      setExtractedFields([])
    } finally {
      setIsParsing(false)
    }
  }

  const handleSelectOrder = (index: number) => {
    if (!parsedData) return
    const order = parsedData.allOrders[index]
    const fields: string[] = []
    const newForm = { ...orderForm }
    if (order.quantity) { newForm.quantity = order.quantity; fields.push('quantity') }
    if (order.deadline) { newForm.deadline = order.deadline; fields.push('deadline') }
    if (order.productType) { newForm.productType = order.productType; fields.push('productType') }
    if (order.sellingPrice) { newForm.sellingPrice = order.sellingPrice; fields.push('sellingPrice') }
    setOrderForm(newForm)
    setExtractedFields(fields)
    setParsedData({ ...parsedData, selectedIndex: index })
    setShowOrderSelector(false)
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setParsedData(null)
    setExtractedFields([])
    setShowOrderSelector(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAnalyzeOrder = async () => {
    if (!orderForm.quantity || !orderForm.deadline || !orderForm.productType) return
    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      const res = await fetch('/api/order-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: Number(orderForm.quantity),
          deadline: orderForm.deadline,
          productType: orderForm.productType,
          sellingPrice: Number(orderForm.sellingPrice) || 15,
        }),
      })
      const data = await res.json()
      setAnalysisResult(data)
    } catch {
      console.error('Order analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* ─── 1. FILTER BAR ─── */}
      <FilterBar
        dateRange={dateRange}
        comparisonMode={comparisonMode}
        onDateRangeChange={setDateRange}
        onComparisonModeChange={setComparisonMode}
      />

      {/* ─── 2. HERO: DONUT CHART + INSIGHT PANEL ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* Left: Donut Chart (~60%) */}
        <MaintenanceDonut
          activeSegment={activeSegment}
          onSegmentClick={setActiveSegment}
          comparisonMode={comparisonMode}
        />

        {/* Right: Insight Panel (~40%) */}
        <InsightPanel activeSegment={activeSegment} />
      </div>

      {/* ─── 3. COST & SAVINGS TREND ─── */}
      <CostTrendChart />

      {/* ─── 4. AI ORDER DECISION ENGINE ─── */}
      <section>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          AI Order Decision Engine
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Input Form */}
          <Card className="border border-border/50 bg-card shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="space-y-3">

                {/* File Upload — moved to top for smart flow */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Upload Order Document
                    </label>
                  </div>
                  {!uploadedFile ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-teal-500/40 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Upload file (CSV, Excel) to auto-fill fields
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-teal-500/5 border border-teal-500/20 rounded-lg">
                        {isParsing ? (
                          <Loader2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0 animate-spin" />
                        ) : extractedFields.length > 0 ? (
                          <FileCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                        ) : (
                          <FileUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-xs text-foreground/70 truncate flex-1">{uploadedFile.name}</span>
                        {!isParsing && extractedFields.length > 0 && (
                          <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400 flex-shrink-0">
                            {extractedFields.length} fields extracted
                          </span>
                        )}
                        {!isParsing && extractedFields.length === 0 && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">No data found</span>
                        )}
                        <button onClick={handleRemoveFile} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Order row selector for multi-row documents */}
                      {parsedData && parsedData.allOrders.length > 1 && (
                        <div className="relative">
                          <button
                            onClick={() => setShowOrderSelector(!showOrderSelector)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Row:</span>
                              <span className="font-medium">
                                {parsedData.allOrders[parsedData.selectedIndex]?.orderId || `Order ${parsedData.selectedIndex + 1}`}
                              </span>
                              <span className="text-muted-foreground/50">({parsedData.allOrders.length} found)</span>
                            </span>
                            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', showOrderSelector && 'rotate-180')} />
                          </button>
                          {showOrderSelector && (
                            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                              {parsedData.allOrders.map((order, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleSelectOrder(i)}
                                  className={cn(
                                    'w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0',
                                    i === parsedData.selectedIndex && 'bg-teal-500/5'
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{order.orderId || `Order ${i + 1}`}</span>
                                    <span className="text-muted-foreground">
                                      {order.quantity && `Qty: ${Number(order.quantity).toLocaleString()}`}
                                      {order.sellingPrice && ` · RM${order.sellingPrice}`}
                                    </span>
                                  </div>
                                  {order.customer && (
                                    <div className="text-muted-foreground/60 mt-0.5">{order.customer}</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Divider */}
                {extractedFields.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium uppercase tracking-wider">Auto-filled from document</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Order Quantity</label>
                      {extractedFields.includes('quantity') && (
                        <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">Extracted</span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={orderForm.quantity}
                      onChange={(e) => { setOrderForm({ ...orderForm, quantity: e.target.value }); setExtractedFields(f => f.filter(x => x !== 'quantity')) }}
                      placeholder="e.g. 5000"
                      className={cn(
                        'w-full px-3 py-2 bg-muted/50 border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-teal-500/50',
                        extractedFields.includes('quantity') ? 'border-teal-500/30 bg-teal-500/[0.03]' : 'border-border'
                      )}
                    />
                  </div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Deadline</label>
                      {extractedFields.includes('deadline') && (
                        <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">Extracted</span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={orderForm.deadline}
                      onChange={(e) => { setOrderForm({ ...orderForm, deadline: e.target.value }); setExtractedFields(f => f.filter(x => x !== 'deadline')) }}
                      className={cn(
                        'w-full px-3 py-2 bg-muted/50 border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/50',
                        extractedFields.includes('deadline') ? 'border-teal-500/30 bg-teal-500/[0.03]' : 'border-border'
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Product Type</label>
                      {extractedFields.includes('productType') && (
                        <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">Extracted</span>
                      )}
                    </div>
                    <select
                      value={orderForm.productType}
                      onChange={(e) => { setOrderForm({ ...orderForm, productType: e.target.value }); setExtractedFields(f => f.filter(x => x !== 'productType')) }}
                      className={cn(
                        'w-full px-3 py-2 bg-muted/50 border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/50',
                        extractedFields.includes('productType') ? 'border-teal-500/30 bg-teal-500/[0.03]' : 'border-border'
                      )}
                    >
                      <option value="">Select...</option>
                      {productTypes.map((pt) => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Price/Unit (RM)</label>
                      {extractedFields.includes('sellingPrice') && (
                        <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">Extracted</span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={orderForm.sellingPrice}
                      onChange={(e) => { setOrderForm({ ...orderForm, sellingPrice: e.target.value }); setExtractedFields(f => f.filter(x => x !== 'sellingPrice')) }}
                      placeholder="Default: 15"
                      className={cn(
                        'w-full px-3 py-2 bg-muted/50 border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-teal-500/50',
                        extractedFields.includes('sellingPrice') ? 'border-teal-500/30 bg-teal-500/[0.03]' : 'border-border'
                      )}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAnalyzeOrder}
                  disabled={isAnalyzing || !orderForm.quantity || !orderForm.deadline || !orderForm.productType}
                  className="w-full gap-2 h-10 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze Order
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Output Panel — empty before analysis */}
          {isAnalyzing && (
            <Card className="border border-border/50 bg-card shadow-sm flex items-center justify-center min-h-[280px]">
              <CardContent className="text-center py-10">
                <Loader2 className="w-7 h-7 text-teal-600 dark:text-teal-400 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">
                  AI is analyzing your order…
                </p>
              </CardContent>
            </Card>
          )}

          {analysisResult && !isAnalyzing && (
            <div className="space-y-3">
              {/* Decision Badge */}
              <Card className={cn(
                'shadow-sm border-l-4 bg-card',
                analysisResult.decision === 'Accept'
                  ? 'border-l-emerald-500 border-border/50'
                  : analysisResult.decision === 'Caution'
                    ? 'border-l-amber-500 border-border/50'
                    : 'border-l-red-500 border-border/50'
              )}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted/50',
                      analysisResult.decision === 'Accept'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : analysisResult.decision === 'Caution'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    )}>
                      {analysisResult.decision === 'Accept' ? (
                        <ShieldCheck className="w-6 h-6" />
                      ) : analysisResult.decision === 'Caution' ? (
                        <ShieldAlert className="w-6 h-6" />
                      ) : (
                        <ShieldX className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className={cn(
                        'text-lg font-bold',
                        analysisResult.decision === 'Accept'
                          ? 'text-teal-700 dark:text-teal-400'
                          : analysisResult.decision === 'Caution'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-red-700 dark:text-red-400'
                      )}>
                        {analysisResult.decision === 'Accept' ? 'Accept Order' :
                          analysisResult.decision === 'Caution' ? 'Accept with Caution' :
                            'High Risk — Reject'}
                      </div>
                      <p className="text-xs text-muted-foreground">{analysisResult.recommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Grid */}
              <div className="grid grid-cols-2 gap-2">
                <ResultCard label="Completion" value={`${analysisResult.completionDays} days`} icon={<Clock className="w-3.5 h-3.5" />} />
                <ResultCard label="Profit" value={`RM ${analysisResult.profit.toLocaleString()}`} icon={<ArrowUp className="w-3.5 h-3.5" />}
                  color={analysisResult.profit > 0 ? 'green' : 'red'} />
                <ResultCard label="Risk" value={analysisResult.risk} icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  color={analysisResult.risk === 'Low' ? 'green' : analysisResult.risk === 'Medium' ? 'amber' : 'red'} />
                <ResultCard label="Breakdown" value={`${analysisResult.breakdownProbability}%`} icon={<Zap className="w-3.5 h-3.5" />}
                  color={analysisResult.breakdownProbability < 40 ? 'green' : analysisResult.breakdownProbability < 70 ? 'amber' : 'red'} />
              </div>

              {/* AI Explanation */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-sm text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                  <p>{analysisResult.explanation}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── SCENARIO COMPARISON ─── */}
      {analysisResult && (
        <section>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
            <ArrowRight className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Decision Options
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analysisResult.scenarios.map((scenario, i) => (
              <Card
                key={i}
                className={cn(
                  'shadow-sm transition-all duration-200',
                  scenario.recommended
                    ? 'bg-teal-50 dark:bg-teal-500/[0.08] ring-1 ring-teal-500/30 border-teal-200 dark:border-teal-500/20'
                    : 'border border-border/50 bg-card'
                )}
              >
                {scenario.recommended && (
                  <div className="px-3 py-1 text-center">
                    <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                      Recommended
                    </span>
                  </div>
                )}
                <CardContent className={cn('pb-4', scenario.recommended ? 'pt-1' : 'pt-4')}>
                  <div className="flex items-center gap-2 mb-3">
                    {i === 0 ? (
                      <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    ) : i === 1 ? (
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Ban className="w-4 h-4 text-muted-foreground/50" />
                    )}
                    <span className="font-semibold text-sm text-foreground">{scenario.title}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Profit</span>
                      <span className={cn(
                        'font-bold text-sm',
                        scenario.profit > 0 ? 'text-teal-700 dark:text-teal-400' : 'text-muted-foreground'
                      )}>
                        RM {scenario.profit.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Risk</span>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        scenario.risk === 'Low'
                          ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400'
                          : scenario.risk === 'Medium'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                      )}>
                        {scenario.risk}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Delay</span>
                      <span className="font-bold text-sm text-foreground/60">{scenario.delayChance}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Compact Result Card ────────────────────────────────────────

function ResultCard({
  label, value, icon, color = 'default',
}: {
  label: string
  value: string
  icon: React.ReactNode
  color?: 'green' | 'amber' | 'red' | 'default'
}) {
  const textColor = {
    green: 'text-teal-700 dark:text-teal-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400',
    default: 'text-foreground',
  }
  return (
    <Card className="border border-border/50 bg-card shadow-sm">
      <CardContent className="py-3 pt-3">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className={cn('text-base font-bold', textColor[color])}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
