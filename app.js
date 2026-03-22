// The QR code library is loaded via a UMD script tag in index.html
const QRCodeStyling = window.QRCodeStyling || null;
if(!QRCodeStyling) console.warn('QRCodeStyling not found — ensure the library script is included before app.js');

const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));

const qrHolder = $('#qr');
const wrapper = document.getElementById('qr-wrapper');
const statusEl = document.getElementById('status');
let currentImageDataUrl = null;
let currentBgDataUrl = null;
let currentImageSize = null;

const qr = new QRCodeStyling({
  width: 300,
  height: 300,
  data: 'Hello',
  type: 'svg',
  image: null,
  dotsOptions: {color: '#000', type: 'rounded'},
  backgroundOptions: {color: '#ffffff'}
});
try{
  if(qrHolder) qr.append(qrHolder);
  else console.warn('QR holder not found at script run; will append on load.');
}catch(e){ console.error('Failed to append QR:', e); if(statusEl) statusEl.textContent = 'Error al inicializar el visor de QR'; }

let lastGeneratedData = '';

// Helper: produce a PNG Blob from the library's SVG output (fallback when qr.getBlob is not available)
async function getPngBlobFromLibrarySvg() {
  try {
    let svg = await qr.getRawData('svg');
    if (typeof svg !== 'string') {
      if (svg && svg.outerHTML) svg = svg.outerHTML;
      else if (typeof XMLSerializer !== 'undefined' && svg && svg.documentElement) svg = new XMLSerializer().serializeToString(svg);
      else svg = String(svg);
    }
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = (err) => reject(err);
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width || qr.width || 300;
    canvas.height = img.height || qr.height || 300;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    URL.revokeObjectURL(url);
    return pngBlob;
  } catch (e) {
    console.error('getPngBlobFromLibrarySvg error', e);
    throw e;
  }
}

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
  const dotsType = (document.getElementById('dots-shape') || {}).value || 'rounded';
  const cornerSquareType = (document.getElementById('corner-square-shape') || {}).value || 'square';
  const cornerDotType = (document.getElementById('corner-dot-shape') || {}).value || 'dot';
  const marginVal = Number((document.getElementById('margin-range') || {}).value || 10);
  const moduleScale = Number((document.getElementById('module-scale') || {}).value || 1);
  const loading = document.getElementById('loading'); if(loading) loading.style.display = 'block';
  if(statusEl) statusEl.textContent = 'Generando...';
  try{
    const useImageFill = (document.getElementById('use-image-fill') || {}).checked;
    const transparentBgRequested = (document.getElementById('transparent-bg') || {}).checked;
    // determine background color to pass to the library: when using a wrapper background image
    // or when user explicitly requests transparency, pass 'transparent' so the SVG has no bg rect
    const bgColorForLibrary = (transparentBgRequested || !!currentBgDataUrl) ? 'transparent' : '#ffffff';
    qr.update({
      data,
      width: Math.round(size * moduleScale),
      height: Math.round(size * moduleScale),
      dotsOptions: {color, type: dotsType},
      backgroundOptions: { color: bgColorForLibrary },
      cornersSquareOptions: { type: cornerSquareType },
      cornersDotOptions: { type: cornerDotType },
      margin: marginVal,
      // If user wants to use the uploaded image as a fill for the modules,
      // don't pass it as the library `image` (which is a center logo) —
      // passing it causes the library to attempt canvas operations that
      // can fail when used as a pattern. Only pass `image` when not using
      // the image-as-fill feature.
      image: useImageFill ? null : (currentImageDataUrl || null),
      imageOptions: { crossOrigin: 'anonymous' }
    });
    // set CSS variable for visible QR size so the preview remains a square
    try{
      const qrEl = document.getElementById('qr');
      if(qrEl){ qrEl.style.setProperty('--qr-size', Math.round(size * moduleScale) + 'px'); }
    }catch(e){}
    // schedule applying module stroke after the library renders
    try{ setTimeout(()=>{ try{ applyModuleStrokeToHolder(); }catch(e){} }, 150); }catch(e){}
  }catch(err){
    console.error('qr.update error', err);
    if(statusEl) statusEl.textContent = 'Error generando el QR: ' + (err && err.message ? err.message : String(err));
    toast('Error generando el QR');
    if(loading) loading.style.display = 'none';
    return;
  }

  // store generated data and enable actions
  lastGeneratedData = data;
  const downloadPng = document.getElementById('download-png');
  const downloadSvg = document.getElementById('download-svg');
  const copyBtn = document.getElementById('copy-data');
  const shareBtn = document.getElementById('share-data');
  if(downloadPng) downloadPng.removeAttribute('aria-disabled');
  if(downloadSvg) downloadSvg.removeAttribute('aria-disabled');
  if(copyBtn) copyBtn.removeAttribute('disabled');
  if(shareBtn) shareBtn.removeAttribute('disabled');

  if(currentBgDataUrl){
    wrapper.style.backgroundImage = `url(${currentBgDataUrl})`;
  } else {
    wrapper.style.backgroundImage = '';
  }
  if(statusEl) statusEl.textContent = 'QR generado';
  if(loading) loading.style.display = 'none';
}

// If user wants to use the uploaded image as a fill for QR lines, generate modified SVG
async function generatePatternedSVGIfNeeded(){
  const use = document.getElementById('use-image-fill');
  if(!use || !use.checked) return false;
  if(!currentImageDataUrl) { toast('Cargue una imagen para usar como relleno'); return false; }
  try{
    // Ensure the uploaded image is fully loaded before generating pattern
    await new Promise((resolve, reject)=>{
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = ()=> resolve();
      img.onerror = ()=> {
        console.warn('Uploaded image failed to load for pattern');
        // still resolve so we can attempt with data URL
        resolve();
      };
      img.src = currentImageDataUrl;
    });

    let rawSvg = await qr.getRawData('svg');
    // coerce to string if library returned a Document/SVGElement
    if(typeof rawSvg !== 'string'){
      if(rawSvg && rawSvg.outerHTML) rawSvg = rawSvg.outerHTML;
      else if(typeof XMLSerializer !== 'undefined' && rawSvg && rawSvg.documentElement) rawSvg = new XMLSerializer().serializeToString(rawSvg);
      else rawSvg = String(rawSvg);
    }
    // quick sanity: ensure we actually got an SVG
    if(!rawSvg || rawSvg.indexOf('<svg') === -1){
      console.error('generatePatternedSVGIfNeeded: qr.getRawData did not return valid SVG', rawSvg);
      toast('No se obtuvo SVG válido para aplicar el patrón');
      return false;
    }

    const patterned = applyImagePatternToSvg(String(rawSvg), currentImageDataUrl);
    // render into holder
    const holder = document.getElementById('qr');
    if(holder){
      // if stroke requested, apply stroke to the patterned svg as well
      try{
        const strokeEnabled = !!(document.getElementById('module-stroke-enable') || {}).checked;
        if(strokeEnabled){
          const strokeColor = (document.getElementById('module-stroke-color') || {}).value || '#ffffff';
          const strokeWidth = Number((document.getElementById('module-stroke-width') || {}).value) || 2;
          holder.innerHTML = applyStrokeToSvg(patterned, (document.getElementById('color')||{}).value || '#000', strokeColor, strokeWidth);
        } else {
          holder.innerHTML = patterned;
        }
      }catch(e){ holder.innerHTML = patterned; }
    }
    return true;
  }catch(e){ console.error('pattern svg error', e); toast('No se pudo aplicar patrón'); return false; }
}

// Inject a <pattern> with the image and replace fills with the pattern reference
function applyImagePatternToSvg(svgString, imageDataUrl){
  // defensive: ensure svgString is a string
  if(typeof svgString !== 'string') svgString = String(svgString);
  const pid = 'imgPattern' + Date.now();
  // Prefer parsing the SVG and updating attributes instead of brittle string replaces
  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      // Detect parse errors
      const parserErrors = doc.getElementsByTagName('parsererror');
      if(parserErrors && parserErrors.length){
        console.error('SVG parse error', parserErrors[0].textContent);
        // throw to fall back to string replacement
        throw new Error('SVG parse error');
      }
      const svgEl = doc.documentElement;
      // create defs/pattern
      const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const pattern = doc.createElementNS('http://www.w3.org/2000/svg', 'pattern');
      pattern.setAttribute('id', pid);
      pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      // Try to size the pattern to the image natural size if possible.
      let patternW = 100, patternH = 100;
      try{
        const probe = new Image(); probe.src = imageDataUrl;
        patternW = probe.naturalWidth || 100; patternH = probe.naturalHeight || 100;
      }catch(e){ }
      pattern.setAttribute('width', String(patternW));
      pattern.setAttribute('height', String(patternH));
      const img = doc.createElementNS('http://www.w3.org/2000/svg', 'image');
      // Use href and xlink:href for compatibility
      img.setAttribute('href', imageDataUrl);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', imageDataUrl);
      img.setAttribute('x', '0'); img.setAttribute('y', '0'); img.setAttribute('width', '100'); img.setAttribute('height', '100');
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      pattern.appendChild(img);
      defs.appendChild(pattern);
      svgEl.insertBefore(defs, svgEl.firstChild);

      const isBlackValue = (v) => {
        if (!v) return false;
        const val = v.trim().toLowerCase();
        return val === '#000' || val === '#000000' || val === 'black';
      };

      const all = svgEl.querySelectorAll('*');
      all.forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
          const v = el.getAttribute(attr);
          if (v && isBlackValue(v)) {
            el.setAttribute(attr, `url(#${pid})`);
          }
        });
        const style = el.getAttribute('style');
        if (style) {
          const parts = style.split(';').map(p => p.trim()).filter(Boolean);
          let changed = false;
          const newParts = parts.map(p => {
            const idx = p.indexOf(':');
            if (idx === -1) return p;
            const key = p.slice(0, idx).trim();
            const val = p.slice(idx + 1).trim();
            if ((key === 'fill' || key === 'stroke') && isBlackValue(val)) {
              changed = true;
              return `${key}:url(#${pid})`;
            }
            return p;
          });
          if (changed) el.setAttribute('style', newParts.join(';'));
        }
      });

      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    }
  } catch (e) {
    // fall back to simpler string replace if parsing fails
    console.warn('applyImagePatternToSvg: DOM parse failed, falling back to regex', e);
  }

  // Fallback: insert defs and replace common black fills
  const svgOpenMatch = svgString.match(/<svg[^>]*>/i);
  if(!svgOpenMatch) return svgString;
  const svgOpen = svgOpenMatch[0];
  const defsStr = `\n<defs>\n  <pattern id="${pid}" patternUnits="userSpaceOnUse" width="100" height="100">\n    <image href="${imageDataUrl}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />\n  </pattern>\n</defs>\n`;
  let out = svgString.replace(svgOpen, svgOpen + defsStr);
  out = out.replace(/(fill=\")(#000|#000000|black)(\")/gi, `$1url(#${pid})$3`);
  out = out.replace(/(stroke=\")(#000|#000000|black)(\")/gi, `$1url(#${pid})$3`);
  out = out.replace(/(fill:\s*)(#000|#000000|black)(;?)/gi, `$1url(#${pid})$3`);
  return out;
}

// Apply stroke (outline) to modules/elements that have the main fill color
function applyStrokeToSvg(svgString, targetFillColor, strokeColor, strokeWidth){
  if(typeof svgString !== 'string') svgString = String(svgString);
  try{
    if(typeof DOMParser !== 'undefined'){
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgEl = doc.documentElement;
      const normalize = (v) => (v||'').trim().toLowerCase();
      const t = normalize(targetFillColor);
      const all = svgEl.querySelectorAll('*');
      all.forEach(el => {
        const f = normalize(el.getAttribute('fill'));
        const s = normalize(el.getAttribute('stroke'));
        // If element's fill or stroke matches the target color, add stroke attributes
        if(f === t || s === t){
          el.setAttribute('stroke', strokeColor);
          el.setAttribute('stroke-width', String(strokeWidth));
          // ensure stroke is drawn outside shapes by setting stroke-linejoin/linecap
          el.setAttribute('stroke-linejoin', 'round');
          el.setAttribute('stroke-linecap', 'round');
        }
        // Also adjust inline style declarations
        const style = el.getAttribute('style');
        if(style){
          const parts = style.split(';').map(p=>p.trim()).filter(Boolean);
          let changed = false;
          const newParts = parts.map(p=>{
            const idx = p.indexOf(':'); if(idx===-1) return p; const k = p.slice(0,idx).trim(); const v = p.slice(idx+1).trim();
            if((k==='fill' || k==='stroke') && normalize(v)===t){ changed = true; return `stroke:${strokeColor}`; }
            return p;
          });
          if(changed) el.setAttribute('style', newParts.join(';'));
        }
      });
      return new XMLSerializer().serializeToString(doc);
    }
  }catch(e){ console.warn('applyStrokeToSvg parse failed', e); }
  // Fallback: simple regex-based replace — try adding stroke attrs on common elements
  // Insert stroke attributes into tags that have a fill matching the target color
  try{
    const t = (targetFillColor||'').replace('#','').toLowerCase();
    const re = new RegExp(`(<(rect|path|circle|ellipse|g|polygon|polyline|use)[^>]*fill=["']?)(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)(["']?)`, 'gi');
    return svgString.replace(re, function(m, p1, p2, p3, p4){
      // append stroke and stroke-width
      const strokeAttrs = ` stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`;
      return p1 + p3 + p4 + strokeAttrs;
    });
  }catch(e){ return svgString; }
}

// Convert hex like '#rrggbb' to [r,g,b]
function hexToRgbArr(hex){
  if(!hex) return null;
  const h = hex.replace('#','');
  if(h.length===3){
    return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  }
  if(h.length===6){
    return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
  }
  return null;
}

function rgbStringToArr(rgb){
  if(!rgb) return null;
  const m = rgb.match(/rgba?\(([^)]+)\)/);
  if(!m) return null;
  return m[1].split(',').slice(0,3).map(x=>parseInt(x.trim()));
}

function colorArrEqual(a,b,tol=2){
  if(!a||!b||a.length!==3||b.length!==3) return false;
  for(let i=0;i<3;i++) if(Math.abs(a[i]-b[i])>tol) return false;
  return true;
}

// Apply stroke to elements in the live DOM SVG by checking computed styles
async function applyModuleStrokeToHolder(){
  try{
    const holder = document.getElementById('qr');
    if(!holder) return;
    // wait for an svg to be present (library may render asynchronously)
    let svgEl = holder.querySelector('svg');
    const start = Date.now();
    while(!svgEl && (Date.now() - start) < 2000){
      await new Promise(r=>setTimeout(r,80));
      svgEl = holder.querySelector('svg');
    }
    if(!svgEl) return;
    const strokeEnabled = !!(document.getElementById('module-stroke-enable') || {}).checked;
    if(!strokeEnabled) return;
    const strokeColor = (document.getElementById('module-stroke-color') || {}).value || '#ffffff';
    const strokeWidth = Number((document.getElementById('module-stroke-width') || {}).value) || 2;
    const targetColor = (document.getElementById('color') || {}).value || '#000000';
    const targetArr = hexToRgbArr(targetColor);
    // iterate all shape elements
    const elems = svgEl.querySelectorAll('*');
    elems.forEach(el=>{
      try{
        const cs = window.getComputedStyle(el);
        const fillStr = cs && cs.fill ? cs.fill : (el.getAttribute && el.getAttribute('fill'));
        const strokeStr = cs && cs.stroke ? cs.stroke : (el.getAttribute && el.getAttribute('stroke'));
        const fillArr = rgbStringToArr(fillStr) || hexToRgbArr((fillStr||'').replace('none',''));
        const strokeArr = rgbStringToArr(strokeStr) || hexToRgbArr((strokeStr||'').replace('none',''));
        const matches = (fillArr && colorArrEqual(fillArr, targetArr)) || (strokeArr && colorArrEqual(strokeArr, targetArr));
        if(matches){
          el.setAttribute('stroke', strokeColor);
          el.setAttribute('stroke-width', String(strokeWidth));
          el.setAttribute('stroke-linejoin', 'round');
          el.setAttribute('stroke-linecap', 'round');
        }
      }catch(e){}
    });
  }catch(e){ console.warn('applyModuleStrokeToHolder failed', e); }
}

// UI wiring
$('#type').addEventListener('change', e=>{
  $all('[data-for]').forEach(el=>el.classList.add('hidden'));
  const sel = `[data-for="${e.target.value}"]`;
  const el = document.querySelector(sel);
  if(el) el.classList.remove('hidden');
});

$('#generate').addEventListener('click', ()=>{
  (async ()=>{
    updateQRCode();
    // if patterned option set, override the visual with patterned svg
    await generatePatternedSVGIfNeeded();
    // ensure stroke is applied after any patterned replacement
    try{ await applyModuleStrokeToHolder(); }catch(e){}
  })();
});

// Sync slider displays and update preview live
(function bindSliderDisplays(){
  const marginRange = document.getElementById('margin-range');
  const marginDisplay = document.getElementById('margin-value');
  if(marginRange && marginDisplay){
    marginDisplay.textContent = marginRange.value;
    marginRange.addEventListener('input', (e)=>{
      marginDisplay.textContent = e.target.value;
      try{ updateQRCode(); }catch(e){}
    });
  }

  const moduleScale = document.getElementById('module-scale');
  const moduleScaleDisplay = document.getElementById('module-scale-value');
  if(moduleScale && moduleScaleDisplay){
    moduleScaleDisplay.textContent = Number(moduleScale.value).toFixed(2);
    moduleScale.addEventListener('input', (e)=>{
      moduleScaleDisplay.textContent = Number(e.target.value).toFixed(2);
      try{ updateQRCode(); }catch(e){}
    });
  }
})();

// Debounce helper to avoid excessive updates
function debounce(fn, wait){
  let t = null;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this, args), wait);
  };
}

const debouncedUpdate = debounce(()=>{
  try{ updateQRCode(); }catch(e){ console.error('debounced update failed', e); }
}, 220);

// Auto-recalculate QR when form controls change (input/change events inside controls panel)
const controlsPanel = document.getElementById('controls-panel');
if(controlsPanel){
  const handler = (e)=>{
    const t = e.target;
    if(!t) return;
    // ignore clicks on action links/buttons and file inputs (they have their own handlers)
    if(t.tagName === 'A' || t.tagName === 'BUTTON') return;
    if(t.type === 'file') return;
    debouncedUpdate();
  };
  controlsPanel.addEventListener('input', handler);
  controlsPanel.addEventListener('change', handler);
}

$('#download-png').addEventListener('click', async ()=>{
  // If patterned svg is rendered in holder, rasterize it to PNG; otherwise use library blob
  const holder = document.getElementById('qr');
  if(holder && holder.querySelector('svg')){
    const svgEl = holder.querySelector('svg');
    const svgStr = svgEl.outerHTML;
    const blob = new Blob([svgStr], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0);
      canvas.toBlob(b=>{
        const u = URL.createObjectURL(b);
        const a = document.createElement('a'); a.href = u; a.download = 'qr.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = async ()=>{
      // fallback to library SVG -> rasterize to PNG
      try {
        const blob = await getPngBlobFromLibrarySvg();
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = u; a.download = 'qr.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
      } catch (err) {
        console.error('Fallback PNG generation failed', err);
        toast('No se pudo generar PNG desde el QR');
      }
    };
    img.src = url;
  } else {
    const blob = await getPngBlobFromLibrarySvg();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'qr.png';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
});

$('#download-svg').addEventListener('click', async ()=>{
  // If patterned applied, download the patterned SVG from the holder; otherwise fall back to library SVG
  const holder = document.getElementById('qr');
  let svg = '';
  if(holder && holder.querySelector('svg')) svg = holder.querySelector('svg').outerHTML;
  if(!svg){ svg = await qr.getRawData('svg'); }
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
  r.onload = ()=>{
    const data = r.result;
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = ()=>{
      currentImageSize = { w: probe.naturalWidth || probe.width, h: probe.naturalHeight || probe.height };
      currentImageDataUrl = data;
      // warn when image is very small for use as pattern
      if(currentImageSize.w < 64 || currentImageSize.h < 64){
        toast('Imagen pequeña: puede producir un patrón pobre. Use imagen >= 64×64 o desactive "Usar la foto como relleno".');
      }
      updateQRCode();
    };
    probe.onerror = ()=>{
      // still set data URL but inform user
      currentImageDataUrl = data;
      currentImageSize = null;
      toast('No se pudo inspeccionar la imagen; intentando generar de todos modos.');
      updateQRCode();
    };
    probe.src = data;
  };
  r.readAsDataURL(f);
});

// Remove logo button
const removeLogoBtn = document.getElementById('remove-logo');
if(removeLogoBtn){
  removeLogoBtn.addEventListener('click', ()=>{
    currentImageDataUrl = null;
    currentImageSize = null;
    try{
      const f = document.getElementById('logo-file');
      if(f){ f.value = ''; const fp = f.closest('.file-field').querySelector('.file-path'); if(fp) fp.value = ''; }
    }catch(e){}
    updateQRCode(); toast('Logo eliminado');
  });
}

$('#bg-file').addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ currentBgDataUrl = r.result; updateQRCode(); };
  r.readAsDataURL(f);
});

// Remove background button
const removeBgBtn = document.getElementById('remove-bg');
if(removeBgBtn){
  removeBgBtn.addEventListener('click', ()=>{
    currentBgDataUrl = null;
    try{
      const f = document.getElementById('bg-file');
      if(f){ f.value = ''; const fp = f.closest('.file-field').querySelector('.file-path'); if(fp) fp.value = ''; }
      const wrapper = document.getElementById('qr-wrapper'); if(wrapper) wrapper.style.backgroundImage = '';
    }catch(e){}
    updateQRCode(); toast('Fondo eliminado');
  });
}

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
  if(window.M && M.FormSelect){ M.FormSelect.init(sel); }
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
    bg: currentBgDataUrl,
    transparent: !!(document.getElementById('transparent-bg') || {}).checked,
    stroke: {
      enabled: !!(document.getElementById('module-stroke-enable') || {}).checked,
      color: (document.getElementById('module-stroke-color') || {}).value || '#ffffff',
      width: Number((document.getElementById('module-stroke-width') || {}).value) || 2
    }
  };
  list.push(preset); savePresets(list); refreshPresetsUI();
  if(window.M && M.toast) M.toast({html: 'Preset guardado'});
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
  try{ const tb = document.getElementById('transparent-bg'); if(tb) tb.checked = !!p.transparent; }catch(e){}
  try{ const s = p.stroke || {}; const se = document.getElementById('module-stroke-enable'); if(se) se.checked = !!s.enabled; const sc = document.getElementById('module-stroke-color'); if(sc) sc.value = s.color || '#ffffff'; const sw = document.getElementById('module-stroke-width'); if(sw) sw.value = s.width || 2; }catch(e){}
  updateQRCode();
});

$('#delete-preset').addEventListener('click', ()=>{
  const idx = Number($('#presets').value);
  if(isNaN(idx)) return alert('Seleccione un preset');
  const list = loadPresets(); list.splice(idx,1); savePresets(list); refreshPresetsUI();
  if(window.M && M.toast) M.toast({html: 'Preset borrado'});
});

// Init
refreshPresetsUI(); updateQRCode();

// --- Demo presets and visual tests ---
const demoPresets = [
  { name: 'High contrast (black on white)', opts: { type: 'text', data: 'https://example.com', size: 300, color: '#000000', bg: null, dotsType: 'square', cornerSquareType: 'square', cornerDotType: 'dot', margin: 10, moduleScale: 1 } },
  { name: 'Rounded dots, blue', opts: { type: 'url', data: 'https://example.com', size: 320, color: '#0b77ff', bg: '#ffffff', dotsType: 'rounded', cornerSquareType: 'extra-rounded', cornerDotType: 'dot', margin: 8, moduleScale: 1 } },
  { name: 'Dense, small margin', opts: { type: 'text', data: 'contact: demo', size: 280, color: '#111111', bg: '#f7f7f7', dotsType: 'dots', cornerSquareType: 'square', cornerDotType: 'dot', margin: 2, moduleScale: 0.95 } }
];

function applyDemoPreset(preset){
  const o = preset.opts || {};
  try{
    $('#type').value = o.type || 'text';
    $('#size').value = o.size || 300;
    $('#color').value = o.color || '#000000';
    if(o.bg){ currentBgDataUrl = o.bg; } else currentBgDataUrl = null;
    // set selects
    const dots = document.getElementById('dots-shape'); if(dots) dots.value = o.dotsType || 'rounded';
    const cs = document.getElementById('corner-square-shape'); if(cs) cs.value = o.cornerSquareType || 'square';
    const cd = document.getElementById('corner-dot-shape'); if(cd) cd.value = o.cornerDotType || 'dot';
    const margin = document.getElementById('margin-range'); if(margin) margin.value = o.margin == null ? 10 : o.margin;
    const ms = document.getElementById('module-scale'); if(ms) ms.value = o.moduleScale == null ? 1 : o.moduleScale;
    // update displays
    const marginDisplay = document.getElementById('margin-value'); if(marginDisplay) marginDisplay.textContent = margin.value;
    const msDisplay = document.getElementById('module-scale-value'); if(msDisplay) msDisplay.textContent = Number(ms.value).toFixed(2);
    // set data input
    if(o.type === 'url') { $('#url-input').value = o.data || ''; }
    else { const ta = document.querySelector('[data-for="text"] textarea'); if(ta) ta.value = o.data || ''; }
    // apply
    updateQRCode();
    return true;
  }catch(e){ console.error('applyDemoPreset error', e); return false; }
}

function luminance(hex){
  if(!hex) return 0;
  const m = hex.replace('#','');
  const r = parseInt(m.substring(0,2),16)/255;
  const g = parseInt(m.substring(2,4),16)/255;
  const b = parseInt(m.substring(4,6),16)/255;
  const srgb = [r,g,b].map(c=> c<=0.03928 ? c/12.92 : Math.pow(((c+0.055)/1.055),2.4));
  return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
}

function contrastRatio(hexA, hexB){
  try{
    const L1 = luminance(hexA); const L2 = luminance(hexB);
    const bright = Math.max(L1,L2); const dark = Math.min(L1,L2);
    return (bright + 0.05) / (dark + 0.05);
  }catch(e){ return 1; }
}

function runVisualTests(){
  const color = document.getElementById('color').value || '#000000';
  const bg = currentBgDataUrl || '#ffffff';
  // if bg is data URL, assume white background for contrast calculation
  const bgColor = (typeof bg === 'string' && bg.startsWith('#')) ? bg : '#ffffff';
  const ratio = contrastRatio(color, bgColor);
  const contrastPass = ratio >= 4.5;
  const results = { contrastRatio: Number(ratio.toFixed(2)), contrastPass };
  // logo check: we cannot get actual logo size from library reliably; warn if logo present
  results.logoPresent = !!currentImageDataUrl;
  if(results.logoPresent){ results.logoNote = 'Logo detected — ensure it covers <=20% area and has transparency if needed.'; }
  return results;
}

async function runDemo(){
  const status = document.getElementById('status');
  if(status) status.textContent = 'Iniciando demo...';
  for(let i=0;i<demoPresets.length;i++){
    const p = demoPresets[i];
    if(status) status.textContent = `Aplicando preset: ${p.name}`;
    applyDemoPreset(p);
    // allow rendering
    await new Promise(r=>setTimeout(r,900));
    // try patterned if user asked
    await generatePatternedSVGIfNeeded();
    const res = runVisualTests();
    if(status) status.textContent = `Preset: ${p.name} — contraste: ${res.contrastRatio} (${res.contrastPass ? 'OK':'FAIL'})` + (res.logoPresent? ' — logo: sí':'');
    if(!res.contrastPass) toast(`Advertencia: bajo contraste (${res.contrastRatio}) para preset '${p.name}'`);
    await new Promise(r=>setTimeout(r,1100));
  }
  if(status) status.textContent = 'Demo finalizado';
}

// Wire demo button
const runDemoBtn = document.getElementById('run-demo');
if(runDemoBtn){ runDemoBtn.addEventListener('click', ()=>{ runDemo().catch(e=>{ console.error(e); toast('Demo falló'); }); }); }

// Initialize Materialize components where available
if(window.M){
  try{
    document.addEventListener('DOMContentLoaded', ()=>{
      M.FormSelect.init(document.querySelectorAll('select'));
      M.updateTextFields && M.updateTextFields();
    });
  }catch(e){}
}

// Utility: toast wrapper
function toast(msg){ if(window.M && M.toast) M.toast({html: msg}); else console.log(msg); }

// Copy current data to clipboard
function setupCopyAndShare(){
  const copyBtn = document.getElementById('copy-data');
  if(copyBtn){
    copyBtn.addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(lastGeneratedData || ''); toast('Datos copiados al portapapeles'); }
      catch(e){ toast('No se pudo copiar'); }
    });
    copyBtn.setAttribute('disabled','');
  }

  const shareBtn = document.getElementById('share-data');
  if(shareBtn){
    shareBtn.addEventListener('click', async ()=>{
      const shareText = lastGeneratedData || '';
      if(navigator.share){
        try{ await navigator.share({text: shareText}); toast('Compartido'); }
        catch(e){ toast('Compartir cancelado'); }
      } else {
        try{ await navigator.clipboard.writeText(shareText); toast('Datos copiados (sin Web Share)'); }
        catch(e){ toast('No se pudo compartir'); }
      }
    });
    shareBtn.setAttribute('disabled','');
  }
}

setupCopyAndShare();

// Service Worker registration with feedback
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(reg=>{
    toast('Service Worker registrado — app disponible offline');

    // Listen for updates to the Service Worker
    if(reg.waiting){
      // there's an updated SW waiting to activate
      toast('Nueva versión disponible — recarga para actualizar');
      if(confirm('Hay una nueva versión. ¿Recargar para actualizar?')) window.location.reload();
    }

    reg.addEventListener('updatefound', ()=>{
      const newWorker = reg.installing;
      if(newWorker){
        newWorker.addEventListener('statechange', ()=>{
          if(newWorker.state === 'installed'){
            if(navigator.serviceWorker.controller){
              // New update available
              toast('Nueva versión disponible — recarga para actualizar');
              if(confirm('Hay una nueva versión. ¿Recargar para actualizar?')){
                // ask SW to skip waiting then reload
                newWorker.postMessage({type:'SKIP_WAITING'});
                window.location.reload();
              }
            }
          }
        });
      }
    });

    // When the active SW takes control, notify
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      toast('Service Worker activo — recargando');
      window.location.reload();
    });

  }).catch(()=>{ toast('Service Worker no registrado'); });
}

// Online/offline indicator
function updateOnlineIndicator(){ const ind = document.getElementById('online-indicator'); if(!ind) return; if(navigator.onLine){ ind.textContent='Online'; ind.className='chip green white-text'; } else { ind.textContent='Offline'; ind.className='chip red white-text'; } }
window.addEventListener('online', e=>{ updateOnlineIndicator(); toast('Conectado'); });
window.addEventListener('offline', e=>{ updateOnlineIndicator(); toast('Sin conexión'); });
updateOnlineIndicator();

// Keyboard: Enter to generate from inputs
Array.from(document.querySelectorAll('input, textarea')).forEach(inp=>{
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('generate').click(); } });
});

// focus first input on load
window.addEventListener('load', ()=>{ const t = document.querySelector('[data-for="text"] textarea') || document.querySelector('#url-input') || document.querySelector('#wifi-ssid'); if(t) t.focus(); });

// Reset color control
const resetColorBtn = document.getElementById('reset-color');
if(resetColorBtn){
  resetColorBtn.addEventListener('click', ()=>{
    try{ const c = document.getElementById('color'); if(c){ c.value = '#000000'; } }catch(e){}
    updateQRCode(); toast('Color restaurado');
  });
}

// On load ensure QR is appended and Materialize components initialized
window.addEventListener('load', ()=>{
  const holder = document.getElementById('qr');
  if(holder && !holder.querySelector('canvas') && !holder.querySelector('svg')){
    try{ qr.append(holder); }catch(e){ console.error('Append on load failed', e); if(statusEl) statusEl.textContent='Error inicializando QR'; }
  }
  if(window.M && M.FormSelect) M.FormSelect.init(document.querySelectorAll('select'));
});

// Mobile controls toggle
const controlsToggle = document.getElementById('controls-toggle');
const controlsPanelToggle = document.getElementById('controls-panel');
if(controlsToggle && controlsPanelToggle){
  controlsToggle.addEventListener('click', (e)=>{
    e.preventDefault();
    const open = controlsPanelToggle.classList.toggle('open');
    controlsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open){ controlsPanelToggle.querySelector('[id]') && controlsPanelToggle.querySelector('[id]').focus(); }
  });
}
