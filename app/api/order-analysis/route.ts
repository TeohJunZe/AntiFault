import { NextResponse } from 'next/server'
import { analyzeOrder, OrderInput } from '@/lib/admin-data'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { quantity, deadline, productType, sellingPrice } = body as OrderInput

    if (!quantity || !deadline || !productType) {
      return NextResponse.json(
        { error: 'Missing required fields: quantity, deadline, productType' },
        { status: 400 }
      )
    }

    // Simulate fetching real machine health — use mock averages for demo
    const avgMachineHealth = 71 // Average across all machines
    const currentLoad = 78       // Current factory load %

    // Add realistic delay to simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500))

    const result = analyzeOrder(
      { quantity, deadline, productType, sellingPrice: sellingPrice || 15 },
      avgMachineHealth,
      currentLoad
    )

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to analyze order' },
      { status: 500 }
    )
  }
}
