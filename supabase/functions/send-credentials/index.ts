import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_to, username, password, name } = await req.json();

    if (!email_to || !username || !password) {
      return new Response(
        JSON.stringify({ error: "email_to, username e password são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@universo360.com.br";

    // Also update the password in Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find user by username in profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (profile?.id) {
      await supabaseAdmin.auth.admin.updateUserById(profile.id, { password });
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credenciais de Acesso — Universo 360</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:1px;">🚀 Universo 360</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">Painel de Colaboradores</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;">Suas credenciais de acesso</h2>
              ${name ? `<p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Olá, <strong>${name}</strong>! Aqui estão seus dados de login.</p>` : '<p style="margin:0 0 24px;color:#6b7280;font-size:15px;">Aqui estão seus dados de acesso ao painel.</p>'}
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Usuário</p>
                    <p style="margin:0;color:#1a1a2e;font-size:18px;font-weight:700;font-family:monospace;">${username}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 20px;">
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Senha</p>
                    <p style="margin:0;color:#1a1a2e;font-size:18px;font-weight:700;font-family:monospace;">${password}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">Acesse o painel em <a href="https://UNV360.zlabs.com.br/admin/login" style="color:#7c3aed;text-decoration:none;font-weight:600;">UNV360.zlabs.com.br/admin/login</a> usando as credenciais acima.</p>

              <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;color:#92400e;font-size:13px;">⚠️ Por segurança, altere sua senha após o primeiro acesso.</p>
              </div>

              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Este e-mail foi enviado automaticamente. Não responda esta mensagem.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} Universo 360. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email_to],
        subject: "Suas credenciais de acesso — Universo 360",
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json();
      throw new Error(errData.message || "Erro ao enviar e-mail");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Credenciais enviadas com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
