/**
 * Cat appearance — coat colors & accessories
 */
(() => {
  const STORAGE_KEY = 'meowAppearance';

  const COATS = {
    cream:  { fur: '#f3dfc6', shadow: '#e2c09a', paw: '#edcfaa', earInner: '#f5b8c6', label: 'Cream' },
    gray:   { fur: '#c4c4d0', shadow: '#9090a0', paw: '#b0b0bc', earInner: '#ffb3c6', label: 'Gray' },
    ginger: { fur: '#f0a860', shadow: '#d08040', paw: '#e89850', earInner: '#ffc898', label: 'Ginger' },
    void:   { fur: '#3a3a48', shadow: '#252530', paw: '#4a4a58', earInner: '#6a6a78', label: 'Void' },
    snow:   { fur: '#f8f8fc', shadow: '#dcdce8', paw: '#eeeef4', earInner: '#ffd6e8', label: 'Snow' },
    lilac:  { fur: '#ddd0f0', shadow: '#b8a0d8', paw: '#cfc0e8', earInner: '#ffb8d8', label: 'Lilac' },
  };

  const ACCESSORIES = {
    none:    { label: 'None', emoji: '✕' },
    hat:     { label: 'Hat', emoji: '🎩' },
    bow:     { label: 'Bow', emoji: '🎀' },
    scarf:   { label: 'Scarf', emoji: '🧣' },
    flower:  { label: 'Flower', emoji: '🌸' },
    glasses: { label: 'Glasses', emoji: '👓' },
  };

  let current = { coat: 'cream', accessory: 'none' };

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (COATS[saved.coat]) current.coat = saved.coat;
      if (ACCESSORIES[saved.accessory]) current.accessory = saved.accessory;
    } catch (_) { /* ignore */ }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }

  function apply() {
    const cat = document.getElementById('cat');
    if (!cat) return;

    const c = COATS[current.coat];
    cat.style.setProperty('--fur', c.fur);
    cat.style.setProperty('--fur-shadow', c.shadow);
    cat.style.setProperty('--paw', c.paw);
    cat.style.setProperty('--ear-inner', c.earInner);
    cat.dataset.coat = current.coat;
    cat.dataset.accessory = current.accessory;

    document.querySelectorAll('.coat-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.coat === current.coat);
    });
    document.querySelectorAll('.acc-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.acc === current.accessory);
    });
  }

  function setCoat(name) {
    if (!COATS[name]) return;
    current.coat = name;
    save();
    apply();
    window.MeowCat?.playAnimation?.('bounce', 400);
    window.MeowCat?.showSpeech?.(`New ${COATS[name].label} coat~ ✨`, 2200);
  }

  function setAccessory(name) {
    if (!ACCESSORIES[name]) return;
    current.accessory = name;
    save();
    apply();
    if (name !== 'none') {
      window.MeowCat?.wiggle?.();
      window.MeowCat?.showSpeech?.(`${ACCESSORIES[name].label} looks cute! 💕`, 2200);
    }
  }

  function buildAppearanceUI() {
    const panel = document.getElementById('appearance-panel');
    if (!panel) return;

    const coatRow = panel.querySelector('.coat-swatches');
    const accRow = panel.querySelector('.acc-swatches');

    Object.entries(COATS).forEach(([id, c]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'coat-btn';
      btn.dataset.coat = id;
      btn.title = c.label;
      btn.style.background = c.fur;
      btn.style.borderColor = c.shadow;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setCoat(id);
      });
      coatRow.appendChild(btn);
    });

    Object.entries(ACCESSORIES).forEach(([id, a]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'acc-btn';
      btn.dataset.acc = id;
      btn.title = a.label;
      btn.textContent = a.emoji;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setAccessory(id);
      });
      accRow.appendChild(btn);
    });
  }

  function init() {
    loadSaved();
    buildAppearanceUI();
    apply();
  }

  window.MeowAppearance = { setCoat, setAccessory, apply, COATS, ACCESSORIES };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
