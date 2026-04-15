'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingCart, TrendingUp, DollarSign } from 'lucide-react'
import { useClient } from '../ClientContext'

export default function SalesPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return <div className="p-8 text-[#EAECEF] flex items-center gap-3 font-sans">
            <div className="w-5 h-5 border-2 border-[#F0B90B] border-t-transparent rounded-full animate-spin"></div>
            Cargando Ventas...
        </div>
    }

    // Calcular ticket promedio usando valores numéricos puros
    const rawSales = clientData.metrics.sales.rawValue
    const totalInvoices = clientData.metrics.productsSold.rawValue || 1
    const avgTicket = rawSales / totalInvoices

    return (
        <div className="space-y-6 animate-in fade-in duration-700 font-sans">
            <div>
                <h1 className="text-3xl font-bold text-[#EAECEF]">Ventas</h1>
                <p className="text-[#848E9C] mt-2">
                    Gestión y análisis de transacciones reales de Google Sheets
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-[#1E2329] border-[#2B3139] hover:border-[#F0B90B] transition-colors shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[#848E9C]">Ventas Totales</CardTitle>
                        <DollarSign className="w-4 h-4 text-[#F0B90B]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#EAECEF]">{clientData.metrics.sales.value}</div>
                        <p className={`text-xs ${clientData.metrics.sales.trend === 'up' ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>
                            {clientData.metrics.sales.trend === 'up' ? '+' : ''}{clientData.metrics.sales.change}% {clientData.metrics.sales.changeLabel}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E2329] border-[#2B3139] hover:border-[#0ECB81] transition-colors shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[#848E9C]">Órdenes (Facturas)</CardTitle>
                        <ShoppingCart className="w-4 h-4 text-[#0ECB81]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#EAECEF]">{clientData.metrics.productsSold.value}</div>
                        <p className="text-xs text-[#0ECB81]">Filas procesadas este mes</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E2329] border-[#2B3139] hover:border-white/20 transition-colors shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-[#848E9C]">Ticket Promedio</CardTitle>
                        <TrendingUp className="w-4 h-4 text-[#F0B90B]" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#EAECEF]">
                            ${Math.round(avgTicket).toLocaleString('es-CO')}
                        </div>
                        <p className="text-xs text-[#848E9C]">Valor medio por factura</p>
                    </CardContent>
                </Card>
            </div>

            {/* Clientes Recurrentes y Productos Top */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-[#1E2329] border-[#2B3139] shadow-xl overflow-hidden">
                    <CardHeader className="border-b border-[#2B3139]">
                        <CardTitle className="text-[#EAECEF] flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-[#F0B90B]" />
                            Clientes Recurrentes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-[#2B3139]">
                            {clientData.recurringCustomers.length > 0 ? (
                                clientData.recurringCustomers.map((customer, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-[#2B3139]/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#F0B90B]/10 flex items-center justify-center">
                                                <TrendingUp className="w-4 h-4 text-[#F0B90B]" />
                                            </div>
                                            <div>
                                                <p className="text-[#EAECEF] font-medium text-sm">{customer.name}</p>
                                                <p className="text-[#848E9C] text-xs">{customer.count} compras</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[#0ECB81] font-bold">COP ${Math.round(customer.total).toLocaleString('es-CO')}</p>
                                            <p className="text-[#848E9C] text-[10px]">TOTAL ACUMULADO</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-[#848E9C]">No hay datos de frecuencia suficientes.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E2329] border-[#2B3139] shadow-xl overflow-hidden">
                    <CardHeader className="border-b border-[#2B3139]">
                        <CardTitle className="text-[#EAECEF] flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-[#0ECB81]" />
                            Productos más Vendidos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-[#2B3139]">
                            {clientData.topProducts.length > 0 ? (
                                clientData.topProducts.map((product, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 hover:bg-[#2B3139]/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#0ECB81]/10 flex items-center justify-center">
                                                <ShoppingCart className="w-4 h-4 text-[#0ECB81]" />
                                            </div>
                                            <div>
                                                <p className="text-[#EAECEF] font-medium text-sm truncate max-w-[200px]">{product.name}</p>
                                                <p className="text-[#848E9C] text-xs">{product.count} vendidos</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[#F0B90B] font-bold">COP ${Math.round(product.total).toLocaleString('es-CO')}</p>
                                            <p className="text-[#848E9C] text-[10px]">VENTAS TOTALES</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-[#848E9C]">No se encontraron detalles de productos.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
