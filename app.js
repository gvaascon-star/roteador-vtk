
(() => {
"use strict";

const DEFAULT_URL = "https://elcycasbqvsjhglluoqu.supabase.co";
const DEFAULT_KEY = "sb_publishable_Rvfz3BXA_PCY4OLKHt9YPg_3UEEkPBO";

const $ = id => document.getElementById(id);

let supabaseClient;
let currentUser;
let profile;
let sellers = [];
let pending = null;
let channel;
let refreshing = false;

const show = (id, yes = true) => {
  $(id).classList.toggle("hidden", !yes);
};

const say = (msg, error = false) => {
  $("actionMessage").textContent = msg;
  $("actionMessage").style.color = error ? "#ffc1b9" : "#a8f0c9";
};

const setConnection = (text, online = false) => {
  $("connection").textContent = text;
  $("connection").classList.toggle("online", online);
};

function config() {
  return {
    url: localStorage.getItem("vtk_url") || DEFAULT_URL,
    key: localStorage.getItem("vtk_key") || DEFAULT_KEY
  };
}

function initClient() {
  const c = config();

  supabaseClient = window.supabase.createClient(
    c.url,
    c.key,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

// ============================================
// AUTENTICACAO
// ============================================

async function boot() {
  initClient();
  setConnection("Conectando...");

  const { data: { session }, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError) throw sessionError;

  if (!session) {
    show("appView", false);
    show("adminPanel", false);
    show("logoutBtn", false);
    show("loginView");
    show("setupView", false);
    setConnection("Aguardando acesso");
    return;
  }

  currentUser = session.user;

  const { data, error } = await supabaseClient
    .from("user_profiles")
    .select("id,full_name,role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    show("loginView");
    $("loginError").textContent =
      "Falha ao consultar perfil: " + error.message;
    return;
  }

  if (!data || !["admin", "assistant"].includes(data.role)) {
    show("loginView");
    $("loginError").textContent =
      "Usuário sem perfil autorizado. Solicite acesso ao administrador.";
    return;
  }

  profile = data;

  show("loginView", false);
  show("setupView", false);
  show("appView");
  show("logoutBtn");
  show("adminPanel", profile.role === "admin");

  setConnection("Conectado", true);

  await refreshAll();
  subscribe();
}

// ============================================
// CARREGAMENTO DOS DADOS
// ============================================

async function refreshAll() {
  if (refreshing) return;

  refreshing = true;

  try {
    const [sRes, stateRes] = await Promise.all([
      supabaseClient
        .from("sellers")
        .select("id,name,weight,active,available,position,assigned_count")
        .order("position"),

      supabaseClient
        .from("routing_state")
        .select("pending_seller_id,updated_at")
        .eq("id", true)
        .maybeSingle()
    ]);

    if (sRes.error) {
      say("Não foi possível carregar vendedores: " +
        sRes.error.message, true);
      return;
    }

    if (stateRes.error) {
      say("Falha ao consultar estado da fila: " +
        stateRes.error.message, true);
      return;
    }

    sellers = sRes.data || [];
    pending = stateRes.data?.pending_seller_id || null;

    renderSellers();
    renderAdmin();

    $("sellerTotal").textContent =
      sellers.filter(s => s.active).length;

    $("assignedTotal").textContent =
      sellers.reduce(
        (n, s) => n + Number(s.assigned_count || 0), 0
      );

    const p = sellers.find(s => s.id === pending);
    $("pendingName").textContent = p?.name || "Aguardando consulta";

    await getNext(false);

  } finally {
    refreshing = false;
  }
}

// ============================================
// PROXIMO VENDEDOR
// ============================================

async function getNext(showMessage = true) {
  const { data, error } =
    await supabaseClient.rpc("get_next_seller");

  if (error) {
    $("nextName").textContent = "Indisponível";
    $("nextMeta").textContent = error.message;
    say("Falha ao consultar fila: " + error.message, true);
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    $("nextName").textContent = "Sem vendedores";
    $("nextMeta").textContent =
      "Cadastre ou habilite vendedores no painel administrativo.";
    pending = null;
    return;
  }

  pending = row.seller_id;

  $("nextName").textContent = row.seller_name;

  $("nextMeta").textContent =
    "Peso " + row.weight +
    " · " + row.assigned_count + " contatos recebidos";

  $("pendingName").textContent = row.seller_name;

  if (showMessage) {
    say("Próximo vendedor atualizado.");
  }
}

// ============================================
// TABELA DE DISTRIBUICAO
// ============================================

function renderSellers() {
  $("sellerRows").innerHTML = sellers.map(s => `
    <tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td>${s.weight}</td>
      <td>${s.assigned_count}</td>
      <td>
        <span class="availability ${
          s.active && s.available ? "yes" : "no"
        }">
          ${
            !s.active
              ? "Inativo"
              : s.available
                ? "Disponível"
                : "Indisponível"
          }
        </span>
      </td>
    </tr>
  `).join("") ||
    '<tr><td colspan="4">Nenhum vendedor cadastrado.</td></tr>';
}

// ============================================
// ADMINISTRACAO
// ============================================

function renderAdmin() {
  if (profile?.role !== "admin") return;

  $("adminRows").innerHTML = sellers.map(s => `
    <tr data-id="${attr(s.id)}">
      <td>
        <input data-field="name" value="${attr(s.name)}">
      </td>
      <td>
        <input data-field="weight"
          type="number" min="1" value="${Number(s.weight)}">
      </td>
      <td>
        <input data-field="position"
          type="number" min="1" value="${Number(s.position)}">
      </td>
      <td>
        <input data-field="active"
          type="checkbox" ${s.active ? "checked" : ""}>
      </td>
      <td>
        <input data-field="available"
          type="checkbox" ${s.available ? "checked" : ""}>
      </td>
      <td>
        <button class="button secondary small save-seller">
          Salvar
        </button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".save-seller").forEach(button => {
    button.addEventListener("click", saveSeller);
  });
}

// ============================================
// SALVAR VENDEDOR - RPC ADMINISTRATIVA
// ============================================

async function saveSeller(e) {
  if (profile?.role !== "admin") return;

  const button = e.currentTarget;
  const tr = button.closest("tr");

  const val = field =>
    tr.querySelector('[data-field="' + field + '"]');

  const payload = {
    p_seller_id: tr.dataset.id,
    p_name: val("name").value.trim(),
    p_weight: Number(val("weight").value),
    p_position: Number(val("position").value),
    p_active: val("active").checked,
    p_available: val("available").checked
  };

  if (
    !payload.p_name ||
    !Number.isInteger(payload.p_weight) ||
    payload.p_weight < 1 ||
    !Number.isInteger(payload.p_position) ||
    payload.p_position < 1
  ) {
    say("Confira nome, peso e ordem.", true);
    return;
  }

  button.disabled = true;
  button.textContent = "Salvando...";

  try {
    const { error } = await supabaseClient.rpc(
      "admin_update_seller",
      payload
    );

    if (error) throw error;

    say("Vendedor atualizado com sucesso.");

    await refreshAll();

  } catch (error) {
    say("Não foi possível salvar: " + error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Salvar";
  }
}

// ============================================
// CADASTRAR VENDEDOR - RPC ADMINISTRATIVA
// ============================================

$("addSellerForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (profile?.role !== "admin") {
    say("Acesso restrito ao administrador.", true);
    return;
  }

  const name = $("newSellerName").value.trim();
  const weight = Number($("newSellerWeight").value);

  if (!name || !Number.isInteger(weight) || weight < 1) {
    say("Informe um nome e um peso válido.", true);
    return;
  }

  const maxPosition = Math.max(
    0,
    ...sellers.map(s => Number(s.position) || 0)
  );

  const button = e.currentTarget.querySelector("button");
  button.disabled = true;
  button.textContent = "Cadastrando...";

  try {
    const { data, error } = await supabaseClient.rpc(
      "admin_create_seller",
      {
        p_name: name,
        p_weight: weight,
        p_position: maxPosition + 1
      }
    );

    if (error) throw error;

    $("newSellerName").value = "";
    $("newSellerWeight").value = "1";

    say("Vendedor cadastrado com sucesso.");

    await refreshAll();

  } catch (error) {
    say("Não foi possível cadastrar: " + error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Adicionar vendedor";
  }
});

// ============================================
// ENCAMINHAR CONTATO
// ============================================

$("assignBtn").addEventListener("click", async () => {
  $("assignBtn").disabled = true;

  try {
    const { data, error } =
      await supabaseClient.rpc("assign_current_seller");

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    say(
      row
        ? "Contato encaminhado para " + row.seller_name + "."
        : "Encaminhamento registrado."
    );

    await refreshAll();

  } catch (error) {
    say("Não foi possível confirmar: " + error.message, true);
  } finally {
    $("assignBtn").disabled = false;
  }
});

// ============================================
// PULAR VENDEDOR
// ============================================

$("skipBtn").addEventListener("click", async () => {
  $("skipBtn").disabled = true;

  try {
    const { data, error } =
      await supabaseClient.rpc("skip_current_seller", {
        p_reason: "Vendedor não disponível no momento"
      });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    say(
      row
        ? "Vendedor " + row.seller_name +
          " pulado. Próximo: " +
          (row.next_seller_name || "nenhum") + "."
        : "Vendedor pulado."
    );

    await refreshAll();

  } catch (error) {
    say("Não foi possível pular: " + error.message, true);
  } finally {
    $("skipBtn").disabled = false;
  }
});

// ============================================
// ATUALIZAR
// ============================================

$("refreshBtn").addEventListener("click", refreshAll);

// ============================================
// SAIR
// ============================================

$("logoutBtn").addEventListener("click", async () => {
  if (channel) {
    await supabaseClient.removeChannel(channel);
  }

  await supabaseClient.auth.signOut();
  location.reload();
});

// ============================================
// LOGIN
// ============================================

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  $("loginError").textContent = "";

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email: $("email").value,
      password: $("password").value
    });

  if (error) {
    $("loginError").textContent = error.message;
    return;
  }

  await boot();
});

// ============================================
// SINCRONIZACAO EM TEMPO REAL
// ============================================

function subscribe() {
  if (channel) {
    supabaseClient.removeChannel(channel);
  }

  channel = supabaseClient
    .channel("vtk-router-live")

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sellers"
      },
      refreshAll
    )

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "routing_state"
      },
      refreshAll
    )

    .subscribe(status => {
      if (status === "SUBSCRIBED") {
        setConnection("Sincronizado", true);
      }
    });
}

// ============================================
// PROTECAO DE TEXTO HTML
// ============================================

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function attr(s) {
  return esc(s).replace(/`/g, "&#96;");
}

// ============================================
// SERVICE WORKER
// ============================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(console.error);
  });
}

// ============================================
// INICIAR SISTEMA
// ============================================

boot().catch(error => {
  setConnection("Erro de conexão");
  console.error("Erro ao iniciar Roteador VTK:", error);
});

})();
