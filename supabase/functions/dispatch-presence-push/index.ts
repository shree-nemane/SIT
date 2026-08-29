import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, any> | null;
  old_record: Record<string, any> | null;
}

/**
 * Generate Google OAuth2 access token for FCM HTTP v1 using native Deno Web Crypto API
 */
async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const cleanKey = privateKeyPem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binaryKey = Uint8Array.from(atob(cleanKey), (c) => c.charCodeAt(0));

  const importedKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    importedKey,
    new TextEncoder().encode(unsignedToken)
  );

  const base64UrlSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${base64UrlSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Google OAuth2 authentication failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin');
  const allowedOriginEnv = Deno.env.get('ALLOWED_ORIGIN');
  const supabaseUrlEnv = Deno.env.get('SUPABASE_URL');

  let isAllowed = false;

  if (origin) {
    try {
      const parsedOrigin = new URL(origin);

      // 1. Exact configured application origin (ALLOWED_ORIGIN)
      if (allowedOriginEnv) {
        try {
          if (parsedOrigin.origin === new URL(allowedOriginEnv).origin) {
            isAllowed = true;
          }
        } catch {
          // console.error('[CORS] Invalid ALLOWED_ORIGIN configuration');
        }
      }

      // 2. Exact Supabase project origin (SUPABASE_URL)
      if (!isAllowed && supabaseUrlEnv) {
        try {
          if (parsedOrigin.origin === new URL(supabaseUrlEnv).origin) {
            isAllowed = true;
          }
        } catch {
          // console.error('[CORS] Invalid SUPABASE_URL configuration');
        }
      }
    } catch {
      isAllowed = false;
    }
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-webhook-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };

  // Fail closed: only emit ACAO for the requesting origin when that exact origin has been authorized.
  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
    const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
      // console.error('[FCM Dispatcher] Missing Firebase service account secrets');
      return new Response(
        JSON.stringify({ success: false, error: 'Firebase configuration incomplete on server' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      // console.error('[FCM Dispatcher] Missing Supabase service credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase configuration incomplete on server' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    const incomingSecret = req.headers.get('x-webhook-secret');
    const incomingAuth = req.headers.get('authorization');

    if (webhookSecret) {
      if (incomingSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized webhook request' }),
          { status: 401, headers: corsHeaders }
        );
      }
    } else if (!incomingAuth || !incomingAuth.includes(supabaseServiceKey)) {
      // Fail-closed in production if neither WEBHOOK_SECRET nor service_role key matches
      // console.warn('[FCM Dispatcher] Request received without WEBHOOK_SECRET or service_role authorization');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized dispatcher access' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const body: WebhookPayload = await req.json();
    const { table, type, record, old_record } = body;

    const activeRecord = type === 'DELETE' ? old_record : (record || old_record);

    if (!activeRecord) {
      return new Response(
        JSON.stringify({ success: false, reason: 'empty_record' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let actorUserId: string | null = null;
    let groupId: string | null = null;
    let reason = type === 'DELETE' ? 'PRESENCE_DELETED' : 'PRESENCE_UPDATE';

    let presenceId: string | null = null;
    let actorName: string | null = null;
    let presenceDescription: string | null = null;

    if (table === 'presences') {
      actorUserId = activeRecord.member_id;
      presenceId = activeRecord.id ? String(activeRecord.id) : null;
      if (type !== 'DELETE') {
        presenceDescription = activeRecord.description || null;
        reason = 'MEMBER_CHECKIN';
      } else {
        reason = 'PRESENCE_DELETED';
      }

      const { data: memberData } = await supabaseAdmin
        .from('members')
        .select('group_id, display_name')
        .eq('id', actorUserId)
        .maybeSingle();

      if (memberData) {
        groupId = memberData.group_id;
        actorName = memberData.display_name;
      }
    } else if (table === 'members') {
      actorUserId = activeRecord.id;
      groupId = activeRecord.group_id;
      actorName = activeRecord.display_name;
      reason = 'PROFILE_UPDATE';
    }

    if (!actorUserId || !groupId) {
      // console.warn('[FCM Dispatcher] Event missing actorUserId or groupId, aborting dispatch');
      return new Response(
        JSON.stringify({ success: false, reason: 'unresolved_group_or_actor' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const { data: coMembers } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('group_id', groupId)
      .neq('id', actorUserId);

    if (!coMembers || coMembers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, deliveredCount: 0, reason: 'no_co_members' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const coMemberIds = coMembers.map((m) => m.id);

    const { data: pushDevices } = await supabaseAdmin
      .from('push_devices')
      .select('id, token, user_id')
      .eq('is_active', true)
      .in('user_id', coMemberIds);

    if (!pushDevices || pushDevices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, deliveredCount: 0, reason: 'no_active_tokens' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const accessToken = await getGoogleAccessToken(
      firebaseClientEmail,
      firebasePrivateKey
    );

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;
    let sentCount = 0;
    let failedCount = 0;
    const deactivatedTokens: string[] = [];

    for (const device of pushDevices) {
      const fcmPayload = {
        message: {
          token: device.token,
          data: {
            version: '1',
            type: 'PRESENCE_UPDATE',
            groupId: String(groupId),
            reason: String(reason),
            actorId: String(actorUserId),
            ...(presenceId ? { presenceId: String(presenceId) } : {}),
            ...(actorName
              ? {
                  actorName: String(actorName),
                  actor_name: String(actorName),
                }
              : {}),
            ...(presenceDescription
              ? {
                  description: String(presenceDescription),
                }
              : {}),
          },
          android: {
            priority: 'HIGH',
          },
        },
      };

      try {
        const response = await fetch(fcmEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        });

        if (response.ok) {
          sentCount++;
        } else {
          failedCount++;
          const errText = await response.text();
          // console.warn(`[FCM Dispatcher] Push failed for device ID ${device.id}: HTTP ${response.status}`);

          if (
            response.status === 404 ||
            errText.includes('UNREGISTERED') ||
            errText.includes('INVALID_ARGUMENT')
          ) {
            deactivatedTokens.push(device.token);
          }
        }
      } catch (err: any) {
        failedCount++;
        // console.warn(`[FCM Dispatcher] Push network error for device ID ${device.id}:`, err?.message || err);
      }
    }

    if (deactivatedTokens.length > 0) {
      await supabaseAdmin
        .from('push_devices')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('token', deactivatedTokens);

      // console.log(`[FCM Dispatcher] Deactivated ${deactivatedTokens.length} stale push tokens.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        type,
        table,
        groupId,
        sent: sentCount,
        failed: failedCount,
        deactivated: deactivatedTokens.length,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    // console.error('[FCM Dispatcher] Edge Function error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
