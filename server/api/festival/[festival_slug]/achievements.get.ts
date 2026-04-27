import { defineEventHandler, getRouterParam } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const festivalSlug = getRouterParam(event, 'festival_slug')
  const client = await serverSupabaseClient(event)
  const serviceClient = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event)

  if (!festivalSlug) {
    return { ok: false, error: 'Festival slug is required' }
  }

  // Get festival ID using service role (bypass RLS if not public)
  const { data: festival, error: festivalError } = await serviceClient
    .from('festivals')
    .select('id')
    .eq('slug', festivalSlug)
    .single()

  if (festivalError || !festival) {
    return { ok: false, error: 'Festival not found' }
  }

  // Get all achievements for this festival
  const { data: achievements, error: achError } = await serviceClient
    .from('festival_achievements')
    .select('*')
    .eq('festival_id', festival.id)
    .order('created_at', { ascending: true })

  if (achError || !achievements) {
    return { ok: false, error: 'Could not fetch achievements' }
  }

  let userProgress: Record<string, any> = {}

  if (user) {
    // Get user progress using their own client
    const { data: progress, error: progError } = await client
      .from('user_festival_achievements')
      .select('*')
      .eq('user_id', user.id)

    if (!progError && progress) {
      userProgress = progress.reduce((acc, curr) => {
        acc[curr.achievement_id] = curr
        return acc
      }, {} as Record<string, any>)
    }
  }

  // Combine data
  const result = achievements.map((ach) => {
    const prog = userProgress[ach.id]
    return {
      id: ach.id,
      code: ach.code,
      title: ach.title,
      description: ach.description,
      maxProgress: ach.max_progress,
      points: ach.points,
      iconUrl: ach.icon_url,
      progress: prog ? prog.progress : 0,
      isCompleted: prog ? prog.is_completed : false,
      completedAt: prog ? prog.completed_at : null,
    }
  })

  return {
    ok: true,
    items: result,
  }
})
