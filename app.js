(() => {
const DEFAULT_URL = "https://elcycasbqvsjhglluoqu.supabase.co";
const DEFAULT_KEY = "sb_publishable_Rvfz3BXA_PCY4OLKHt9YPg_3UEEkPBO";
const $ = id => document.getElementById(id);
let supabaseClient, currentUser, profile, sellers = [], pending = null, channel;
const show = (id, yes=true) => $(id).classList.toggle("hidden", !yes);
const say = (msg, error=false) => { $("actionMessage").textContent=msg; $("actionMessage").style.color=error?"#ffc1b9":"#a8f0c9"; };
const setConnection = (text, online=false) => { $("connection").textContent=text; $("connection").classList.toggle("online",online); };
function config(){return {url:localStorage.getItem("vtk_url")||DEFAULT_URL,key:localStorage.getItem("vtk_key")||DEFAULT_KEY};}
function initClient(){const c=config();supabaseClient=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}
async function boot(){
 initClient(); setConnection("Conectando...");
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(!session){show("loginView");show("setupView",false);setConnection("Aguardando acesso");return;}
 currentUser=session.user;
 const {data,error}=await supabaseClient.from("user_profiles").select("id,full_name,role").eq("id",currentUser.id).maybeSingle();
 if(error||!data||!["admin","assistant"].includes(data.role)){await supabaseClient.auth.signOut();show("loginView");$("loginError").textContent="Usuário sem perfil autorizado. Solicite acesso ao administrador.";return;}
 profile=data;show("loginView",false);show("appView");show("logoutBtn");show("adminPanel",profile.role==="admin");setConnection("Conectado",true);
 await refreshAll(); subscribe();
}
async function refreshAll(){
 const [sRes,stateRes]=await Promise.all([
  supabaseClient.from("sellers").select("id,name,weight,active,available,position,assigned_count").order("position"),
  supabaseClient.from("routing_state").select("pending_seller_id,updated_at").eq("id",true).maybeSingle()
 ]);
 if(sRes.error){say("Não foi possível carregar vendedores: "+sRes.error.message,true);return;}
 sellers=sRes.data||[]; pending=stateRes.data?.pending_seller_id||null;
 renderSellers(); renderAdmin();
 const total=sellers.filter(s=>s.active).length;
 $("sellerTotal").textContent=total;
 $("assignedTotal").textContent=sellers.reduce((n,s)=>n+Number(s.assigned_count||0),0);
 const p=sellers.find(s=>s.id===pending);
 $("pendingName").textContent=p?.name||"Aguardando consulta";
 await getNext(false);
}
async function getNext(showMessage=true){
 const {data,error}=await supabaseClient.rpc("get_next_seller");
 if(error){$("nextName").textContent="Indisponível";$("nextMeta").textContent=error.message;say("Falha ao consultar fila: "+error.message,true);return;}
 const row=Array.isArray(data)?data[0]:data;
 if(!row){$("nextName").textContent="Sem vendedores";$("nextMeta").textContent="Cadastre ou habilite vendedores no painel administrativo.";pending=null;return;}
 pending=row.seller_id;$("nextName").textContent=row.seller_name;
 $("nextMeta").textContent="Peso "+row.weight+" · "+row.assigned_count+" contatos recebidos";
 $("pendingName").textContent=row.seller_name;
 if(showMessage)say("Próximo vendedor atualizado.");
}
function renderSellers(){
 $("sellerRows").innerHTML=sellers.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${s.weight}</td><td>${s.assigned_count}</td><td><span class="availability ${s.active&&s.available?"yes":"no"}">${!s.active?"Inativo":s.available?"Disponível":"Indisponível"}</span></td></tr>`).join("")||'<tr><td colspan="4">Nenhum vendedor cadastrado.</td></tr>';
}
function renderAdmin(){
 if(profile?.role!=="admin")return;
 $("adminRows").innerHTML=sellers.map(s=>`<tr data-id="${s.id}"><td><input data-field="name" value="${attr(s.name)}"></td><td><input data-field="weight" type="number" min="1" value="${s.weight}"></td><td><input data-field="position" type="number" min="1" value="${s.position}"></td><td><input data-field="active" type="checkbox" ${s.active?"checked":""}></td><td><input data-field="available" type="checkbox" ${s.available?"checked":""}></td><td><button class="button secondary small save-seller">Salvar</button></td></tr>`).join("");
 document.querySelectorAll(".save-seller").forEach(b=>b.addEventListener("click",saveSeller));
}
async function saveSeller(e){
 const tr=e.currentTarget.closest("tr"), id=tr.dataset.id, val=f=>tr.querySelector('[data-field="'+f+'"]');
 const payload={name:val("name").value.trim(),weight:Number(val("weight").value),position:Number(val("position").value),active:val("active").checked,available:val("available").checked};
 if(!payload.name||payload.weight<1||payload.position<1){say("Confira nome, peso e ordem.",true);return;}
 const {error}=await supabaseClient.from("sellers").update(payload).eq("id",id);
 if(error){say("Não foi possível salvar: "+error.message,true);return;}
 say("Cadastro atualizado.");await refreshAll();
}
$("addSellerForm").addEventListener("submit",async e=>{
 e.preventDefault();if(profile?.role!=="admin")return;
 const maxPos=Math.max(0,...sellers.map(s=>Number(s.position)||0));
 const {error}=await supabaseClient.from("sellers").insert({name:$("newSellerName").value.trim(),weight:Number($("newSellerWeight").value)||1,position:maxPos+1,active:true,available:true,assigned_count:0});
 if(error){say("Não foi possível adicionar: "+error.message,true);return;}
 $("newSellerName").value="";say("Vendedor adicionado.");await refreshAll();
});
$("assignBtn").addEventListener("click",async()=>{
 $("assignBtn").disabled=true;
 const {data,error}=await supabaseClient.rpc("assign_current_seller");
 $("assignBtn").disabled=false;
 if(error){say("Não foi possível confirmar: "+error.message,true);return;}
 const row=Array.isArray(data)?data[0]:data;say(row?"Contato encaminhado para "+row.seller_name+".":"Encaminhamento registrado.");
 await refreshAll();
});
$("skipBtn").addEventListener("click",async()=>{
 $("skipBtn").disabled=true;
 const {data,error}=await supabaseClient.rpc("skip_current_seller",{p_reason:"Vendedor não disponível no momento"});
 $("skipBtn").disabled=false;
 if(error){say("Não foi possível pular: "+error.message,true);return;}
 const row=Array.isArray(data)?data[0]:data;say(row?"Vendedor "+row.seller_name+" pulado. Próximo: "+(row.next_seller_name||"nenhum")+".":"Vendedor pulado.");
 await refreshAll();
});
$("refreshBtn").addEventListener("click",refreshAll);
$("logoutBtn").addEventListener("click",async()=>{if(channel)await supabaseClient.removeChannel(channel);await supabaseClient.auth.signOut();location.reload();});
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("loginError").textContent="";
 const {error}=await supabaseClient.auth.signInWithPassword({email:$("email").value,password:$("password").value});
 if(error){$("loginError").textContent=error.message;return;}await boot();
});
function subscribe(){
 if(channel)supabaseClient.removeChannel(channel);
 channel=supabaseClient.channel("vtk-router-live")
 .on("postgres_changes",{event:"*",schema:"public",table:"sellers"},refreshAll)
 .on("postgres_changes",{event:"*",schema:"public",table:"routing_state"},refreshAll)
 .subscribe(status=>{if(status==="SUBSCRIBED")setConnection("Sincronizado",true);});
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function attr(s){return esc(s).replace(/\`/g,"&#96;");}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
boot().catch(e=>{setConnection("Erro de conexão");console.error(e);});
})();