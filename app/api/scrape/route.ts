import * as cheerio from 'cheerio'
import { verificarUsuarioAutorizado } from '@/lib/api-auth'
import { parsePrice } from '@/lib/scrape'

const HOSTS_PERMITIDOS = [
  'amazon.com',
  'amazon.com.mx',
  'ebay.com',
  'ebay.com.mx',
  'mcmaster.com',
  'mscdirect.com',
  'digikey.com',
  'digikey.mx',
  'mouser.com',
  'mouser.mx',
  'homedepot.com',
  'homedepot.com.mx',
  'mercadolibre.com.mx',
] as const

function hostnamePermitido(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return HOSTS_PERMITIDOS.some((permitido) => host === permitido || host.endsWith(`.${permitido}`))
}

function parsearUrlPermitida(url: unknown): URL | null {
  if (typeof url !== 'string') return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    if (!hostnamePermitido(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    // 1. Verificar Autenticación
    const auth = await verificarUsuarioAutorizado(request)
    if (!auth.ok) return auth.response

    // 2. Lógica Original
    const { url } = await request.json()
    const parsedUrl = parsearUrlPermitida(url)

    if (!parsedUrl) {
      return Response.json(
        { error: 'URL inválida o dominio no permitido' },
        { status: 400 }
      )
    }

    // Default headers to simulate a real browser to bypass simple bot protections
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
    }

    const response = await fetch(parsedUrl.toString(), { headers })

    if (!response.ok) {
      throw new Error(`Error fetching URL: ${response.status} ${response.statusText}`)
    }

    // fetch sigue redirects: re-validar que el host final siga en la whitelist.
    if (!hostnamePermitido(new URL(response.url).hostname)) {
      return Response.json(
        { error: 'URL inválida o dominio no permitido' },
        { status: 400 }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    let title = ''
    let price = null
    let provider = ''

    const hostname = parsedUrl.hostname.toLowerCase()

    // --- Provider-specific parsing logic ---
    if (hostname.includes('amazon.')) {
      provider = 'Amazon'
      title = $('#productTitle').text().trim()
      const priceText = $('.a-price .a-offscreen').first().text() || $('#priceblock_ourprice').text() || $('#priceblock_dealprice').text()
      if (priceText) {
        price = parsePrice(priceText)
      }
    } 
    else if (hostname.includes('ebay.')) {
      provider = 'eBay'
      title = $('.x-item-title__mainTitle span').text().trim() || $('#itemTitle').text().replace('Details about  ', '').trim()
      const priceText = $('.x-price-primary span').text() || $('#prcIsum').text()
      if (priceText) {
        price = parsePrice(priceText)
      }
    }
    else if (hostname.includes('mcmaster.com')) {
      provider = 'McMaster-Carr'
      // McMaster is heavily JS rendered, but sometimes we can grab title from the meta tags or h1
      title = $('h1').text().trim() || $('meta[property="og:title"]').attr('content') || ''
      const priceText = $('.Price').first().text() || $('[data-mcm-price]').attr('data-mcm-price')
      if (priceText) price = parsePrice(priceText)
    }
    else if (hostname.includes('mscdirect.com')) {
      provider = 'MSC Industrial Supply'
      title = $('h1.product-title').text().trim() || $('h1').text().trim()
      const priceText = $('.product-price .price').first().text() || $('.item-price').text()
      if (priceText) price = parsePrice(priceText)
    }
    else if (hostname.includes('digikey.')) {
      provider = 'DigiKey'
      title = $('h1').text().trim() || $('title').text().replace(' | DigiKey', '').trim()
      const priceText = $('[data-testid="price-and-procure-title"]').text() || $('.product-details-price').text()
      if (priceText) price = parsePrice(priceText)
    }
    else if (hostname.includes('mouser.')) {
      provider = 'Mouser'
      title = $('h1').text().trim() || $('#spnDescription').text().trim()
      const priceText = $('.price-pricing').first().text() || $('.pdp-pricing-table .price').first().text()
      if (priceText) price = parsePrice(priceText)
    }
    else if (hostname.includes('homedepot.')) {
      provider = 'Home Depot'
      title = $('h1').text().trim()
      const priceText = $('.price-format__main-price').first().text() || $('.price__format').first().text()
      if (priceText) price = parsePrice(priceText)
    }
    else {
      // Generic fallback
      provider = hostname.replace('www.', '').split('.')[0]
      // Capitalize first letter
      provider = provider.charAt(0).toUpperCase() + provider.slice(1)
      
      title = $('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text().trim()
      
      // Try to find a price generic
      const possiblePrice = $('[itemprop="price"]').attr('content') || $('[property="product:price:amount"]').attr('content')
      if (possiblePrice) price = parsePrice(possiblePrice)
    }

    return Response.json({
      title: title || 'No se pudo extraer la descripción',
      price,
      provider
    })

  } catch (error) {
    console.error('Error in scrape API:', error instanceof Error ? error.message : 'error desconocido')
    return Response.json({ 
      error: 'No se pudo extraer la información. Es posible que la página bloquee el acceso automatizado.' 
    }, { status: 500 })
  }
}

