import { defineEventHandler, getQuery, createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { MOCK_PRODUCTS } from '../../data/products'

interface DecodedItem {
  id: string
  quantity: number
}

interface ProductBridgeRow {
  id: string
  name: string
  price: number
  image: string
  description: string | null
  category: string
}

function decodeItems(token: string): { items: DecodedItem[]; shopId: string | null } {
  let raw: string
  try {
    raw = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid bridge token encoding' })
  }

  if (!raw) return { items: [], shopId: null }

  let itemsString = raw
  let shopId: string | null = null
  try {
    const parsed = JSON.parse(raw) as { i?: unknown; s?: unknown }
    if (typeof parsed?.i === 'string') {
      itemsString = parsed.i
    }
    if (typeof parsed?.s === 'string' && parsed.s.trim()) {
      shopId = parsed.s.trim()
    }
  } catch {
    // Legacy format support: raw token is "1x2,5x1"
  }

  if (!itemsString) return { items: [], shopId }

  const items = itemsString.split(',').map<DecodedItem>((chunk) => {
    const [id, qtyPart] = chunk.split('x')
    const quantity = Number(qtyPart ?? '1')
    return {
      id,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    }
  })

  return { items, shopId }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''

  if (!token) {
    throw createError({ statusCode: 400, message: 'Missing token' })
  }

  const decoded = decodeItems(token)
  if (!decoded.items.length) {
    return { ok: true, items: [] }
  }

  let items: Array<{
    id: string
    name: string
    price: number
    image: string
    description: string | null
    category: string
    quantity: number
  }> = []

  if (decoded.shopId) {
    const serviceClient = await serverSupabaseServiceRole(event)
    const ids = Array.from(new Set(decoded.items.map((item) => item.id)))
    const { data, error } = await serviceClient
      .from('products')
      .select('id,name,price,image,description,category')
      .eq('shop_id', decoded.shopId)
      .in('id', ids)

    if (error) {
      console.error('Error querying products for cart-bridge:', error)
      throw createError({ statusCode: 500, message: 'Failed to load products for bridge' })
    }

    const rows = (data ?? []) as ProductBridgeRow[]
    const byId = new Map(rows.map((row) => [row.id, row]))
    items = decoded.items
      .map((entry) => {
        const product = byId.get(entry.id)
        if (!product) return null
        return {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          description: product.description ?? null,
          category: product.category,
          quantity: entry.quantity,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  } else {
    // Legacy fallback for old bridge tokens without shop context.
    items = decoded.items
      .map((entry) => {
        const product = MOCK_PRODUCTS.find((p) => p.id === entry.id)
        if (!product) return null
        return {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          description: product.description ?? null,
          category: product.category,
          quantity: entry.quantity,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }

  return {
    ok: true,
    items,
  }
})

