import * as XLSX from 'xlsx'

export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Datos') {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const rows    = data.map(row =>
        headers.map(h => {
            const val = String(row[h] ?? '')
            return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
        }).join(',')
    )
    const csv  = '﻿' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
