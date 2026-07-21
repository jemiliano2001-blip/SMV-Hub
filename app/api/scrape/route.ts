import * as cheerio from 'cheerio'
import { verificarUsuarioAutorizado } from '@/lib/api-auth'
import { SCRAPERS, genericScraper } from '@/lib/scrapers'

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

    // redirect: 'manual' evita que fetch siga automáticamente un redirect hacia
    // un host fuera de la whitelist antes de que podamos validarlo.
    let currentUrl = parsedUrl
    let response = await fetch(currentUrl.toString(), { headers, redirect: 'manual' })
    let redirectHops = 0

    while (response.status >= 300 && response.status < 400) {
      if (redirectHops >= 3) {
        return Response.json(
          { error: 'URL inválida o dominio no permitido' },
          { status: 400 }
        )
      }

      const location = response.headers.get('location')
      if (!location) {
        return Response.json(
          { error: 'URL inválida o dominio no permitido' },
          { status: 400 }
        )
      }

      let resolvedUrl: URL
      try {
        resolvedUrl = new URL(location, currentUrl)
      } catch {
        return Response.json(
          { error: 'URL inválida o dominio no permitido' },
          { status: 400 }
        )
      }

      if (!hostnamePermitido(resolvedUrl.hostname)) {
        return Response.json(
          { error: 'URL inválida o dominio no permitido' },
          { status: 400 }
        )
      }

      currentUrl = resolvedUrl
      redirectHops += 1
      response = await fetch(currentUrl.toString(), { headers, redirect: 'manual' })
    }

    if (!response.ok) {
      throw new Error(`Error fetching URL: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    let title = ''
    let price: number | null = null
    let provider = ''

    const hostname = currentUrl.hostname.toLowerCase()
    
    // Find matching scraper strategy based on hostname
    const match = Object.entries(SCRAPERS).find(([key]) => hostname.includes(key))
    
    if (match) {
      const scraper = match[1]
      provider = scraper.provider
      const result = scraper.extract($)
      title = result.title
      price = result.price
    } else {
      // Generic fallback
      const result = genericScraper(hostname, $)
      provider = result.provider
      title = result.title
      price = result.price
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

