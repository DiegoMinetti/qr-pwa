import QRCodeStyling from 'https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js';

const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));

const qrHolder = $('#qr');
const wrapper = document.getElementById('qr-wrapper');
let currentImageDataUrl = null;
let currentBgDataUrl = null;

const qr = new QRCodeStyling({
  width: 300,
  height: 300,
  data: 'Hello',
  image: null,
  dotsOptions: {color: '#000', type: 'rounded'},
  backgroundOptions: {color: '#ffffff'}
});
qr.append(qrHolder);

function typeToValue(type){
  if(type==='text') return $('#text-input').value || '';
  if(type==='url') return $('#url-input').value || '';
  if(type==='wifi'){
    const ssid = $('#wifi-ssid').value;
    const pass = $('#wifi-pass').value;
    const auth = $('#wifi-auth').value;
    const hidden = $('#wifi-hidden').checked ? 'true' : 'false';
    return `WIFI:T:${auth};S:${ssid};P:${pass};H:${hidden};;`;
  }
  if(type==='contact'){
    const n = $('#contact-name').value;
    const p = $('#contact-phone').value;
    const e = $('#contact-email').value;
    const o = $('#contact-org').value;
    return `BEGIN:VCARD\nVERSION:3.0\nFN:${n}\nORG:${o}\nTEL:${p}\nEMAIL:${e}\nEND:VCARD`;
  }
  return '';
}

function updateQRCode(){
  const type = $('#type').value;
  const data = typeToValue(type);
  const size = Number($('#size').value) || 300;
  const color = $('#color').value || '#000';

  qr.update({
    data,
    width: size,
    height: size,
    dotsOptions: {color, type: 'rounded'},
    image: currentImageDataUrl || null
  });

  if(currentBgDataUrl){
    wrapper.style.backgroundImage = `url(${currentBgDataUrl})`;
  } else {
    wrapper.style.backgroundImage = '';
  }
}

// UI wiring
$('#type').addEventListener('change', e=>{
  $all('[data-for]').forEach(el=>el.classList.add('hidden'));
  const sel = `[data-for="${e.target.value}"]`;
  const el = document.querySelector(sel);
  if(el) el.classList.remove('hidden');
});

$('#generate').addEventListener('click', ()=>{
  updateQRCode();
});

$('#download-png').addEventListener('click', async ()=>{
  const blob = await qr.getBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'qr.png';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

$('#download-svg').addEventListener('click', async ()=>{
  const svg = await qr.getRawData('svg');
  const blob = new Blob([svg], {type:'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'qr.svg';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// Image uploads
$('#logo-file').addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ currentImageDataUrl = r.result; updateQRCode(); };
  r.readAsDataURL(f);
});

$('#bg-file').addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ currentBgDataUrl = r.result; updateQRCode(); };
  r.readAsDataURL(f);
});

// Presets (localStorage)
const STORAGE_KEY = 'qr-presets-v1';
function loadPresets(){
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function savePresets(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

function refreshPresetsUI(){
  const sel = $('#presets'); sel.innerHTML = '';
  const list = loadPresets();
  list.forEach((p, i)=>{
    const o = document.createElement('option'); o.value = i; o.textContent = p.name || (`Preset ${i+1}`);
    sel.appendChild(o);
  });
}

$('#save-preset').addEventListener('click', ()=>{
  const list = loadPresets();
  const name = prompt('Nombre del preset:') || (`Preset ${list.length+1}`);
  const preset = {
    name,
    type: $('#type').value,
    data: typeToValue($('#type').value),
    size: $('#size').value,
    color: $('#color').value,
    image: currentImageDataUrl,
    bg: currentBgDataUrl
  };
  list.push(preset); savePresets(list); refreshPresetsUI();
});

$('#presets').addEventListener('change', ()=>{
  const idx = Number($('#presets').value);
  const list = loadPresets();
  const p = list[idx];
  if(!p) return;
  $('#type').value = p.type || 'text';
  $('#size').value = p.size || 300;
  $('#color').value = p.color || '#000';
  currentImageDataUrl = p.image || null;
  currentBgDataUrl = p.bg || null;
  updateQRCode();
});

$('#delete-preset').addEventListener('click', ()=>{
  const idx = Number($('#presets').value);
  if(isNaN(idx)) return alert('Seleccione un preset');
  const list = loadPresets(); list.splice(idx,1); savePresets(list); refreshPresetsUI();
});

// Init
refreshPresetsUI(); updateQRCode();

// Service Worker registration
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
