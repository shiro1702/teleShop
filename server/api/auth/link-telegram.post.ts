import { defineEventHandler, readBody, createError } from 'h3';
import {
  serverSupabaseUser,
  serverSupabaseServiceRole,
} from '#supabase/server';

interface LinkTelegramBody {
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LinkTelegramBody>(event);

  if (!body?.token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token is required',
    });
  }

  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const serviceClient = await serverSupabaseServiceRole(event);

  const { data: tokenRow, error: tokenError } = await serviceClient
    .from('auth_tokens')
    .select('*')
    .eq('token', body.token)
    .maybeSingle();

  if (tokenError) {
    console.error('Error querying auth_tokens:', tokenError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check token',
    });
  }

  if (!tokenRow) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid token',
    });
  }

  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);

  if (expiresAt.getTime() < now.getTime()) {
    await serviceClient.from('auth_tokens').delete().eq('token', body.token);
    throw createError({
      statusCode: 400,
      statusMessage: 'Token expired',
    });
  }

  const telegramId: number = tokenRow.telegram_id;

  const { error: upsertError } = await serviceClient
    .from('profiles')
    .upsert(
      {
        id: user.id,
        telegram_id: telegramId,
      },
      { onConflict: 'id' },
    );

  if (upsertError) {
    console.error('Error updating profile with telegram_id:', upsertError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to link Telegram',
    });
  }

  const { error: deleteError } = await serviceClient
    .from('auth_tokens')
    .delete()
    .eq('token', body.token);

  if (deleteError) {
    console.error('Error deleting used token:', deleteError);
  }

  return {
    success: true,
    telegramId,
  };
});

