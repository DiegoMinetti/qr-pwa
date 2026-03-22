import React, { useRef, useEffect, useState } from 'react'
import QRCode from 'qrcode'

function QRImageStyler({ value = 'Hello, QR!', size = 256, imageUrl = null, moduleImageUrl = null, backgroundUrl = null, scale = 1, fillMode = 'mask' }) {
  const canvasRef = useRef(null)
  const [svgStr, setSvgStr] = useState('')
  const [maskDataUrl, setMaskDataUrl] = useState('')

  useEffect(() => {
    let mounted = true
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = size * scale
    canvas.height = size * scale
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    async function draw() {
      // Try to create QR matrix using `qrcode`'s internal API
      let qrModel = null
      try {
        qrModel = QRCode.create ? QRCode.create(value, { errorCorrectionLevel: 'H' }) : null
      } catch (e) {
        qrModel = null
      }

      if (!qrModel || !qrModel.modules) {
        // Fallback: draw a plain QR to canvas (less control over modules)
        await QRCode.toCanvas(canvas, value, { errorCorrectionLevel: 'H', width: canvas.width })
        return
      }

      const modules = qrModel.modules
      const moduleCount = modules.length
      const moduleSize = canvas.width / moduleCount

      let moduleImg = null
      if (moduleImageUrl) {
        moduleImg = await loadImage(moduleImageUrl)
      }

      // Two improved rendering strategies when a module image is provided:
      // - 'pattern': create a repeating pattern and fill each module with it
      // - 'mask' (default): draw the full image once and mask by the QR modules (faster, single draw)
      if (moduleImg && fillMode === 'pattern') {
        const pattern = ctx.createPattern(moduleImg, 'repeat')
        ctx.fillStyle = pattern
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (modules[r][c]) {
              const x = c * moduleSize
              const y = r * moduleSize
              ctx.fillRect(x, y, moduleSize, moduleSize)
            }
          }
        }
      } else if (moduleImg && fillMode === 'mask') {
        // Create mask canvas where modules are opaque
        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = canvas.width
        maskCanvas.height = canvas.height
        const mctx = maskCanvas.getContext('2d')
        mctx.fillStyle = '#000'
        mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
        mctx.fillStyle = '#fff'
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (modules[r][c]) {
              const x = c * moduleSize
              const y = r * moduleSize
              mctx.fillRect(x, y, moduleSize, moduleSize)
            }
          }
        }

        // Draw the module image covering the whole canvas (cover behavior)
        // compute cover sizing
        const img = moduleImg
        const arImg = img.width / img.height
        const arCanvas = canvas.width / canvas.height
        let dw = canvas.width, dh = canvas.height, dx = 0, dy = 0
        if (arImg > arCanvas) {
          // image wider: scale height to canvas, crop width
          dh = canvas.height
          dw = dh * arImg
          dx = -(dw - canvas.width) / 2
        } else {
          // image taller: scale width to canvas, crop height
          dw = canvas.width
          dh = dw / arImg
          dy = -(dh - canvas.height) / 2
        }
        ctx.drawImage(img, dx, dy, dw, dh)

        // Use mask: keep only pixels where mask is white
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(maskCanvas, 0, 0)
        ctx.globalCompositeOperation = 'source-over'

      } else {
        // default module drawing (solid squares)
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (modules[r][c]) {
              const x = c * moduleSize
              const y = r * moduleSize
              ctx.fillStyle = '#000'
              ctx.fillRect(x, y, moduleSize, moduleSize)
            }
          }
        }
      }

      if (imageUrl) {
        const logo = await loadImage(imageUrl)
        const logoSize = canvas.width * 0.2
        const lx = (canvas.width - logoSize) / 2
        const ly = (canvas.height - logoSize) / 2
        // Draw logo on top of modules (ensure it is visible)
        ctx.fillStyle = '#fff'
        // optional rounded background to improve contrast
        const pad = 6 * scale
        const bx = lx - pad
        const by = ly - pad
        const bsize = logoSize + pad * 2
        roundedRect(ctx, bx, by, bsize, bsize, 8 * scale)
        ctx.fill()
        ctx.drawImage(logo, lx, ly, logoSize, logoSize)
      }

      const svg = buildSvg(modules, moduleSize, moduleImageUrl, imageUrl, backgroundUrl, canvas.width)
      if (mounted) setSvgStr(svg)

      // If backgroundUrl provided, build a mask SVG and expose as data URL for CSS masking
      if (backgroundUrl) {
        const maskSvg = buildMaskSvg(modules, moduleSize, canvas.width)
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(maskSvg)}`
        if (mounted) setMaskDataUrl(dataUrl)
      } else {
        if (mounted) setMaskDataUrl('')
      }
    }

    draw()
    return () => {
      mounted = false
    }
  }, [value, size, imageUrl, moduleImageUrl, backgroundUrl, scale])

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function buildSvg(modules, moduleSize, moduleImageUrl, centerImageUrl, backgroundUrl, totalSize) {
    const moduleCount = modules.length
    const parts = []
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`)
    if (backgroundUrl) {
      // build a mask and draw the background image through it
      const mid = `m${Date.now()}`
      parts.push(`<defs><mask id="${mid}"><rect width="${totalSize}" height="${totalSize}" fill="black"/>`)
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (modules[r][c]) {
            const x = c * moduleSize
            const y = r * moduleSize
            parts.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="white"/>`)
          }
        }
      }
      parts.push(`</mask></defs>`)
      parts.push(`<image href="${backgroundUrl}" x="0" y="0" width="${totalSize}" height="${totalSize}" preserveAspectRatio="xMidYMid slice" mask="url(#${mid})"/>`)
    } else if (moduleImageUrl) {
      const pid = `p${Date.now()}`
      const mid = `m${Date.now()}`
      parts.push(`<defs>`)
      parts.push(`<pattern id="${pid}" patternUnits="userSpaceOnUse" width="${totalSize}" height="${totalSize}">`)
      parts.push(`<image href="${moduleImageUrl}" x="0" y="0" width="${totalSize}" height="${totalSize}" preserveAspectRatio="xMidYMid slice"/>`)
      parts.push(`</pattern>`)

      // mask: black background, white where modules are present
      parts.push(`<mask id="${mid}"><rect width="${totalSize}" height="${totalSize}" fill="black"/>`)
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (modules[r][c]) {
            const x = c * moduleSize
            const y = r * moduleSize
            parts.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="white"/>`)
          }
        }
      }
      parts.push(`</mask>`)
      parts.push(`</defs>`)

      // draw patterned rect masked by modules
      parts.push(`<rect width="${totalSize}" height="${totalSize}" fill="url(#${pid})" mask="url(#${mid})"/>`)
    } else {
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (modules[r][c]) {
            const x = c * moduleSize
            const y = r * moduleSize
            parts.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#000"/>`)
          }
        }
      }
    }

    if (centerImageUrl) {
      const logoSize = totalSize * 0.2
      const x = (totalSize - logoSize) / 2
      const y = x
      parts.push(`<image href="${centerImageUrl}" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`)
    }

    parts.push('</svg>')
    return parts.join('')
  }

  // Build an SVG mask where white = visible (module), black = hidden
  function buildMaskSvg(modules, moduleSize, totalSize) {
    const moduleCount = modules.length
    const parts = []
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`)
    parts.push(`<rect width="${totalSize}" height="${totalSize}" fill="black"/>`)
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (modules[r][c]) {
          const x = c * moduleSize
          const y = r * moduleSize
          parts.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="white"/>`)
        }
      }
    }
    parts.push('</svg>')
    return parts.join('')
  }

  function downloadPNG() {
    const canvas = canvasRef.current
    // If we generated an SVG that includes the background, rasterize that for PNG
    if (svgStr) {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const tmp = canvas || document.createElement('canvas')
        tmp.width = img.width
        tmp.height = img.height
        const ctx = tmp.getContext('2d')
        ctx.clearRect(0, 0, tmp.width, tmp.height)
        ctx.drawImage(img, 0, 0, tmp.width, tmp.height)
        const dataUrl = tmp.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = 'qr.png'
        a.click()
        URL.revokeObjectURL(url)
      }
      img.onerror = () => URL.revokeObjectURL(url)
      img.src = url
      return
    }

    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'qr.png'
    a.click()
  }

  function downloadSVG() {
    if (!svgStr) return
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'qr.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {maskDataUrl && backgroundUrl ? (
        <div>
          <div
            aria-hidden
            style={{
              width: size,
              height: size,
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              maskImage: `url(${maskDataUrl})`,
              WebkitMaskImage: `url(${maskDataUrl})`,
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%'
            }}
          />
          {/* keep canvas as a hidden fallback for PNG export */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ width: size, height: size }} />
      )}

      <div style={{ marginTop: 8 }}>
        <button onClick={downloadPNG}>Download PNG</button>
        <button onClick={downloadSVG} style={{ marginLeft: 8 }}>Download SVG</button>
      </div>
      {/* Hidden SVG preview for quick copy */}
      <div style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: svgStr }} />
    </div>
  )
}

export default QRImageStyler
