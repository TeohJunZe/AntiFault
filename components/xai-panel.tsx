'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Info, TrendingDown, Activity, Loader2, Download, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

interface SensorExplain {
  sensor: string
  importance: number
  direction: string
  plain_english: string
}

interface ExplainData {
  top_sensors: SensorExplain[]
  attn_peak_cycle: number
  status: string
  predicted_rul: number
  risk_level: string
  recommendation: string
  confidence_note: string
  uncertainty_sigma: number
  anomaly_z: number
  suspected_components: string[]
}

interface XAIPanelProps {
  machineId: string
}

export function XAIPanel({ machineId }: XAIPanelProps) {
  const [explainData, setExplainData] = useState<ExplainData | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Read explainability data from localStorage when machineId changes
  useEffect(() => {
    function loadExplain() {
      try {
        const stored = localStorage.getItem('engineExplainability')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed[machineId]) {
            setExplainData(parsed[machineId])
          } else {
            setExplainData(null)
          }
        } else {
          setExplainData(null)
        }
      } catch {
        setExplainData(null)
      }
    }

    loadExplain()
    window.addEventListener('predictionsUpdated', loadExplain)
    return () => window.removeEventListener('predictionsUpdated', loadExplain)
  }, [machineId])

  const handleDownloadPDF = async () => {
    const element = document.getElementById(`formal-pdf-${machineId}`)
    if (!element) return

    try {
      setIsDownloading(true)
      const originalStyle = element.style.cssText;
      element.style.cssText = 'position: fixed; top: 0; left: 0; z-index: -9999; width: 800px; padding: 40px; background-color: white; color: black;'
      
      const imgData = await toPng(element, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 800,
      })
      
      element.style.cssText = originalStyle;
      const width = 800
      const height = element.clientHeight

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [width, height]
      })
      
      pdf.addImage(imgData, 'PNG', 0, 0, width, height)
      pdf.save(`diagnostic_report_${machineId}.pdf`)
    } catch (e) {
      console.error('Error generating PDF', e)
    } finally {
      setIsDownloading(false)
    }
  }

  // No data yet
  if (!explainData || explainData.top_sensors.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-medium">System Diagnostic Report</h4>
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Waiting for prediction data from the backend...
          <br />
          Start the FastAPI server to acquire the diagnosis.
        </div>
      </div>
    )
  }

  const { predicted_rul, risk_level, recommendation, uncertainty_sigma, anomaly_z, suspected_components, top_sensors } = explainData

  const degradationStage = predicted_rul <= 30 ? "an advanced stage of degradation" : predicted_rul <= 60 ? "early signs of degradation" : "normal operating conditions";
  const primarySensors = top_sensors.slice(0, 3).map(s => s.sensor).join(', ');

  // Human-readable conversions
  // Prediction Confidence: Re-calibrated to map typical uncertainty (0-20) into a clean 80-99.9% curve
  const predictionConfidence = Math.max(50, Math.min(99.9, 100 - (Math.sqrt(uncertainty_sigma) * 2.5)));
  const confidenceLabel = predictionConfidence >= 85 ? 'High' : predictionConfidence >= 70 ? 'Moderate' : 'Low';
  // Anomaly Severity: z-score mapped to 0-100% where z≥3 is 100%
  const anomalySeverity = Math.min(100, Math.max(0, (anomaly_z / 3) * 100));
  const severityLabel = anomalySeverity >= 80 ? 'Critical' : anomalySeverity >= 50 ? 'Elevated' : anomalySeverity >= 20 ? 'Moderate' : 'Low';

  const formalDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      {/* Viewport Dashboard UI */}
      <div className="bg-muted/20 rounded-xl p-5 border border-border/50 shadow-sm relative flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-5 relative z-10 w-full pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <h4 className="text-base font-bold tracking-widest uppercase text-foreground/90">System Diagnostic Report</h4>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="h-8 text-xs gap-1.5 shadow-sm"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isDownloading ? 'Structuring...' : 'Export PDF'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 text-base text-foreground/80 leading-relaxed">
          
          {/* Executive Summary */}
          <section>
            <h5 className="font-bold text-primary mb-2 uppercase tracking-wide text-lg">Executive Summary</h5>
            <p>
              The monitored asset <strong className="text-foreground">{machineId}</strong> is currently operating with an estimated Remaining Useful Life (RUL) of <strong className="text-foreground">{predicted_rul.toFixed(2)} cycles</strong>, indicating {degradationStage}. The system has identified a <strong className="text-foreground">{risk_level.toUpperCase()}</strong>-risk condition based on anomaly detection metrics.
            </p>
          </section>

          {/* Metric Table */}
          <section>
            <div className="rounded-lg border border-border/50 overflow-hidden mt-3">
              <table className="w-full text-left text-base border-collapse">
                <thead className="bg-muted/50 border-b border-border/50">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-foreground/90">Metric</th>
                    <th className="py-2.5 px-4 font-semibold text-foreground/90">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-4">Remaining Useful Life (RUL)</td>
                    <td className="py-2.5 px-4 font-mono font-medium">{predicted_rul.toFixed(2)}</td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-4">Prediction Confidence</td>
                    <td className="py-2.5 px-4 font-mono font-medium">{predictionConfidence.toFixed(1)}% ({confidenceLabel})</td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-4">Anomaly Severity</td>
                    <td className={cn(
                      "py-2.5 px-4 font-mono font-medium",
                      anomalySeverity >= 80 ? 'text-destructive' : anomalySeverity >= 50 ? 'text-warning' : 'text-success'
                    )}>{anomalySeverity.toFixed(1)}% ({severityLabel})</td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-4">Risk Level</td>
                    <td className={cn(
                      "py-2.5 px-4 font-bold uppercase",
                      risk_level.toLowerCase() === 'high' ? 'text-destructive' : risk_level.toLowerCase() === 'medium' ? 'text-warning' : 'text-success'
                    )}>{risk_level}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Fault Detection */}
          <section>
             <h5 className="font-bold text-primary mb-2 uppercase tracking-wide text-lg">Fault Detection</h5>
             <p className="mb-2">The diagnostic model indicates potential failure in the following components:</p>
             {suspected_components.length > 0 ? (
               <div className="rounded-lg border border-border/50 overflow-hidden mt-3">
                 <table className="w-full text-left text-base border-collapse">
                   <thead className="bg-muted/50 border-b border-border/50">
                     <tr>
                       <th className="py-2.5 px-4 font-semibold text-foreground/90">Component</th>
                       <th className="py-2.5 px-4 font-semibold text-foreground/90">Severity</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/50">
                     {suspected_components.map((compStr, idx) => {
                       const [compName, severityStr] = compStr.split(' (Severity: ');
                       const severity = severityStr ? severityStr.replace(')', '') : 'N/A';
                       const parsedSeverity = parseFloat(severity);
                       const colorClass = !isNaN(parsedSeverity) && parsedSeverity >= 80 ? 'text-destructive' : 
                                          !isNaN(parsedSeverity) && parsedSeverity >= 50 ? 'text-warning' : 'text-success';
                       return (
                         <tr key={idx} className="hover:bg-muted/30 transition-colors">
                           <td className="py-2.5 px-4">{compName}</td>
                           <td className={cn("py-2.5 px-4 font-mono font-medium", colorClass)}>{severity}</td>
                         </tr>
                       )
                     })}
                   </tbody>
                 </table>
               </div>
             ) : (
                <p className="italic text-muted-foreground pl-3">No isolated component failures detected.</p>
             )}
          </section>

          {/* Sensor Contribution */}
          <section>
             <h5 className="font-bold text-primary mb-2 uppercase tracking-wide text-lg">Sensor Contribution</h5>
             {top_sensors.length > 0 ? (
               <div className="rounded-lg border border-border/50 overflow-hidden mt-3">
                 <table className="w-full text-left text-base border-collapse">
                   <thead className="bg-muted/50 border-b border-border/50">
                     <tr>
                       <th className="py-2.5 px-4 font-semibold text-foreground/90">Sensor</th>
                       <th className="py-2.5 px-4 font-semibold text-foreground/90">Impact</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/50">
                     {top_sensors.slice(0, 3).map((s, idx) => {
                       const impactPct = (s.importance * 100).toFixed(1);
                       const isDegrading = s.direction === 'lowers_rul';
                       return (
                         <tr key={idx} className="hover:bg-muted/30 transition-colors">
                           <td className="py-2.5 px-4">{s.sensor}</td>
                           <td className={cn("py-2.5 px-4 font-mono font-medium", isDegrading ? "text-destructive" : "text-success")}>
                             {impactPct}% ({isDegrading ? 'Degrading' : 'Supporting'})
                           </td>
                         </tr>
                       )
                     })}
                   </tbody>
                 </table>
               </div>
             ) : (
                <p className="italic text-muted-foreground pl-3">No dominant sensor evidence detected.</p>
             )}
          </section>

          {/* Recommendations */}
          <section>
             <h5 className="font-bold text-primary mb-1 uppercase tracking-wide text-lg">Recommendations</h5>
             <p className="bg-primary/5 border border-primary/20 p-3 rounded-md text-foreground/90">{recommendation}</p>
          </section>

        </div>
      </div>

      {/* Hidden Formal PDF Element formatted STRICTLY like the target PDF */}
      <div 
        id={`formal-pdf-${machineId}`} 
        className="absolute w-[800px] left-[-9999px]" 
        style={{ fontFamily: '"Times New Roman", Times, serif', backgroundColor: '#ffffff', color: '#000000', padding: '50px 60px' }}
      >
        {/* Header Title strictly replicating document */}
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 16px 0', borderBottom: '1px solid #000', paddingBottom: '8px' }}>
          SYSTEM DIAGNOSTIC REPORT
        </h1>
        
        <div style={{ fontSize: '17px', lineHeight: '1.6' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '8px' }}>Asset Identification</h2>
          <p style={{ margin: 0 }}>Asset ID: {machineId}</p>
          <p style={{ margin: 0 }}>Report Date: {formalDate}</p>

          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '24px', marginBottom: '8px' }}>Executive Summary</h2>
          <p style={{ margin: 0 }}>
            The monitored asset {machineId} is currently operating with an estimated Remaining Useful Life<br/>
            (RUL) of {predicted_rul.toFixed(2)} cycles, indicating {degradationStage}. The system has identified a<br/>
            {risk_level}-risk condition based on anomaly detection metrics.
          </p>

          <div style={{ marginTop: '24px', width: '60%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 0', borderBottom: '1px solid #000', fontWeight: 'bold' }}>Metric</th>
                  <th style={{ padding: '8px 0', borderBottom: '1px solid #000', fontWeight: 'bold' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0' }}>Remaining Useful Life (RUL)</td>
                  <td style={{ padding: '8px 0' }}>{predicted_rul.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0' }}>Prediction Confidence</td>
                  <td style={{ padding: '8px 0' }}>{predictionConfidence.toFixed(1)}% ({confidenceLabel})</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0' }}>Anomaly Severity</td>
                  <td style={{ padding: '8px 0' }}>{anomalySeverity.toFixed(1)}% ({severityLabel})</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0' }}>Risk Level</td>
                  <td style={{ padding: '8px 0' }}>{risk_level.charAt(0).toUpperCase() + risk_level.slice(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '32px', marginBottom: '8px' }}>Fault Detection</h2>
          <p style={{ margin: '0 0 8px 0' }}>The diagnostic model indicates potential failure in the following components:</p>
          {suspected_components.length > 0 ? (
          <div style={{ marginTop: '12px', width: '80%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 0', borderBottom: '1px solid #000', fontWeight: 'bold' }}>Component</th>
                  <th style={{ padding: '8px 0', borderBottom: '1px solid #000', fontWeight: 'bold' }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {suspected_components.map((compStr, idx) => {
                  const [compName, severityStr] = compStr.split(' (Severity: ');
                  const severity = severityStr ? severityStr.replace(')', '') : 'N/A';
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '8px 0' }}>{compName}</td>
                      <td style={{ padding: '8px 0' }}>{severity}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          ) : (
             <p>No isolated component failures detected.</p>
          )}

          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '24px', marginBottom: '8px' }}>Sensor Contribution</h2>
          {top_sensors.length > 0 ? (
          <div style={{ marginTop: '12px', width: '80%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 0', borderBottom: '1px solid #000', fontWeight: 'bold' }}>Sensor</th>
                  <th style={{ padding: '8px 0', borderBottom: '1px solid #000', fontWeight: 'bold' }}>Impact</th>
                </tr>
              </thead>
              <tbody>
                {top_sensors.slice(0, 3).map((s, idx) => {
                  const impactPct = (s.importance * 100).toFixed(1);
                  const isDegrading = s.direction === 'lowers_rul';
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '8px 0' }}>{s.sensor}</td>
                      <td style={{ padding: '8px 0' }}>{impactPct}% ({isDegrading ? 'Degrading' : 'Supporting'})</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          ) : (
             <p>No dominant sensor evidence detected.</p>
          )}

          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '24px', marginBottom: '8px' }}>Recommendations</h2>
          <p style={{ margin: 0 }}>{recommendation}</p>

          {/* Footer String replicating document edge text */}
          <p style={{ marginTop: '60px', fontSize: '13px', fontStyle: 'italic', color: '#555' }}>
            This report is generated automatically by an AI diagnostic system. Confidential and proprietary.
          </p>

        </div>
      </div>
    </>
  )
}
