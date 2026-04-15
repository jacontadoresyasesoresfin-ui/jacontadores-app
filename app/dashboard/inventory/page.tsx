'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, TrendingDown, AlertTriangle, Archive } from 'lucide-react'
import { useClient } from '../ClientContext'

export default function InventoryPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return <div className="p-8 text-[#EAECEF] flex items-center gap-3 font-sans">
            <div className="w-5 h-5 border-2 border-[#F0B90B] border-t-transparent rounded-full animate-spin"></div>
            Cargando Inventario...
        </div>
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700 font-sans">
            <div>
                <h1 className="text-3xl font-bold text-[#EAECEF]">Inventario (Proyección)</h1>
                <p className="text-[#848E9C] mt-2">
                    Análisis de stock basado en flujo de facturación histórica
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-[#1E2329] border-[#2B3139] hover:border-[#F0B90B] transition-colors shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[#848E9C]">Items Procesados</CardTitle>
                        <Package className="w-4 h-4 text-[#848E9C]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#EAECEF]">{clientData.metrics.productsSold.value}</div>
                        <p className="text-xs text-[#848E9C]">Basado en facturas</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E2329] border-[#2B3139] hover:border-[#0ECB81] transition-colors shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[#848E9C]">Valor Operativo</CardTitle>
                        <Archive className="w-4 h-4 text-[#0ECB81]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#EAECEF]">{clientData.metrics.sales.value}</div>
                        <p className="text-xs text-[#0ECB81]">Volumen transaccionado</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E2329] border-[#2B3139] hover:border-[#F0B90B] transition-colors shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[#848E9C]">Reposición Est.</CardTitle>
                        <TrendingDown className="w-4 h-4 text-[#F0B90B]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#F0B90B]">12</div>
                        <p className="text-xs text-[#848E9C]">Detección de baja rotación</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E2329] border-[#2B3139] hover:border-[#F6465D] transition-colors shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[#848E9C]">Agotados</CardTitle>
                        <AlertTriangle className="w-4 h-4 text-[#F6465D]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#F6465D]">3</div>
                        <p className="text-xs text-[#848E9C]">Alerta de quiebre</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-[#1E2329] border-[#2B3139] shadow-xl">
                <CardHeader>
                    <CardTitle className="text-[#EAECEF]">Inteligencia de Inventario</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="p-6 border-2 border-dashed border-[#2B3139] rounded-xl flex flex-col items-center justify-center text-center">
                            <Archive className="w-12 h-12 text-[#2B3139] mb-4" />
                            <h3 className="text-[#EAECEF] font-bold mb-2">Módulo en Sincronización</h3>
                            <p className="text-[#848E9C] text-sm max-w-md">
                                Estamos vinculando las descripciones de productos de tus facturas para generar un inventario automático basado en la rotación de ventas.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
