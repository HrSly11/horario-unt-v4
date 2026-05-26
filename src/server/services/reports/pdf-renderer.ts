import puppeteer from 'puppeteer';

/**
 * Renders HTML content to a PDF buffer using Puppeteer.
 * Optimized for landscape schedule grids.
 */
export async function renderPDF(
  html: string,
  options: { landscape?: boolean } = {}
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: options.tipo === 'gestion' ? false : (options.landscape ?? true),
      printBackground: true,
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
