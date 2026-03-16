import { defineEventHandler, readBody, createError } from 'h3';
import { serverSupabaseServiceRole } from '#supabase/server';

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

  // Пытаемся найти существующий профиль по telegram_id (идемпотентность)
  const { data: existingProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (profileError) {
    console.error('Error querying profiles by telegram_id:', profileError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to link Telegram',
    });
  }

  let userId: string;

  if (existingProfile) {
    userId = existingProfile.id as string;
  } else {
    // Создаём нового пользователя в auth.users через сервисный ключ.
    // Используем "синтетический" email на основе telegram_id, чтобы Supabase принял пользователя.
    const syntheticEmail = `tg_${telegramId}@telegram.local`;
    const syntheticPassword = crypto.randomUUID();

    const { data: createdUser, error: createUserError } =
      await serviceClient.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramId,
        },
      });

    if (createUserError || !createdUser?.user) {
      console.error('Error creating auth user for telegram_id:', createUserError);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create user for Telegram link',
      });
    }

    userId = createdUser.user.id;

    const { error: upsertError } = await serviceClient
      .from('profiles')
      .upsert(
        {
          id: userId,
          telegram_id: telegramId,
        },
        { onConflict: 'id' },
      );

    if (upsertError) {
      console.error('Error creating profile with telegram_id:', upsertError);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to link Telegram',
      });
    }
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
    userId,
  };
});

