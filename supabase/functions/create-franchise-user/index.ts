import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateFranchiseRequest {
  username: string;
  password: string;
  full_name: string;
  franchise_name: string;
  city: string;
  state: string;
  mercadopago_access_token?: string;
  mercadopago_public_key?: string;
  commission_type?: 'fixed' | 'percentage';
  commission_value?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body: CreateFranchiseRequest = await req.json();
    console.log('Creating franchise user:', { username: body.username, franchise: body.franchise_name });

    const { username, password, full_name, franchise_name, city, state, mercadopago_access_token, mercadopago_public_key, commission_type, commission_value } = body;

    // Validate required fields
    if (!username || !password || !franchise_name || !city || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const internalEmail = `${username}@franchise.universo360.local`;

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === internalEmail);

    let userId: string;

    if (existingUser) {
      console.log('User already exists, using existing user:', existingUser.id);
      userId = existingUser.id;

      // Check if franchise already exists for this user
      const { data: existingFranchise } = await supabaseAdmin
        .from('franchises')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (existingFranchise) {
        return new Response(
          JSON.stringify({ error: 'Franchise already exists for this user' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new user
      console.log('Creating new user with email:', internalEmail);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name,
        },
      });

      if (authError) {
        console.error('Error creating user:', authError);
        return new Response(
          JSON.stringify({ error: `Error creating user: ${authError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authData.user.id;
      console.log('User created successfully:', userId);
    }

    // Update profile with username (upsert in case trigger already created it)
    console.log('Updating profile for user:', userId);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        username: username,
        full_name: full_name,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Remove customer role if exists (auto-added by trigger)
    console.log('Removing customer role if exists');
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'customer');

    // Check if franchise_owner role already exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'franchise_owner')
      .single();

    if (!existingRole) {
      console.log('Adding franchise_owner role');
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'franchise_owner',
        });

      if (roleError) {
        console.error('Error adding role:', roleError);
        return new Response(
          JSON.stringify({ error: `Error adding role: ${roleError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create franchise
    console.log('Creating franchise:', franchise_name);
    const { data: franchiseData, error: franchiseError } = await supabaseAdmin
      .from('franchises')
      .insert({
        name: franchise_name,
        city: city,
        state: state,
        owner_id: userId,
        mercadopago_access_token: mercadopago_access_token || null,
        mercadopago_public_key: mercadopago_public_key || null,
        commission_type: commission_type || 'fixed',
        commission_value: commission_value ?? 2.00,
      })
      .select('id')
      .single();

    if (franchiseError) {
      console.error('Error creating franchise:', franchiseError);
      return new Response(
        JSON.stringify({ error: `Error creating franchise: ${franchiseError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Franchise created successfully:', franchiseData.id);

    return new Response(
      JSON.stringify({
        success: true,
        franchiseId: franchiseData.id,
        userId: userId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
