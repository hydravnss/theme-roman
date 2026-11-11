/**
 * Thème Roman — mise en page typographique sans bulles pour SillyTavern.
 * Police Apple dans le chat, dialogue blanc gras, italique dont la couleur est réglable.
 *
 * Ne touche ni à #send_form / #form_sheld, ni à la hauteur de #sheld.
 */

const MODULE_NAME = 'theme_roman';
const LOG = '[Thème Roman]';
const HEADER = 'tr-header';
const HEX_RE = /^#[0-9a-f]{6}$/i;
const DEFAULT_ITALIC = '#c8b080';

const defaultSettings = Object.freeze({
    enabled: true,
    italic: DEFAULT_ITALIC,
});

const ctx = () => {
    try { return globalThis.SillyTavern?.getContext?.() ?? null; } catch { return null; }
};
const save = () => {
    try { ctx()?.saveSettingsDebounced?.(); } catch (e) { console.warn(LOG, 'sauvegarde', e); }
};

let settings = null;
let chatObserver = null;
let headerEventsBound = false;
let headerTimer = 0;

function sanitizeColor(value) {
    const s = String(value || '').trim().toLowerCase();
    return HEX_RE.test(s) ? s : DEFAULT_ITALIC;
}

function loadSettings() {
    const store = ctx()?.extensionSettings;
    const src = store?.[MODULE_NAME] || {};
    settings = {
        enabled: typeof src.enabled === 'boolean' ? src.enabled : defaultSettings.enabled,
        italic: sanitizeColor(src.italic),
    };
    if (store) store[MODULE_NAME] = settings;
    return settings;
}

function applyColor() {
    const color = settings?.italic || DEFAULT_ITALIC;
    document.documentElement.style.setProperty('--tr-italic', color);
    document.body?.style.setProperty('--tr-italic', color);
}

function apply() {
    const on = !!(settings && settings.enabled);
    document.body.classList.toggle('tr-on', on);
    applyColor();
    if (on) {
        ensureAllHeaders();
        observeChat();
        bindHeaderEvents();
    } else {
        teardownAllHeaders();
        stopChatObserver();
    }
    refreshUi();
}

function ensureHeader(mes) {
    if (!(mes instanceof Element) || !mes.classList?.contains('mes')) return;
    if (mes.classList.contains('smallSysMes')) return;
    if (mes.querySelector(':scope > .mes_block > .' + HEADER) || mes.querySelector(':scope > .' + HEADER)) return;
    const block = mes.querySelector(':scope > .mes_block');
    if (!block) return;
    const av = mes.querySelector(':scope > .mesAvatarWrapper');
    const chName = block.querySelector(':scope > .ch_name');
    if (!av || !chName) return;
    const header = document.createElement('div');
    header.className = HEADER;
    block.insertBefore(header, block.firstChild);
    header.appendChild(av);
    header.appendChild(chName);
}

function teardownHeader(mes) {
    if (!(mes instanceof Element)) return;
    const header = mes.querySelector('.' + HEADER);
    if (!header) return;
    const av = header.querySelector('.mesAvatarWrapper');
    const chName = header.querySelector('.ch_name');
    const block = mes.querySelector(':scope > .mes_block') || header.parentElement;
    if (av) {
        const swipe = mes.querySelector(':scope > .swipe_left');
        const anchor = swipe || block;
        if (anchor && anchor.parentNode === mes) mes.insertBefore(av, anchor);
        else if (block) mes.insertBefore(av, block);
        else mes.insertBefore(av, mes.firstChild);
    }
    if (chName && block) block.insertBefore(chName, block.firstChild);
    header.remove();
}

function ensureAllHeaders() {
    document.querySelectorAll('#chat .mes').forEach(ensureHeader);
}

function teardownAllHeaders() {
    document.querySelectorAll('#chat .' + HEADER).forEach((h) => {
        const mes = h.closest('.mes');
        if (mes) teardownHeader(mes);
        else h.remove();
    });
}

function scheduleHeaders() {
    if (headerTimer) return;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
    headerTimer = raf(() => {
        headerTimer = 0;
        if (settings?.enabled) ensureAllHeaders();
    });
}

function bindHeaderEvents() {
    if (headerEventsBound) return;
    headerEventsBound = true;
    const c = ctx();
    const es = c?.eventSource;
    const et = c?.eventTypes || {};
    const bump = () => scheduleHeaders();
    for (const k of [
        'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_EDITED', 'MESSAGE_DELETED',
        'MESSAGE_SWIPED', 'USER_MESSAGE_RENDERED', 'CHARACTER_MESSAGE_RENDERED',
        'CHAT_CHANGED', 'CHAT_CREATED', 'GROUP_UPDATED',
    ]) {
        const ev = et[k] || k.toLowerCase();
        try { es?.on?.(ev, bump); } catch { /* ignore */ }
    }
}

function observeChat() {
    if (typeof MutationObserver === 'undefined') return;
    const chat = document.getElementById('chat');
    if (!chat || chatObserver) return;
    chatObserver = new MutationObserver(() => { if (settings?.enabled) scheduleHeaders(); });
    chatObserver.observe(chat, { childList: true, subtree: true });
}

function stopChatObserver() {
    chatObserver?.disconnect();
    chatObserver = null;
}

const SETTINGS_HTML = `
<div id="tr_settings" class="extension_container">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>Thème Roman</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <div class="tr-hint">Mise en page sans bulles, police Apple, dialogue en blanc. L’italique (les *actions* dans le texte) a la couleur que tu choisis ici.</div>
      <div class="tr-row">
        <label for="tr_enabled">Activer</label>
        <input type="checkbox" id="tr_enabled">
      </div>
      <div class="tr-row">
        <label for="tr_italic">Couleur de l’italique</label>
        <input type="color" id="tr_italic" value="${DEFAULT_ITALIC}">
        <input type="text" id="tr_italic_hex" class="text_pole tr-hex" maxlength="7" spellcheck="false" value="${DEFAULT_ITALIC}">
        <div id="tr_italic_reset" class="menu_button">Réinitialiser</div>
      </div>
      <div class="tr-preview" aria-hidden="true">
        <span class="tr-pv-normal">Le dialogue s’affiche en blanc, en gras.</span>
        <em class="tr-pv-italic">L’italique, toi tu en changes la couleur.</em>
      </div>
    </div>
  </div>
</div>`;

function refreshUi() {
    const on = document.getElementById('tr_enabled');
    const color = document.getElementById('tr_italic');
    const hex = document.getElementById('tr_italic_hex');
    if (!settings || !on || !color || !hex) return;
    on.checked = !!settings.enabled;
    color.value = settings.italic;
    if (document.activeElement !== hex) hex.value = settings.italic;
    const disabled = !settings.enabled;
    color.disabled = disabled;
    hex.disabled = disabled;
}

function setItalic(value, persist) {
    settings.italic = sanitizeColor(value);
    if (ctx()?.extensionSettings) ctx().extensionSettings[MODULE_NAME] = settings;
    if (persist) save();
    applyColor();
    refreshUi();
}

function bindSettingsUi() {
    const on = document.getElementById('tr_enabled');
    const color = document.getElementById('tr_italic');
    const hex = document.getElementById('tr_italic_hex');
    const reset = document.getElementById('tr_italic_reset');
    on.addEventListener('change', () => {
        settings.enabled = on.checked;
        if (ctx()?.extensionSettings) ctx().extensionSettings[MODULE_NAME] = settings;
        save();
        apply();
    });
    color.addEventListener('input', () => setItalic(color.value, true));
    hex.addEventListener('input', () => {
        const v = hex.value.trim();
        if (HEX_RE.test(v)) setItalic(v, true);
    });
    hex.addEventListener('change', () => {
        setItalic(hex.value, true);
        hex.value = settings.italic;
    });
    reset.addEventListener('click', () => setItalic(DEFAULT_ITALIC, true));
    refreshUi();
}

jQuery(async () => {
    loadSettings();
    window.jQuery('#extensions_settings2').append(SETTINGS_HTML);
    bindSettingsUi();
    apply();

    try {
        const { eventSource, event_types } = ctx() || {};
        if (eventSource && event_types) {
            eventSource.on(event_types.APP_READY, apply);
            eventSource.on(event_types.SETTINGS_LOADED_AFTER, () => {
                loadSettings();
                apply();
            });
        }
    } catch (err) {
        console.debug(LOG, 'évènements indisponibles', err);
    }
    console.log(LOG, 'chargé (1.0.0)');
});
