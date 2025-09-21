import * as msal from "@azure/msal-browser";

// ======= CONFIG =======
const TENANT_ID      = "6bcca42d-d01b-4e42-be4b-2f55074eaa0d";
const SPA_CLIENT_ID  = "37a06db0-7d71-495c-8744-f0977fc82f2e";
const SCOPE_API      = "api://d4663603-4c77-4acf-95f3-c1f5d0390ae1/user_impersonation";
const API_BASE       = "https://api-nico-rag.azurewebsites.net";

function show(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ======= DÉMARRAGE DE L'APP =======
async function startApp() {
  
  // /.auth/me (identité SWA)
  async function loadMe() {
    try {
      const d = await (await fetch("/.auth/me")).json();
      show("me", JSON.stringify(d, null, 2));
    } catch (e) { show("me", "Erreur /.auth/me: " + e); }
  }
  loadMe();
  document.getElementById("btnReloadMe")?.addEventListener("click", loadMe);

  // MSAL
  const msalInstance = new msal.PublicClientApplication({
    auth: { clientId: SPA_CLIENT_ID, authority: `https://login.microsoftonline.com/${TENANT_ID}`, redirectUri: window.location.origin },
    cache: { cacheLocation: "sessionStorage" }
  });

  async function ensureLogin() {
    const accts = msalInstance.getAllAccounts();
    if (accts.length === 0) {
      const login = await msalInstance.loginPopup({ scopes: [SCOPE_API] });
      msalInstance.setActiveAccount(login.account);
      return login.account;
    }
    msalInstance.setActiveAccount(accts[0]);
    return accts[0];
  }

  async function getToken() {
    await ensureLogin();
    const req = { scopes: [SCOPE_API], account: msalInstance.getActiveAccount() };
    try { return (await msalInstance.acquireTokenSilent(req)).accessToken; }
    catch { return (await msalInstance.acquireTokenPopup(req)).accessToken; }
  }

  // ======= Appel API protégé (bouton corrigé) =======
  async function callApi() {
    show("api", "Appel en cours…");
    try {
      const token = await getToken();
      // CORRECTION : Appel de /health au lieu de /
      const r = await fetch(`${API_BASE}/health`, { headers: { Authorization: `Bearer ${token}` } });
      const txt = await r.text();
      show("api", `API status: ${r.status}\n\n` + txt);
    } catch (e) { show("api", "Erreur appel API: " + e); }
  }
  document.getElementById("btnCall")?.addEventListener("click", callApi);
  document.getElementById("btnClear")?.addEventListener("click", () => show("api", "En attente…"));

  // ======= Chat Azure OpenAI (logique corrigée) =======
  const chatLog   = document.getElementById('chatLog');
  const chatInput = document.getElementById('chatInput');
  const sendBtn   = document.getElementById('sendBtn');
  const clearChat = document.getElementById('clearChat');

  function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
  function addBubble(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `bubble-wrapper ${role === 'user' ? 'user' : 'bot'}`;
    const b = document.createElement('div');
    b.className = `bubble`;
    b.innerHTML = `<div class="who">${role === 'user' ? '👤 vous' : '🤖 assistant'}</div>${escapeHtml(text)}`;
    wrap.appendChild(b);
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function sendChat() {
    const text = (chatInput.value || "").trim();
    if (!text) return;
    chatInput.value = "";
    addBubble('user', text);
    addBubble('assistant', '…');

    try {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer " + token
        },
        // CORRECTION : Envoi du bon format de payload
        body: JSON.stringify({ message: text })
      });
      const data = await r.json();
      chatLog.lastChild.remove();
      // CORRECTION : Lecture de la réponse du backend intelligent
      const answer = data.content || JSON.stringify(data);
      addBubble('assistant', answer);
    } catch (e) {
      chatLog.lastChild.remove();
      addBubble('assistant', `⚠️ Erreur: ${e}`);
    }
  }

  sendBtn?.addEventListener('click', sendChat);
  chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  clearChat?.addEventListener('click', () => { chatLog.innerHTML = ""; });
}

// Démarrer l'application une fois le DOM chargé
document.addEventListener('DOMContentLoaded', startApp);
