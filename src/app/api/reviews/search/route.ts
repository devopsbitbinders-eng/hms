import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const platform = searchParams.get("platform") || "bookingComUrl";
  
  if (!query) {
    return NextResponse.json({ success: false, error: "Search query required" }, { status: 400 });
  }

  let browser;
  try {
    const puppeteer = require("puppeteer-extra");
    const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    if (!puppeteer.plugins || !puppeteer.plugins.find((p: any) => p.name === 'stealth')) {
      puppeteer.use(StealthPlugin());
    }

    // Run visibly for TripAdvisor to bypass basic blocks, but keep headless true for performance where possible.
    // For DuckDuckGo we can stay headless.
    browser = await puppeteer.launch({ 
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    let results: any[] = [];

    if (platform === "bookingComUrl") {
      const searchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('[data-testid="property-card"]', { timeout: 10000 }).catch(() => {});

      results = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid="property-card"]');
        const items: any[] = [];
        cards.forEach(card => {
          const name = card.querySelector('[data-testid="title"]')?.textContent?.trim();
          const link = card.querySelector('a')?.href;
          const address = card.querySelector('[data-testid="address"]')?.textContent?.trim();
          
          if (name && link) {
            const cleanLink = link.split('?')[0];
            items.push({ name, address, link: cleanLink });
          }
        });
        return items.slice(0, 5);
      });
    } else {
      // Map platform keys to their search domains
      const PLATFORM_DOMAINS: Record<string, string> = {
        tripAdvisorUrl: "tripadvisor.com",
        agodaUrl:       "agoda.com",
        makeMyTripUrl:  "makemytrip.com",
        expediaUrl:     "expedia.com",
        hotelsComUrl:   "hotels.com",
        airbnbUrl:      "airbnb.com",
        goibiboUrl:     "goibibo.com",
        yatraUrl:       "yatra.com",
        oyoUrl:         "oyorooms.com",
        easemytripUrl:  "easemytrip.com",
      };
      const site = PLATFORM_DOMAINS[platform] || "booking.com";
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${site} ${query}`)}`;
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      results = await page.evaluate(() => {
        const cards = document.querySelectorAll('.result');
        const items: any[] = [];
        cards.forEach(card => {
          const name = card.querySelector('.result__title')?.textContent?.trim();
          const a = card.querySelector('.result__a') as HTMLAnchorElement;
          const snippet = card.querySelector('.result__snippet')?.textContent?.trim();
          if (name && a && a.href) {
            // DuckDuckGo wraps links in a redirect. Extract the real URL from the uddg= query param.
            let finalUrl = a.href;
            try {
              const parsed = new URL(a.href);
              const uddg = parsed.searchParams.get('uddg');
              if (uddg) finalUrl = decodeURIComponent(uddg);
            } catch {}
            // Fallback: use the visible .result__url text if href parse fails
            if (!finalUrl || finalUrl.includes('duckduckgo.com')) {
              const urlText = card.querySelector('.result__url')?.textContent?.trim() || '';
              if (urlText) finalUrl = urlText.startsWith('http') ? urlText : `https://${urlText}`;
            }
            if (finalUrl && !finalUrl.includes('duckduckgo.com')) {
              items.push({ name, address: snippet?.substring(0, 80) + '...', link: finalUrl });
            }
          }
        });
        return items.slice(0, 5);
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Search API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
