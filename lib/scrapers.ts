import type * as cheerio from 'cheerio'
import { parsePrice } from '@/lib/scrape'

export interface ScrapeResult {
  title: string
  price: number | null
}

export type ScraperFn = ($: cheerio.CheerioAPI) => ScrapeResult

export const SCRAPERS: Record<string, { provider: string; extract: ScraperFn }> = {
  'amazon': {
    provider: 'Amazon',
    extract: ($) => {
      const title = $('#productTitle').text().trim()
      const priceText = $('.a-price .a-offscreen').first().text() || $('#priceblock_ourprice').text() || $('#priceblock_dealprice').text()
      return { title, price: priceText ? parsePrice(priceText) : null }
    }
  },
  'ebay': {
    provider: 'eBay',
    extract: ($) => {
      const title = $('.x-item-title__mainTitle span').text().trim() || $('#itemTitle').text().replace('Details about  ', '').trim()
      const priceText = $('.x-price-primary span').text() || $('#prcIsum').text()
      return { title, price: priceText ? parsePrice(priceText) : null }
    }
  },
  'mcmaster.com': {
    provider: 'McMaster-Carr',
    extract: ($) => {
      const title = $('h1').text().trim() || $('meta[property="og:title"]').attr('content') || ''
      const priceText = $('.Price').first().text() || $('[data-mcm-price]').attr('data-mcm-price')
      return { title, price: priceText ? parsePrice(priceText) : null }
    }
  },
  'mscdirect.com': {
    provider: 'MSC Industrial Supply',
    extract: ($) => {
      const title = $('h1.product-title').text().trim() || $('h1').text().trim()
      const priceText = $('.product-price .price').first().text() || $('.item-price').text()
      return { title, price: priceText ? parsePrice(priceText) : null }
    }
  },
  'digikey': {
    provider: 'DigiKey',
    extract: ($) => {
      const title = $('h1').text().trim() || $('title').text().replace(' | DigiKey', '').trim()
      const priceText = $('[data-testid="price-and-procure-title"]').text() || $('.product-details-price').text()
      return { title, price: priceText ? parsePrice(priceText) : null }
    }
  },
  'mouser': {
    provider: 'Mouser',
    extract: ($) => {
      const title = $('h1').text().trim() || $('#spnDescription').text().trim()
      const priceText = $('.price-pricing').first().text() || $('.pdp-pricing-table .price').first().text()
      return { title, price: priceText ? parsePrice(priceText) : null }
    }
  },
  'homedepot': {
    provider: 'Home Depot',
    extract: ($) => {
      const title = $('h1').text().trim()
      const priceText = $('.price-format__main-price').first().text() || $('.price__format').first().text()
      return { title, price: priceText ? parsePrice(priceText) : null }
    }
  }
}

export function genericScraper(hostname: string, $: cheerio.CheerioAPI): { provider: string } & ScrapeResult {
  let provider = hostname.replace('www.', '').split('.')[0]
  provider = provider.charAt(0).toUpperCase() + provider.slice(1)
  
  const title = $('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text().trim()
  const possiblePrice = $('[itemprop="price"]').attr('content') || $('[property="product:price:amount"]').attr('content')
  
  return {
    provider,
    title,
    price: possiblePrice ? parsePrice(possiblePrice) : null
  }
}
