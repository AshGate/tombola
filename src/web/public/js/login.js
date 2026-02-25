const stepDiscord = document.getElementById('step-discord');
const stepCode = document.getElementById('step-code');
const discordIdInput = document.getElementById('discordId');
const authCodeInput = document.getElementById('authCode');
const requestCodeBtn = document.getElementById('requestCodeBtn');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const backBtn = document.getElementById('backBtn');
const errorDiscord = document.getElementById('error-discord');
const errorCode = document.getElementById('error-code');

function setLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : '';
  if (loader) loader.style.display = loading ? 'block' : 'none';
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError(el) {
  el.style.display = 'none';
}

function showStep(step) {
  stepDiscord.style.display = 'none';
  stepCode.style.display = 'none';
  step.style.display = 'block';
}

requestCodeBtn.addEventListener('click', async () => {
  const discordId = discordIdInput.value.trim();
  hideError(errorDiscord);

  if (!discordId || !/^\d{17,20}$/.test(discordId)) {
    showError(errorDiscord, 'Entrez un ID Discord valide (17-20 chiffres).');
    return;
  }

  setLoading(requestCodeBtn, true);

  try {
    const res = await fetch('/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ discord_id: discordId }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      hideError(errorDiscord);
      showStep(stepCode);
      authCodeInput.value = '';
      authCodeInput.focus();
    } else {
      showError(errorDiscord, data.error || 'Erreur lors de l\'envoi du code.');
    }
  } catch {
    showError(errorDiscord, 'Erreur de connexion au serveur.');
  } finally {
    setLoading(requestCodeBtn, false);
  }
});

verifyCodeBtn.addEventListener('click', async () => {
  const discordId = discordIdInput.value.trim();
  const code = authCodeInput.value.trim();
  hideError(errorCode);

  if (!code || !/^\d{6}$/.test(code)) {
    showError(errorCode, 'Entrez un code a 6 chiffres.');
    return;
  }

  setLoading(verifyCodeBtn, true);

  try {
    const res = await fetch('/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ discord_id: discordId, code }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      window.location.href = '/';
    } else {
      showError(errorCode, data.error || 'Code incorrect.');
    }
  } catch {
    showError(errorCode, 'Erreur de connexion au serveur.');
  } finally {
    setLoading(verifyCodeBtn, false);
  }
});

backBtn.addEventListener('click', () => {
  hideError(errorCode);
  showStep(stepDiscord);
});

discordIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') requestCodeBtn.click();
});

authCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') verifyCodeBtn.click();
});
