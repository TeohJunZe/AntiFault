// Document parser for extracting order data from uploaded files
import * as XLSX from 'xlsx'

export interface ParsedOrderData {
  quantity?: string
  deadline?: string
  productType?: string
  sellingPrice?: string
  extractedFields: string[] // which fields were extracted
  allOrders: ParsedOrderRow[] // all rows found
  selectedIndex: number // which row is currently selected
}

export interface ParsedOrderRow {
  orderId?: string
  quantity?: string
  deadline?: string
  productType?: string
  sellingPrice?: string
  customer?: string
  priority?: string
}

// Column header keyword mappings
const QUANTITY_KEYWORDS = ['quantity', 'qty', 'amount', 'units', 'order quantity', 'order qty']
const DATE_KEYWORDS = ['deadline', 'date', 'due date', 'delivery date', 'due', 'delivery', 'target date']
const PRODUCT_KEYWORDS = ['product', 'product type', 'type', 'item', 'category', 'part type', 'product name']
const PRICE_KEYWORDS = ['price', 'unit price', 'price per unit', 'cost', 'rate', 'price/unit', 'selling price', 'price per unit (rm)']
const ORDER_ID_KEYWORDS = ['order id', 'order no', 'order number', 'id', 'ref', 'reference']
const CUSTOMER_KEYWORDS = ['customer', 'client', 'buyer', 'company']
const PRIORITY_KEYWORDS = ['priority', 'urgency', 'level']

// Product type value mappings
const PRODUCT_TYPE_MAP: Record<string, string> = {
  'standard': 'standard',
  'standard parts': 'standard',
  'precision': 'precision',
  'precision components': 'precision',
  'heavy': 'heavy',
  'heavy machinery': 'heavy',
  'heavy machinery parts': 'heavy',
  'electronics': 'electronics',
  'electronic': 'electronics',
  'electronic assemblies': 'electronics',
  'custom': 'custom',
  'custom orders': 'custom',
  'custom order': 'custom',
}

function matchColumn(header: string, keywords: string[]): boolean {
  const h = header.toLowerCase().trim()
  return keywords.some(k => h === k || h.includes(k))
}

function normalizeProductType(raw: string): string {
  const lower = raw.toLowerCase().trim()
  return PRODUCT_TYPE_MAP[lower] || ''
}

function normalizeDate(raw: string): string {
  // Try to parse various date formats
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0] // YYYY-MM-DD
  }
  // Try DD/MM/YYYY
  const parts = raw.split(/[\/\-\.]/)
  if (parts.length === 3) {
    const [a, b, c] = parts
    if (Number(a) > 31) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}` // YYYY-MM-DD
    if (Number(c) > 31) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}` // DD-MM-YYYY -> YYYY-MM-DD
  }
  return raw
}

function extractPrice(raw: string): string {
  // Remove currency symbols and extract number
  const num = raw.replace(/[^\d.]/g, '')
  return num || raw
}

export async function parseDocument(file: File): Promise<ParsedOrderData | null> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    return parseCSV(file)
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(file)
  }

  return null
}

async function parseCSV(file: File): Promise<ParsedOrderData | null> {
  const text = await file.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) return null

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    // Handle quoted CSV values
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += char
    }
    values.push(current.trim())
    return values
  })

  return mapRowsToOrders(headers, rows)
}

async function parseExcel(file: File): Promise<ParsedOrderData | null> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })

  if (jsonData.length < 2) return null

  const headers = (jsonData[0] as string[]).map(h => String(h).trim())
  const rows = jsonData.slice(1).map(row => (row as string[]).map(v => String(v ?? '').trim()))

  return mapRowsToOrders(headers, rows)
}

function mapRowsToOrders(headers: string[], rows: string[][]): ParsedOrderData {
  // Map column indices
  const colMap: Record<string, number> = {}

  headers.forEach((h, i) => {
    if (matchColumn(h, QUANTITY_KEYWORDS)) colMap.quantity = i
    else if (matchColumn(h, DATE_KEYWORDS)) colMap.deadline = i
    else if (matchColumn(h, PRODUCT_KEYWORDS)) colMap.productType = i
    else if (matchColumn(h, PRICE_KEYWORDS)) colMap.sellingPrice = i
    else if (matchColumn(h, ORDER_ID_KEYWORDS)) colMap.orderId = i
    else if (matchColumn(h, CUSTOMER_KEYWORDS)) colMap.customer = i
    else if (matchColumn(h, PRIORITY_KEYWORDS)) colMap.priority = i
  })

  const allOrders: ParsedOrderRow[] = rows
    .filter(row => row.some(v => v.length > 0))
    .map(row => {
      const order: ParsedOrderRow = {}
      if (colMap.orderId !== undefined) order.orderId = row[colMap.orderId]
      if (colMap.quantity !== undefined) order.quantity = row[colMap.quantity]?.replace(/[^\d]/g, '')
      if (colMap.deadline !== undefined) order.deadline = normalizeDate(row[colMap.deadline])
      if (colMap.productType !== undefined) order.productType = normalizeProductType(row[colMap.productType])
      if (colMap.sellingPrice !== undefined) order.sellingPrice = extractPrice(row[colMap.sellingPrice])
      if (colMap.customer !== undefined) order.customer = row[colMap.customer]
      if (colMap.priority !== undefined) order.priority = row[colMap.priority]
      return order
    })

  if (allOrders.length === 0) {
    return { extractedFields: [], allOrders: [], selectedIndex: 0 }
  }

  // Select first order by default
  const first = allOrders[0]
  const extractedFields: string[] = []
  if (first.quantity) extractedFields.push('quantity')
  if (first.deadline) extractedFields.push('deadline')
  if (first.productType) extractedFields.push('productType')
  if (first.sellingPrice) extractedFields.push('sellingPrice')

  return {
    quantity: first.quantity,
    deadline: first.deadline,
    productType: first.productType,
    sellingPrice: first.sellingPrice,
    extractedFields,
    allOrders,
    selectedIndex: 0,
  }
}
