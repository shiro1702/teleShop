import { serverSupabaseServiceRole } from '#supabase/server'

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`

async function telegram(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Telegram ${method}: ${res.status} ${text}`)
  }
  return res.json()
}

type CallbackKind = 'status' | 'delay'
type ChatLinkTokenRow = {
  token: string
  shop_id: string
  restaurant_id: string
  expires_at: string
  used_at: string | null
}

function parseCallbackData(
  data: string,
): { kind: CallbackKind; status: 'work' | 'courier' | 'done'; userId: string; orderId: string } | null {
  const parts = data.split('_')
  if (parts.length !== 3) return null
  const [rawStatus, userId, orderId] = parts
  if (!rawStatus || !userId || !orderId) return null

  // Обычные статусы
  if (rawStatus === 'work' || rawStatus === 'courier' || rawStatus === 'done') {
    return { kind: 'status', status: rawStatus, userId, orderId }
  }

  // Отдельные callback'и для задержек:
  // delayWork_userId_orderId → задержка на этапе "work"
  // delayCourier_userId_orderId → задержка на этапе "courier"
  if (rawStatus === 'delayWork') {
    return { kind: 'delay', status: 'work', userId, orderId }
  }
  if (rawStatus === 'delayCourier') {
    return { kind: 'delay', status: 'courier', userId, orderId }
  }

  return null
}

function parseBindToken(text: string): string | null {
  const trimmed = text.trim()
  const [first = '', second = ''] = trimmed.split(/\s+/, 2)
  const command = first.toLowerCase()
  if (command === '/bind' || command.startsWith('/bind@')) {
    return second ? second.trim() : null
  }
  if (command.startsWith('/bind_')) {
    const token = first.slice('/bind_'.length)
    return token ? token.trim() : null
  }
  return null
}

const CLIENT_MESSAGES: Record<'work' | 'courier' | 'done', (orderId: string) => string> = {
  work: (orderId) =>
    `👨‍🍳 Ваш заказ #${orderId} принят в работу. Кухня уже готовит ваш заказ.`,
  courier: (orderId) =>
    `🚚 Ваш заказ #${orderId} передан курьеру и уже в пути.`,
  done: (orderId) =>
    `✅ Ваш заказ #${orderId} доставлен. Спасибо, что выбрали нас! Приятного аппетита 🥘🍣🍜`,
}

const CLIENT_DELAY_MESSAGES: Record<Exclude<'work' | 'courier' | 'done', 'done'>, (orderId: string) => string> = {
  work: (orderId) =>
    `⏱ Небольшая задержка по заказу #${orderId}: кухня готовит ваше блюдо чуть дольше обычного. Спасибо за ожидание 👨‍🍳👩‍🍳`,
  courier: (orderId) =>
    `⏱ Небольшая задержка по доставке заказа #${orderId}: курьер уже в пути, но может приехать чуть позже. Спасибо за терпение 🚚🚛📦`,
}

function withStatusLine(baseText: string, statusLabel: string): string {
  const lines = baseText.split('\n')
  const filtered = lines.filter((line) => !line.trim().startsWith('Статус заказа:'))
  return `${filtered.join('\n')}\n\n${statusLabel}`
}

function appendOrderDetails(baseText: string, details: {
  branchName: string
  branchAddress: string
  orderTotal: number
  deliveryCost: number
}): string {
  const rub = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
  return [
    baseText,
    '',
    `🏪 Филиал: ${details.branchName}`,
    `📍 Адрес филиала: ${details.branchAddress}`,
    `💰 Доставка: ${rub(details.deliveryCost)}`,
    `💳 Итого: ${rub(details.orderTotal)}`,
  ].join('\n')
}

type LinkContextPayload = {
  shop_slug?: string
  city_slug?: string
  redirect_path?: string
  custom_domain_hostname?: string | null
}

function buildLinkTelegramUrlFromTokenRow(options: {
  appUrlBase: string
  defaultCitySlug: string
  token: string
  bridgePayload: Record<string, unknown> | null | undefined
  tenantShop?: { slug?: string; custom_domain?: string | null }
}): string {
  const raw = (options.bridgePayload?.link_context || {}) as LinkContextPayload
  const baseApp = options.appUrlBase.replace(/\/$/, '')
  let baseUrl = baseApp
  const host = raw.custom_domain_hostname && String(raw.custom_domain_hostname).trim()
  if (host) {
    const clean = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    baseUrl = `https://${clean}`
  } else {
    const city =
      (raw.city_slug && String(raw.city_slug).trim()) || options.defaultCitySlug
    const shopSlug =
      (raw.shop_slug && String(raw.shop_slug).trim()) ||
      (options.tenantShop?.slug && String(options.tenantShop.slug).trim()) ||
      ''
    if (shopSlug) {
      baseUrl = `${baseApp}/${encodeURIComponent(city)}/${encodeURIComponent(shopSlug)}`
    }
  }
  const redirectPath =
    typeof raw.redirect_path === 'string' && raw.redirect_path.startsWith('/') && !raw.redirect_path.startsWith('//')
      ? raw.redirect_path
      : '/cart'
  const shopId =
    (raw.shop_slug && String(raw.shop_slug).trim()) ||
    (options.tenantShop?.slug && String(options.tenantShop.slug).trim()) ||
    ''
  const q = new URLSearchParams()
  q.set('token', options.token)
  q.set('redirect', redirectPath)
  if (shopId) q.set('shop_id', shopId)
  return `${baseUrl}/link-telegram?${q.toString()}`
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const tenant = event.context.tenant
  const botToken = tenant?.telegramBotToken || (config.botToken as string)
  const appUrlBase = ((config.appUrl as string) || '').replace(/\/$/, '')
  const defaultCitySlug = (
    typeof config.public?.defaultCitySlug === 'string' && config.public.defaultCitySlug.trim()
      ? config.public.defaultCitySlug.trim()
      : 'ulan-ude'
  )
  const appUrl = tenant?.shop?.custom_domain
    ? `https://${tenant.shop.custom_domain}`
    : tenant?.shop?.slug
      ? `${appUrlBase}/${encodeURIComponent(tenant.shop.slug)}`
      : appUrlBase

  if (!botToken) {
    throw createError({ statusCode: 500, message: 'Server config: bot token missing' })
  }

  const body = await readBody<{
    message?: {
      text?: string
      chat?: { id: number; type?: string }
      from?: { id?: number }
    }
    callback_query?: {
      id: string
      from: { id: number }
      message?: { chat: { id: number }; message_id: number; text?: string }
      data?: string
    }
  }>(event)

  if (!body) {
    throw createError({ statusCode: 400, message: 'Expected Telegram update body' })
  }

  // Команды /start, /login и другие текстовые команды
  if (body.message?.text) {
    const chatId = body.message.chat?.id
    if (chatId === undefined) return { ok: true }

    const text = (body.message.text || '').trim()
    const [commandRaw, paramRaw] = text.split(' ')
    const isStart = commandRaw === '/start' || commandRaw.startsWith('/start@')
    const isLogin = commandRaw === '/login' || commandRaw.startsWith('/login@')

    if (isStart) {
      const startParam = paramRaw || ''
      const appUrlBase = ((config.appUrl as string) || '').replace(/\/$/, '')

      const linkSessionMatch = /^link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
        startParam,
      )
      if (linkSessionMatch && appUrlBase) {
        const tokenUuid = linkSessionMatch[1]
        const supabase = await serverSupabaseServiceRole(event)
        const { data: row, error: fetchErr } = await supabase
          .from('auth_tokens')
          .select('token, telegram_id, expires_at, bridge_payload, channel')
          .eq('token', tokenUuid)
          .maybeSingle()

        if (fetchErr) {
          console.error('link_ session fetch:', fetchErr)
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Не удалось проверить ссылку. Попробуйте позже.',
          })
          return { ok: true }
        }

        if (!row || String((row as { channel?: string }).channel || 'telegram') !== 'telegram') {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Ссылка недействительна или устарела. Запросите вход на сайте ещё раз.',
          })
          return { ok: true }
        }

        const expiresAt = new Date(String((row as { expires_at?: string }).expires_at)).getTime()
        if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
          await supabase.from('auth_tokens').delete().eq('token', tokenUuid)
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Срок ссылки истёк. Вернитесь на сайт и запросите вход снова.',
          })
          return { ok: true }
        }

        const existingTg = (row as { telegram_id?: number | null }).telegram_id
        if (existingTg != null && existingTg !== chatId) {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Эта ссылка уже была использована в другом Telegram-аккаунте. Запросите новую на сайте.',
          })
          return { ok: true }
        }

        if (existingTg == null) {
          const { data: updated, error: updErr } = await supabase
            .from('auth_tokens')
            .update({ telegram_id: chatId })
            .eq('token', tokenUuid)
            .is('telegram_id', null)
            .select('token')
            .maybeSingle()

          if (updErr) {
            console.error('link_ session update:', updErr)
            await telegram(botToken, 'sendMessage', {
              chat_id: chatId,
              text: 'Не удалось подтвердить вход. Попробуйте позже.',
            })
            return { ok: true }
          }

          if (!updated) {
            const { data: again } = await supabase
              .from('auth_tokens')
              .select('telegram_id')
              .eq('token', tokenUuid)
              .maybeSingle()
            const rid = (again as { telegram_id?: number | null } | null)?.telegram_id
            if (rid != null && rid !== chatId) {
              await telegram(botToken, 'sendMessage', {
                chat_id: chatId,
                text: 'Эта ссылка уже была использована в другом Telegram-аккаунте. Запросите новую на сайте.',
              })
              return { ok: true }
            }
          }
        }

        const bridgePayload = (row as { bridge_payload?: Record<string, unknown> }).bridge_payload
        const link = buildLinkTelegramUrlFromTokenRow({
          appUrlBase,
          defaultCitySlug,
          token: tokenUuid,
          bridgePayload: bridgePayload ?? null,
          tenantShop: tenant?.shop,
        })

        const replyMarkup = {
          inline_keyboard: [
            [{ text: 'Привязать аккаунт и открыть сайт', url: link }],
            [{ text: 'Скопировать ссылку для браузера', copy_text: { text: link } }],
          ],
        }

        try {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: [
              '✅ Telegram подтверждён.',
              '',
              'Вернитесь на сайт — вход завершится автоматически. Если страница не обновилась, нажмите кнопку «Привязать аккаунт…» или скопируйте ссылку и откройте её в браузере.',
            ].join('\n'),
            reply_markup: replyMarkup,
          })
        } catch (e) {
          console.warn('sendMessage with copy_text failed, retrying without copy button:', e)
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: [
              '✅ Telegram подтверждён.',
              '',
              'Вернитесь на сайт. Если вход не завершился, откройте ссылку:',
              link,
            ].join('\n'),
            reply_markup: {
              inline_keyboard: [[{ text: 'Открыть сайт для завершения входа', url: link }]],
            },
          })
        }
        return { ok: true }
      }

      const startParts = startParam.split('_')
      const startKey = startParts.slice(0, 2).join('_')

      if (startKey === 'linkchat') {
        const token = startParts.slice(1).join('_').trim()
        if (!token) {
          await telegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: 'Не удалось прочитать токен привязки. Сгенерируйте ссылку заново в кабинете.',
          })
          return { ok: true }
        }
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: [
            'Токен привязки получен.',
            'Теперь добавьте меня в нужную группу менеджеров и отправьте там команду:',
            `/bind ${token}`,
            '',
            'Привязку может завершить только администратор этой группы.',
          ].join('\n'),
        })
        return { ok: true }
      }

      // Обычный /start без параметров — приветствие и кнопка Web App
      if (!startParam) {
        const replyMarkup = appUrl
          ? {
              inline_keyboard: [[{ text: 'Открыть магазин', web_app: { url: appUrl } }]],
            }
          : undefined
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Добро пожаловать! Нажмите кнопку ниже, чтобы открыть магазин.',
          reply_markup: replyMarkup,
        })
        return { ok: true }
      }

      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: [
          'Чтобы войти на сайт, откройте магазин в браузере и нажмите «Войти через Telegram».',
          'Сайт создаст одноразовую ссылку — откройте её здесь, в чате с ботом.',
        ].join('\n'),
      })
      return { ok: true }
    }
    if (isLogin) {
      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: [
          'Вход выполняется через сайт.',
          'Откройте магазин в браузере и нажмите «Войти через Telegram» — вам откроется этот бот с готовой ссылкой.',
        ].join('\n'),
      })
      return { ok: true }
    }
    const bindToken = parseBindToken(text)
    if (bindToken) {
      const fromId = body.message.from?.id
      const chatType = (body.message.chat?.type || '').toLowerCase()
      const isGroupChat = chatType === 'group' || chatType === 'supergroup'

      if (!isGroupChat) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Команда /bind работает только в группе. Отправьте её в чате менеджеров.',
        })
        return { ok: true }
      }
      if (!fromId) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Не удалось определить пользователя. Повторите команду позже.',
        })
        return { ok: true }
      }

      const supabase = await serverSupabaseServiceRole(event)
      const { data: tokenRow } = await supabase
        .from('telegram_chat_link_tokens')
        .select('token,shop_id,restaurant_id,expires_at,used_at')
        .eq('token', bindToken)
        .maybeSingle<ChatLinkTokenRow>()

      if (!tokenRow) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Токен привязки не найден. Сгенерируйте новую ссылку в кабинете.',
        })
        return { ok: true }
      }
      if (tokenRow.used_at) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Этот токен уже использован. Сгенерируйте новый в кабинете.',
        })
        return { ok: true }
      }
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Токен истек. Сгенерируйте новый в кабинете.',
        })
        return { ok: true }
      }

      const memberResult = await telegram(botToken, 'getChatMember', {
        chat_id: chatId,
        user_id: fromId,
      }).catch(() => null) as { result?: { status?: string } } | null
      const memberStatus = String(memberResult?.result?.status || '').toLowerCase()
      if (!(memberStatus === 'administrator' || memberStatus === 'creator')) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Только администратор группы может выполнить привязку.',
        })
        return { ok: true }
      }

      const chatIdValue = String(chatId)
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('manager_group_chat_id', chatIdValue)
        .neq('id', tokenRow.restaurant_id)
        .maybeSingle<{ id: string }>()
      if (existingRestaurant?.id) {
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Этот чат уже привязан к другому ресторану.',
        })
        return { ok: true }
      }

      const { data: updatedRestaurant, error: updateError } = await supabase
        .from('restaurants')
        .update({ manager_group_chat_id: chatIdValue })
        .eq('id', tokenRow.restaurant_id)
        .eq('shop_id', tokenRow.shop_id)
        .select('name')
        .maybeSingle<{ name: string }>()

      if (updateError || !updatedRestaurant) {
        console.error('Bind chat update restaurant failed:', updateError)
        await telegram(botToken, 'sendMessage', {
          chat_id: chatId,
          text: 'Не удалось сохранить привязку чата. Попробуйте еще раз.',
        })
        return { ok: true }
      }

      await supabase
        .from('telegram_chat_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', bindToken)
        .is('used_at', null)

      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: `Чат успешно привязан к ресторану "${updatedRestaurant.name}".`,
      })
      return { ok: true }
    }
    if (text === '/help') {
      await telegram(botToken, 'sendMessage', {
        chat_id: chatId,
        text: 'Поддержка: свяжитесь с нами в чате или по контактам, указанным в описании бота.',
      })
      return { ok: true }
    }
    return { ok: true }
  }

  // Нажатие inline-кнопки менеджером (callback_query)
  const query = body.callback_query
  if (!query?.data || !query.message) {
    return { ok: true }
  }

  const parsed = parseCallbackData(query.data)
  if (query.data.startsWith('clientDelay_')) {
    const orderId = query.data.slice('clientDelay_'.length).trim()
    if (!orderId) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Некорректный сигнал', show_alert: false })
      return { ok: true }
    }
    const supabase = await serverSupabaseServiceRole(event)
    const signalKey = `client_delay_signal:${orderId}:${query.from.id}`
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: existingSignal } = await supabase
      .from('notification_events')
      .select('id,updated_at')
      .eq('notification_key', signalKey)
      .gte('updated_at', fiveMinutesAgo)
      .maybeSingle()
    if (existingSignal?.id) {
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Сигнал уже отправлен недавно, повторите чуть позже',
        show_alert: false,
      })
      return { ok: true }
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id,order_number,shop_id,restaurant_id,customer_telegram_id')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) {
      await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id, text: 'Заказ не найден', show_alert: false })
      return { ok: true }
    }
    const { data: branch } = await supabase
      .from('restaurants')
      .select('name,manager_group_chat_id')
      .eq('id', (order as any).restaurant_id)
      .maybeSingle()
    const managerChatId = typeof (branch as any)?.manager_group_chat_id === 'string' ? String((branch as any).manager_group_chat_id).trim() : ''
    if (!managerChatId) {
      await telegram(botToken, 'answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Чат менеджеров не настроен',
        show_alert: true,
      })
      return { ok: true }
    }

    await telegram(botToken, 'sendMessage', {
      chat_id: managerChatId,
      text: [
        '⚠️ Клиент сообщил о задержке',
        `📦 Заказ #${String((order as any).order_number || orderId)}`,
        `🏪 Филиал: ${String((branch as any)?.name || '—')}`,
        `👤 Клиент: id:${query.from.id}`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [[{ text: '✉️ Написать клиенту', url: `tg://user?id=${query.from.id}` }]],
      },
    })

    await supabase.from('notification_events').upsert({
      notification_key: signalKey,
      event_type: 'ORDER_STATUS_CHANGED',
      channel: 'telegram',
      shop_id: (order as any).shop_id,
      restaurant_id: (order as any).restaurant_id,
      conversation_id: managerChatId,
      delivery_status: 'sent',
      attempt_count: 1,
      payload: { orderId, fromTelegramId: query.from.id, source: 'client_delay_signal' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'notification_key' })

    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Сигнал отправлен менеджеру ресторана',
      show_alert: false,
    })
    return { ok: true }
  }
  if (!parsed) {
    await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
    return { ok: true }
  }

  const { kind, status, userId, orderId } = parsed
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const currentText = query.message.text || ''

  const supabase = await serverSupabaseServiceRole(event)
  const { data: orderDetails } = await supabase
    .from('orders')
    .select('total,delivery_cost,restaurant_id')
    .eq('id', orderId)
    .maybeSingle()
  const { data: branch } = (orderDetails as any)?.restaurant_id
    ? await supabase.from('restaurants').select('name,address').eq('id', (orderDetails as any).restaurant_id).maybeSingle()
    : { data: null as any }
  const enrichedText = (base: string) => appendOrderDetails(base, {
    branchName: String((branch as any)?.name || '—'),
    branchAddress: String((branch as any)?.address || '—'),
    orderTotal: Number((orderDetails as any)?.total || 0),
    deliveryCost: Number((orderDetails as any)?.delivery_cost || 0),
  })

  if (kind === 'delay') {
    const baseStatus: 'work' | 'courier' = status === 'courier' ? 'courier' : 'work'
    const clientDelayText = CLIENT_DELAY_MESSAGES[baseStatus]?.(orderId)
    if (clientDelayText) {
      await telegram(botToken, 'sendMessage', {
        chat_id: Number(userId),
        text: enrichedText(clientDelayText),
      }).catch((err) => console.error('Notify client delay error:', err))
    }

    await telegram(botToken, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Информация о задержке отправлена клиенту',
      show_alert: false,
    })
    return { ok: true }
  }

  // kind === 'status'
  const clientText = CLIENT_MESSAGES[status]?.(orderId)
  if (clientText) {
    await telegram(botToken, 'sendMessage', {
      chat_id: Number(userId),
      text: enrichedText(clientText),
      reply_markup: status === 'done'
        ? undefined
        : { inline_keyboard: [[{ text: '⏱ Сообщить о задержке', callback_data: `clientDelay_${orderId}` }]] },
    }).catch((err) => console.error('Notify client error:', err))
  }

  let updatedText = currentText
  if (status === 'work') {
    updatedText = withStatusLine(currentText, '🟡 Статус заказа: принят в работу')
    const nextData = `courier_${userId}_${orderId}`
    const delayData = `delayWork_${userId}_${orderId}`
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: updatedText,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚚 Передать курьеру', callback_data: nextData },
            { text: '⏱ Задержка (кухня)', callback_data: delayData },
          ],
          [
            { text: '✉️ Написать клиенту', url: `tg://user?id=${userId}` },
          ],
        ],
      },
    })
  } else if (status === 'courier') {
    updatedText = withStatusLine(currentText, '🟠 Статус заказа: передан курьеру')
    const nextData = `done_${userId}_${orderId}`
    const delayData = `delayCourier_${userId}_${orderId}`
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: updatedText,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Доставлен', callback_data: nextData },
            { text: '⏱ Задержка (доставка)', callback_data: delayData },
          ],
          [
            { text: '✉️ Написать клиенту', url: `tg://user?id=${userId}` },
          ],
        ],
      },
    })
  } else {
    // done — кнопки убираем, добавляем финальный статус
    const finalText = withStatusLine(currentText, '🟢 Статус заказа: доставлен клиенту ✅')
    await telegram(botToken, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: finalText,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✉️ Написать клиенту', url: `tg://user?id=${userId}` },
          ],
        ],
      },
    })
  }

  await telegram(botToken, 'answerCallbackQuery', { callback_query_id: query.id })
  return { ok: true }
})
