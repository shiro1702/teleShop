import { defineEventHandler, getQuery, createError } from 'h3'
import { MOCK_PRODUCTS } from '../../data/products'

interface DecodedItem {
  id: string
  quantity: number
}

function decodeItems(token: string): DecodedItem[] {
  let raw: string
  try {
    raw = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid bridge token encoding' })
  }

  if (!raw) return []

  return raw.split(',').map<DecodedItem>((chunk) => {
    const [id, qtyPart] = chunk.split('x')
    const quantity = Number(qtyPart ?? '1')
    return {
      id,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    }
  })
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''

  if (!token) {
    throw createError({ statusCode: 400, message: 'Missing token' })
  }

  const decoded = decodeItems(token)
  if (!decoded.length) {
    return { ok: true, items: [] }
  }

  const items = decoded
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

  return {
    ok: true,
    items,
  }
})

