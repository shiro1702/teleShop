export type ReceiptLine = {
  name: string
  quantity: number
  selectedParameters?: Array<{ optionName?: string | null }>
  selectedModifiers?: Array<{ optionName?: string | null }>
}

export type ReceiptOrder = {
  id: string
  orderNumber?: string | null
  fulfillmentType?: string | null
  createdAt?: string | null
  comment?: string | null
  items: ReceiptLine[]
}

export type PrintMode = 'rawbt' | 'browser' | 'off'
export type ReceiptWidth = 58 | 80

export type ReceiptPrintOptions = {
  widthMm?: ReceiptWidth
  shopLabel?: string | null
}

function shortId(id: string) {
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function displayOrderNumber(order: ReceiptOrder) {
  return order.orderNumber && order.orderNumber.trim() ? order.orderNumber : shortId(order.id)
}

function fulfillmentLabel(ft?: string | null) {
  const map: Record<string, string> = {
    delivery: 'Доставка',
    pickup: 'Самовывоз',
    'dine-in': 'В зале',
    'qr-menu': 'В зале · до столика',
    'showcase-order': 'В зале · на выдачу',
  }
  if (!ft) return '—'
  return map[ft] || ft
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeRawBt(value: string) {
  return value.replaceAll('[', '(').replaceAll(']', ')')
}

function lineMeta(line: ReceiptLine) {
  const params = (line.selectedParameters ?? [])
    .map((x) => (x.optionName || '').trim())
    .filter(Boolean)
  const modifiers = (line.selectedModifiers ?? [])
    .map((x) => (x.optionName || '').trim())
    .filter(Boolean)
  return [...params, ...modifiers]
}

export function buildRawBtIntent(order: ReceiptOrder, options: ReceiptPrintOptions = {}) {
  const out: string[] = []
  const orderNo = escapeRawBt(displayOrderNumber(order))
  const channel = escapeRawBt(fulfillmentLabel(order.fulfillmentType))
  const createdAt = escapeRawBt(formatDateTime(order.createdAt))
  const shopLabel = options.shopLabel ? escapeRawBt(options.shopLabel.trim()) : ''

  out.push('[C]<b>Заказ</b>')
  out.push(`[C]<font size='big'><b>${orderNo}</b></font>`)
  if (shopLabel) out.push(`[C]${shopLabel}`)
  out.push('[C]------------------------------')
  out.push(`[L]Канал:[R]${channel}`)
  out.push(`[L]Создан:[R]${createdAt}`)
  out.push('[C]------------------------------')

  for (const line of order.items || []) {
    const name = escapeRawBt((line.name || 'Без названия').trim())
    const qty = Number.isFinite(line.quantity) ? Math.max(1, Math.trunc(line.quantity)) : 1
    out.push(`[L]${name}[R]x${qty}`)
    const meta = lineMeta(line)
    if (meta.length) out.push(`[L]<small>${escapeRawBt(meta.join(', '))}</small>`)
  }

  if (order.comment && order.comment.trim()) {
    out.push('[C]------------------------------')
    out.push(`[L]Комментарий:`)
    out.push(`[L]${escapeRawBt(order.comment.trim())}`)
  }

  out.push('[C]------------------------------')
  out.push('[C]<b>TeleShop KDS</b>')

  const payload = encodeURIComponent(out.join('\n'))
  return `intent:${payload}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}

export function buildHtmlReceipt(order: ReceiptOrder, options: ReceiptPrintOptions = {}) {
  const widthMm = options.widthMm || 58
  const orderNo = escapeHtml(displayOrderNumber(order))
  const channel = escapeHtml(fulfillmentLabel(order.fulfillmentType))
  const createdAt = escapeHtml(formatDateTime(order.createdAt))
  const shopLabel = options.shopLabel ? escapeHtml(options.shopLabel.trim()) : ''
  const comment = order.comment && order.comment.trim() ? escapeHtml(order.comment.trim()) : ''

  const itemHtml = (order.items || [])
    .map((line) => {
      const name = escapeHtml((line.name || 'Без названия').trim())
      const qty = Number.isFinite(line.quantity) ? Math.max(1, Math.trunc(line.quantity)) : 1
      const meta = lineMeta(line)
      const metaHtml = meta.length
        ? `<div class="meta">${escapeHtml(meta.join(', '))}</div>`
        : ''
      return `<div class="item"><div class="main"><span>${name}</span><span>x${qty}</span></div>${metaHtml}</div>`
    })
    .join('')

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Receipt ${orderNo}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #000; }
    .ticket { width: ${widthMm}mm; padding: 3mm; font-size: 12px; line-height: 1.35; }
    .center { text-align: center; }
    .title { font-size: 14px; font-weight: 700; margin-bottom: 2mm; }
    .number { font-size: 16px; font-weight: 700; margin-bottom: 2mm; }
    .line { border-top: 1px dashed #000; margin: 2mm 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .item { margin-bottom: 2mm; }
    .main { display: flex; justify-content: space-between; gap: 6px; font-weight: 600; }
    .meta { font-size: 11px; margin-top: 1mm; }
    .comment { white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center title">Заказ</div>
    <div class="center number">${orderNo}</div>
    ${shopLabel ? `<div class="center">${shopLabel}</div>` : ''}
    <div class="line"></div>
    <div class="row"><span>Канал</span><span>${channel}</span></div>
    <div class="row"><span>Создан</span><span>${createdAt}</span></div>
    <div class="line"></div>
    ${itemHtml}
    ${
      comment
        ? `<div class="line"></div><div><b>Комментарий:</b></div><div class="comment">${comment}</div>`
        : ''
    }
    <div class="line"></div>
    <div class="center"><b>TeleShop KDS</b></div>
  </div>
</body>
</html>`
}

export function printViaBrowser(html: string) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640')
  if (!printWindow) {
    throw new Error('Браузер заблокировал окно печати')
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
