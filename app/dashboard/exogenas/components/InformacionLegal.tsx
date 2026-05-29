import React, { useState } from 'react'
import { Info, X } from 'lucide-react'

const JA = {
  NAVY: '#13213C',
  GOLD: '#B8960C',
  WHITE: '#FFFFFF',
  TEXT: '#374151',
  GREY: '#6B7280',
  BORDER: '#E5E7EB',
  SURFACE: '#F9FAFB',
}

export function InformacionLegal() {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button 
        onClick={() => setAbierto(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
          borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: JA.TEXT,
          cursor: 'pointer', transition: 'all 0.2s', marginTop: '16px'
        }}
      >
        <Info size={16} color={JA.GOLD} />
        Información Legal y Metodología DIAN
      </button>

      {abierto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(19, 33, 60, 0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: JA.WHITE, width: '100%', maxWidth: '700px',
            maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${JA.BORDER}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#FAFAF8'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: JA.NAVY, fontWeight: 800 }}>Metodología de Cálculo y Legal</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: JA.GREY }}>Resolución DIAN 000227 de 2025 (Año Gravable 2025)</p>
              </div>
              <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: JA.GREY }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', fontSize: '14px', color: JA.TEXT, lineHeight: '1.7' }}>
              <p>El Módulo de Exógenas de <strong>J&A Contadores</strong> está diseñado bajo los parámetros estrictos de la Resolución 000227 de 2025, garantizando cálculos limpios y listos para el prevalidador DIAN.</p>
              
              <h4 style={{ color: JA.NAVY, marginTop: '24px', marginBottom: '10px', fontSize: '15px' }}>1. Formato 1001 (Pagos o abonos en cuenta)</h4>
              <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li><strong>Retención topeada al pago:</strong> El sistema aplica la regla antifraude validando que el valor reportado como "Retención practicada" nunca sea mayor al valor del "Pago o abono en cuenta" (Gasto/Costo) para un mismo tercero y concepto. En caso de discrepancia, el sistema topeará automáticamente la retención hasta el límite del pago.</li>
                <li><strong>Cruce de cuentas:</strong> Extrae saldos débitos de clases 5 y 6 (Gastos y Costos) como Pagos o Abonos, y saldos créditos de la clase 2 (Retenciones) cruzando por el mismo tercero.</li>
              </ul>

              <h4 style={{ color: JA.NAVY, marginTop: '20px', marginBottom: '10px', fontSize: '15px' }}>2. Cuantías Menores (NIT 222222222)</h4>
              <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li><strong>Consolidación automática (F1006 / F1007):</strong> Según el Art. 19 y siguientes, las transacciones individuales que no superen los topes definidos (500 UVT / aprox. $23.532.500 COP) y no posean un tercero plenamente identificado, se consolidarán automáticamente en un único registro bajo el NIT 222222222 (Cuantías Menores).</li>
                <li><strong>Tope de retenciones (F1001):</strong> Los montos de retención atribuibles a Cuantías Menores asumen por defecto el concepto 5016, evitando rechazos en el prevalidador.</li>
              </ul>

              <h4 style={{ color: JA.NAVY, marginTop: '20px', marginBottom: '10px', fontSize: '15px' }}>3. Cálculos y Resoluciones Automáticas</h4>
              <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li><strong>Municipios:</strong> Aquellos terceros nacionales (Colombia) que carezcan de código de municipio en el balance importado heredarán automáticamente el código del Declarante.</li>
                <li><strong>Dígitos de Verificación (DV):</strong> Calculado algorítmicamente bajo la fórmula oficial Módulo 11 de la DIAN. El motor detecta DVs faltantes o erróneos y sugiere/aplica el dígito exacto.</li>
                <li><strong>Excepciones y Auditoría:</strong> Todo registro sin regla o con inconsistencia no se asume aleatoriamente; el sistema lo aísla en el Centro de Excepciones para resolución del Contador.</li>
              </ul>
              
              <div style={{ marginTop: '30px', padding: '16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '13px', color: '#9A7D0A' }}>
                <strong>Nota de Responsabilidad:</strong> El software realiza los cálculos y transformaciones técnicas automatizadas conforme al balance ingresado. Sin embargo, la revisión final, el análisis lógico-tributario y la presentación formal ante la DIAN son responsabilidad del Contador Público y/o Revisor Fiscal a cargo de la organización.
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${JA.BORDER}`, background: '#FAFAF8', textAlign: 'right' }}>
              <button onClick={() => setAbierto(false)} style={{ padding: '10px 20px', background: JA.NAVY, color: JA.WHITE, border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
