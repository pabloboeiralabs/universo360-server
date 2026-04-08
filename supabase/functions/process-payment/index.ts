import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API = "https://api.asaas.com/v3";
const PAGBANK_API = "https://api.pagseguro.com";
const MERCADOPAGO_API = "https://api.mercadopago.com";

interface CheckoutRequest {
  event_id: string;
  student_name: string;
  class_grade: string;
  shift?: string;
  payment_method: "pix" | "credit_card";
  payer: {
    email: string;
    name: string;
    cpf: string;
    phone: string;
  };
  credit_card?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  credit_card_holder_info?: {
    postalCode: string;
    addressNumber: string;
  };
  mp_card_token?: string; // MercadoPago tokenized card
  mp_payment_method_id?: string; // MercadoPago payment method id (visa, master, etc.)
  remote_ip?: string;
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── ASAAS ────────────────────────────────────────────────────
async function processAsaas(
  supabase: any, supabaseUrl: string, supabaseKey: string,
  event: any, ticket: any, body: CheckoutRequest, asaasApiKey: string
) {
  const { payment_method, payer, credit_card, credit_card_holder_info, remote_ip } = body;
  const cpfClean = payer.cpf.replace(/\D/g, "");
  const phoneClean = payer.phone?.replace(/\D/g, "") || "";

  // ── Auto-register webhook in ASAAS (best-effort, once per gateway) ──
  const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
  try {
    // Fetch the franchise's webhook token to use as authToken in ASAAS
    const supabaseAdminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: franchiseData } = await supabaseAdminClient
      .from('franchises')
      .select('asaas_webhook_token')
      .eq('id', ticket.franchise_id)
      .single();
    const webhookAuthToken = franchiseData?.asaas_webhook_token || ticket.franchise_id;

    const whRes = await fetch(`${ASAAS_API}/webhooks`, { headers: { 'access_token': asaasApiKey } });
    if (whRes.ok) {
      const whData = await whRes.json();
      const existingWebhook = whData.data?.find((w: any) => w.url === webhookUrl);
      if (!existingWebhook || !existingWebhook.enabled) {
        // Delete old webhook if exists but disabled/wrong token
        if (existingWebhook) {
          await fetch(`${ASAAS_API}/webhooks/${existingWebhook.id}`, {
            method: 'DELETE',
            headers: { 'access_token': asaasApiKey },
          });
        }
        const regRes = await fetch(`${ASAAS_API}/webhooks`, {
          method: 'POST',
          headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Universo360 Webhook',
            url: webhookUrl,
            email: 'noreply@universo360.com.br',
            enabled: true,
            interrupted: false,
            sendType: 'SEQUENTIALLY',
            authToken: webhookAuthToken, // must match asaas_webhook_token saved in franchises table
            events: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED'],
          }),
        });
        const regData = await regRes.json();
        console.log('ASAAS webhook registered:', webhookUrl, 'status:', regRes.status, JSON.stringify(regData));
      } else {
        // Webhook exists and is enabled — check if authToken needs update
        // We can't read the stored authToken from ASAAS, so update it to ensure it matches
        await fetch(`${ASAAS_API}/webhooks/${existingWebhook.id}`, {
          method: 'PUT',
          headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: existingWebhook.name || 'Universo360 Webhook',
            url: webhookUrl,
            enabled: true,
            interrupted: false,
            sendType: existingWebhook.sendType || 'SEQUENTIALLY',
            authToken: webhookAuthToken,
            events: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED'],
          }),
        });
        console.log('ASAAS webhook updated authToken for:', webhookUrl);
      }
    }
  } catch (whErr) {
    console.warn('Could not register ASAAS webhook (best-effort):', whErr);
  }

  // Create or find customer
  let customerId: string;
  const searchRes = await fetch(`${ASAAS_API}/customers?cpfCnpj=${cpfClean}`, {
    headers: { 'access_token': asaasApiKey },
  });
  const searchData = await searchRes.json();

  if (searchData.data && searchData.data.length > 0) {
    const existingCustomer = searchData.data[0];
    customerId = existingCustomer.id;

    // Enforce disabled notifications even for previously created customers
    if (!existingCustomer.notificationDisabled) {
      const updateCustomerRes = await fetch(`${ASAAS_API}/customers/${customerId}`, {
        method: "PUT",
        headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationDisabled: true }),
      });
      const updateCustomerData = await updateCustomerRes.json().catch(() => ({}));
      if (!updateCustomerRes.ok) {
        await supabase.from("tickets").delete().eq("id", ticket.id);
        return jsonRes({ error: updateCustomerData?.errors?.[0]?.description || "Falha ao desativar notificações do cliente ASAAS" }, 400);
      }
    }
  } else {
    const createRes = await fetch(`${ASAAS_API}/customers`, {
      method: "POST",
      headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: payer.name, cpfCnpj: cpfClean, email: payer.email, mobilePhone: phoneClean, notificationDisabled: true }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      await supabase.from("tickets").delete().eq("id", ticket.id);
      return jsonRes({ error: createData.errors?.[0]?.description || "Erro ao criar cliente no ASAAS" }, 400);
    }
    customerId = createData.id;
  }

  // PIX expires in 10 minutes to match the QR code countdown timer
  const dueDate = new Date(Date.now() + 10 * 60 * 1000);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const paymentPayload: Record<string, unknown> = {
    customer: customerId,
    billingType: payment_method === "pix" ? "PIX" : "CREDIT_CARD",
    value: Number(event.price),
    dueDate: dueDateStr,
    description: `Ingresso Planetário - ${event.school_name}`.substring(0, 100),
    externalReference: ticket.id,
    notificationDisabled: true,
  };

  if (payment_method === "credit_card" && credit_card) {
    paymentPayload.creditCard = {
      holderName: credit_card.holderName,
      number: credit_card.number.replace(/\s/g, ""),
      expiryMonth: credit_card.expiryMonth,
      expiryYear: credit_card.expiryYear,
      ccv: credit_card.ccv,
    };
    paymentPayload.creditCardHolderInfo = {
      name: payer.name, email: payer.email, cpfCnpj: cpfClean,
      postalCode: credit_card_holder_info?.postalCode?.replace(/\D/g, "") || "00000000",
      addressNumber: credit_card_holder_info?.addressNumber || "0",
      phone: phoneClean,
    };
    paymentPayload.remoteIp = remote_ip || "0.0.0.0";
  }

  const paymentRes = await fetch(`${ASAAS_API}/payments`, {
    method: "POST",
    headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentPayload),
  });
  const paymentData = await paymentRes.json();

  if (!paymentRes.ok) {
    await supabase.from("tickets").delete().eq("id", ticket.id);
    return jsonRes({ error: paymentData.errors?.[0]?.description || "Erro ao criar cobrança", details: paymentData }, 400);
  }

  await supabase.from("tickets").update({ payment_id: paymentData.id, mp_payment_id: paymentData.id }).eq("id", ticket.id);

  if (payment_method === "pix") {
    // Retry up to 3 times with 1s delay — ASAAS may take a moment to generate the QR code
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;
    let qrData: any = null;
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
        const qrRes = await fetch(`${ASAAS_API}/payments/${paymentData.id}/pixQrCode`, {
          headers: { 'access_token': asaasApiKey },
        });
        const data = await qrRes.json();
        if (qrRes.ok && data.payload) {
          qrData = data;
          break;
        }
        lastError = data.errors?.[0]?.description || `HTTP ${qrRes.status}`;
        console.warn(`QR code attempt ${attempt}/${MAX_RETRIES} failed: ${lastError}`);
      } catch (err) {
        lastError = String(err);
        console.warn(`QR code attempt ${attempt}/${MAX_RETRIES} exception: ${lastError}`);
      }
    }

    if (!qrData) {
      console.error(`QR code not available after ${MAX_RETRIES} attempts: ${lastError}`);
      return jsonRes({ success: true, ticket_id: ticket.id, payment_method: "pix", error_qr: "QR code não disponível, tente novamente" });
    }

    // Set expiration to 10 minutes from now for the QR code countdown
    const pixExpiration = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return jsonRes({
      success: true, ticket_id: ticket.id, payment_method: "pix",
      pix: { qr_code: qrData.payload, qr_code_base64: qrData.encodedImage, expiration_date: pixExpiration },
    });
  }

  // Credit card
  let cardStatus = "pending";
  if (paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED") cardStatus = "approved";
  else if (paymentData.status === "DECLINED" || paymentData.status === "REFUNDED") cardStatus = "rejected";

  if (cardStatus !== "pending") {
    await supabase.from("tickets").update({ payment_status: cardStatus, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    if (cardStatus === "approved") {
      await supabase.rpc('decrement_spots', { p_ticket_id: ticket.id, p_event_id: ticket.event_id, p_quantity: 1 });
      fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ticket_id: ticket.id }),
      }).catch(err => console.error('Receipt error:', err));
    }
  }

  return jsonRes({ success: true, ticket_id: ticket.id, payment_method: "credit_card", payment_status: cardStatus });
}

// ── PAGBANK ──────────────────────────────────────────────────
async function processPagBank(
  supabase: any, supabaseUrl: string, supabaseKey: string,
  event: any, ticket: any, body: CheckoutRequest, pagbankToken: string
) {
  const { payment_method, payer, credit_card, credit_card_holder_info } = body;
  const cpfClean = payer.cpf.replace(/\D/g, "");
  const phoneClean = payer.phone?.replace(/\D/g, "") || "";
  const phoneDDD = phoneClean.substring(0, 2);
  const phoneNumber = phoneClean.substring(2);

  const orderPayload: Record<string, unknown> = {
    reference_id: ticket.id,
    customer: {
      name: payer.name,
      email: payer.email,
      tax_id: cpfClean,
      phones: [{ country: "55", area: phoneDDD, number: phoneNumber, type: "MOBILE" }],
    },
    items: [{
      reference_id: ticket.id,
      name: `Ingresso - ${event.school_name}`.substring(0, 64),
      quantity: 1,
      unit_amount: Math.round(Number(event.price) * 100),
    }],
    notification_urls: [`${supabaseUrl}/functions/v1/payment-webhook`],
  };

  if (payment_method === "pix") {
    (orderPayload as any).qr_codes = [{
      amount: { value: Math.round(Number(event.price) * 100) },
      expiration_date: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }];
  } else if (payment_method === "credit_card" && credit_card) {
    (orderPayload as any).charges = [{
      reference_id: ticket.id,
      description: `Ingresso - ${event.school_name}`.substring(0, 64),
      amount: { value: Math.round(Number(event.price) * 100), currency: "BRL" },
      payment_method: {
        type: "CREDIT_CARD",
        installments: 1,
        capture: true,
        card: {
          number: credit_card.number.replace(/\s/g, ""),
          exp_month: credit_card.expiryMonth,
          exp_year: credit_card.expiryYear,
          security_code: credit_card.ccv,
          holder: {
            name: credit_card.holderName,
            tax_id: cpfClean,
          },
        },
      },
    }];
  }

  console.log("Creating PagBank order...");
  const orderRes = await fetch(`${PAGBANK_API}/orders`, {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${pagbankToken}`,
      'Content-Type': 'application/json',
      'x-api-version': '4.0',
    },
    body: JSON.stringify(orderPayload),
  });

  const orderData = await orderRes.json();
  console.log("PagBank response:", orderRes.status, JSON.stringify(orderData));

  if (!orderRes.ok) {
    await supabase.from("tickets").delete().eq("id", ticket.id);
    const errorMsg = orderData.error_messages?.[0]?.description || orderData.message || "Erro ao criar cobrança no PagBank";
    return jsonRes({ error: errorMsg, details: orderData }, 400);
  }

  // Save PagBank order id
  await supabase.from("tickets").update({ payment_id: orderData.id, mp_payment_id: orderData.id }).eq("id", ticket.id);

  if (payment_method === "pix") {
    const qrCode = orderData.qr_codes?.[0];
    if (qrCode) {
      const qrText = qrCode.text;
      // PagBank provides QR code image link
      const qrImageLink = qrCode.links?.find((l: any) => l.media === "image/png")?.href;
      return jsonRes({
        success: true, ticket_id: ticket.id, payment_method: "pix",
        pix: {
          qr_code: qrText,
          qr_code_base64: qrImageLink || "",
          expiration_date: qrCode.expiration_date,
        },
      });
    }
    return jsonRes({ success: true, ticket_id: ticket.id, payment_method: "pix", error_qr: "QR code não disponível" });
  }

  // Credit card
  const charge = orderData.charges?.[0];
  let cardStatus = "pending";
  if (charge) {
    const st = charge.status;
    if (st === "PAID" || st === "AUTHORIZED") cardStatus = "approved";
    else if (st === "DECLINED" || st === "CANCELED") cardStatus = "rejected";
  }

  if (cardStatus !== "pending") {
    await supabase.from("tickets").update({ payment_status: cardStatus, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    if (cardStatus === "approved") {
      await supabase.rpc('decrement_spots', { p_ticket_id: ticket.id, p_event_id: ticket.event_id, p_quantity: 1 });
      fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ticket_id: ticket.id }),
      }).catch(err => console.error('Receipt error:', err));
    }
  }

  return jsonRes({ success: true, ticket_id: ticket.id, payment_method: "credit_card", payment_status: cardStatus });
}

// ── MERCADO PAGO ─────────────────────────────────────────────
async function processMercadoPago(
  supabase: any, supabaseUrl: string, supabaseKey: string,
  event: any, ticket: any, body: CheckoutRequest, accessToken: string
) {
  const { payment_method, payer, credit_card, mp_card_token, mp_payment_method_id } = body;
  const cpfClean = payer.cpf.replace(/\D/g, "");

  const paymentPayload: Record<string, unknown> = {
    transaction_amount: Number(event.price),
    description: `Ingresso Planetário - ${event.school_name}`.substring(0, 100),
    external_reference: ticket.id,
    payer: {
      email: payer.email,
      first_name: payer.name.split(' ')[0],
      last_name: payer.name.split(' ').slice(1).join(' ') || payer.name,
      identification: { type: "CPF", number: cpfClean },
    },
    notification_url: `${supabaseUrl}/functions/v1/payment-webhook`,
  };

  if (payment_method === "pix") {
    paymentPayload.payment_method_id = "pix";
    // Force 10-minute expiration (MP default is 24h)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    paymentPayload.date_of_expiration = expiresAt.toISOString().replace('Z', '-04:00');
  } else if (payment_method === "credit_card") {
    if (mp_card_token) {
      // ── Use tokenized card (MercadoPago.js SDK) ──
      paymentPayload.token = mp_card_token;
      paymentPayload.installments = 1;
      paymentPayload.capture = true;
      if (mp_payment_method_id) {
        paymentPayload.payment_method_id = mp_payment_method_id;
      }
    } else if (credit_card) {
      // Fallback: raw card data (may not be supported by MP)
      paymentPayload.payment_method_id = "master";
      paymentPayload.installments = 1;
      paymentPayload.card = {
        card_number: credit_card.number.replace(/\s/g, ""),
        expiration_month: parseInt(credit_card.expiryMonth),
        expiration_year: parseInt(credit_card.expiryYear),
        security_code: credit_card.ccv,
        cardholder: {
          name: credit_card.holderName,
          identification: { type: "CPF", number: cpfClean },
        },
      };
    } else {
      return jsonRes({ error: "Dados do cartão não fornecidos" }, 400);
    }
  }


  console.log("Creating Mercado Pago payment...");
  const paymentRes = await fetch(`${MERCADOPAGO_API}/v1/payments`, {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': ticket.id,
    },
    body: JSON.stringify(paymentPayload),
  });

  const paymentData = await paymentRes.json();
  console.log("Mercado Pago response:", paymentRes.status, JSON.stringify(paymentData));

  if (!paymentRes.ok) {
    await supabase.from("tickets").delete().eq("id", ticket.id);
    const errorMsg = paymentData.message || "Erro ao criar pagamento no Mercado Pago";
    return jsonRes({ error: errorMsg, details: paymentData }, 400);
  }

  await supabase.from("tickets").update({ payment_id: String(paymentData.id), mp_payment_id: String(paymentData.id) }).eq("id", ticket.id);

  if (payment_method === "pix") {
    const txData = paymentData.point_of_interaction?.transaction_data;
    if (txData) {
      return jsonRes({
        success: true, ticket_id: ticket.id, payment_method: "pix",
        pix: {
          qr_code: txData.qr_code,
          qr_code_base64: txData.qr_code_base64 ?? "",
          expiration_date: paymentData.date_of_expiration,
        },
      });
    }
    return jsonRes({ success: true, ticket_id: ticket.id, payment_method: "pix", error_qr: "QR code não disponível" });
  }

  // Credit card
  let cardStatus = "pending";
  if (paymentData.status === "approved") cardStatus = "approved";
  else if (paymentData.status === "rejected") cardStatus = "rejected";

  if (cardStatus !== "pending") {
    await supabase.from("tickets").update({ payment_status: cardStatus, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    if (cardStatus === "approved") {
      await supabase.rpc('decrement_spots', { p_ticket_id: ticket.id, p_event_id: ticket.event_id, p_quantity: 1 });
      fetch(`${supabaseUrl}/functions/v1/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ticket_id: ticket.id }),
      }).catch(err => console.error('Receipt error:', err));
    }
  }

  return jsonRes({
    success: true,
    ticket_id: ticket.id,
    payment_method: "credit_card",
    payment_status: cardStatus,
    // Include rejection reason so the frontend can show a friendly message
    rejection_reason: cardStatus === "rejected" ? (paymentData.status_detail || null) : null,
  });
}

// ── MAIN ─────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CheckoutRequest = await req.json();
    console.log("Processing payment:", JSON.stringify({ ...body, credit_card: body.credit_card ? "***" : undefined }));

    const { event_id, student_name, class_grade, shift, payment_method, payer, credit_card } = body;

    if (!event_id || !student_name || !class_grade || !payer?.email || !payer?.cpf || !payer?.name || !payment_method) {
      return jsonRes({ error: "Campos obrigatórios não preenchidos" }, 400);
    }

    // Only require raw card data if NOT using MP tokenization
    const usingMpToken = !!body.mp_card_token;
    if (payment_method === "credit_card" && !usingMpToken && (!credit_card?.number || !credit_card?.ccv)) {
      return jsonRes({ error: "Dados do cartão são obrigatórios" }, 400);
    }

    // Fetch event + franchise with gateway info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*, franchises!inner(id, asaas_api_key, pagbank_token, mercadopago_access_token, payment_gateway)")
      .eq("id", event_id)
      .eq("is_active", true)
      .single();

    if (eventError || !event) {
      return jsonRes({ error: "Evento não encontrado" }, 404);
    }
    if (event.available_spots <= 0) {
      return jsonRes({ error: "Não há mais vagas disponíveis" }, 400);
    }

    const gateway = (event.franchises as any)?.payment_gateway || 'asaas';
    console.log("Payment gateway:", gateway);

    // Validate credentials
    let hasCredentials = false;
    if (gateway === 'asaas') hasCredentials = !!(event.franchises as any)?.asaas_api_key;
    else if (gateway === 'pagbank') hasCredentials = !!(event.franchises as any)?.pagbank_token;
    else if (gateway === 'mercadopago') hasCredentials = !!(event.franchises as any)?.mercadopago_access_token;

    if (!hasCredentials) {
      return jsonRes({ error: "Credenciais de pagamento não configuradas" }, 400);
    }

    // ── Reuse existing pending ticket for same student/event ──
    // This avoids duplicate charges when the user retries after QR code expiry
    const { data: existingTicket } = await supabase
      .from("tickets")
      .select("*")
      .eq("event_id", event_id)
      .eq("student_name", student_name)
      .eq("payment_status", "pending")
      .eq("payment_method", "pix")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticket: any;

    if (existingTicket && existingTicket.payment_id) {
      // Cancel the old charge in the gateway before reusing the ticket
      console.log(`Reusing existing pending ticket ${existingTicket.id}, cancelling old charge ${existingTicket.payment_id}`);
      try {
        if (gateway === 'asaas') {
          const apiKey = (event.franchises as any)?.asaas_api_key;
          await fetch(`${ASAAS_API}/payments/${existingTicket.payment_id}/cancel`, {
            method: 'POST',
            headers: { 'access_token': apiKey },
          });
        } else if (gateway === 'pagbank') {
          // PagBank: cancel via charge endpoint (best-effort)
          const token = (event.franchises as any)?.pagbank_token;
          await fetch(`${PAGBANK_API}/charges/${existingTicket.payment_id}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '4.0', 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: { value: Math.round(Number(event.price) * 100) } }),
          });
        } else if (gateway === 'mercadopago') {
          const accessToken = (event.franchises as any)?.mercadopago_access_token;
          await fetch(`${MERCADOPAGO_API}/v1/payments/${existingTicket.payment_id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' }),
          });
        }
      } catch (cancelErr) {
        console.warn("Could not cancel old charge (best-effort):", cancelErr);
      }
      // Reset ticket to reuse it
      await supabase.from("tickets").update({
        payment_id: null,
        mp_payment_id: null,
        payment_status: "pending",
        payment_method,
        updated_at: new Date().toISOString(),
      }).eq("id", existingTicket.id);
      ticket = { ...existingTicket, payment_id: null, mp_payment_id: null };
    } else {
      // Create a new ticket
      const { data: newTicket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          event_id,
          franchise_id: event.franchise_id,
          customer_name: payer.name,
          customer_email: payer.email,
          customer_phone: payer.phone || null,
          student_name,
          class_grade,
          shift: shift || null,
          quantity: 1,
          amount: event.price,
          payment_status: "pending",
          payment_method,
        })
        .select()
        .single();

      if (ticketError || !newTicket) {
        console.error("Ticket creation error:", ticketError);
        return jsonRes({ error: "Erro ao criar ingresso" }, 500);
      }
      ticket = newTicket;
    }

    console.log("Ticket resolved:", ticket.id, existingTicket ? "(reused)" : "(new)");

    // Route to correct gateway
    if (gateway === 'pagbank') {
      return await processPagBank(supabase, supabaseUrl, supabaseKey, event, ticket, body, (event.franchises as any).pagbank_token);
    } else if (gateway === 'mercadopago') {
      return await processMercadoPago(supabase, supabaseUrl, supabaseKey, event, ticket, body, (event.franchises as any).mercadopago_access_token);
    } else {
      return await processAsaas(supabase, supabaseUrl, supabaseKey, event, ticket, body, (event.franchises as any).asaas_api_key);
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonRes({ error: "Erro interno do servidor" }, 500);
  }
});
