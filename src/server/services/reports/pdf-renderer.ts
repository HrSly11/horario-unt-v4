import puppeteer from 'puppeteer';

const SYSTEM_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
];

function findChrome(): string | undefined {
  const fs = require('fs');
  for (const p of SYSTEM_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export async function renderPDF(
  html: string,
  options: { landscape?: boolean } = {}
): Promise<Buffer> {
  const launchOpts: any = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  const chromePath = findChrome();
  if (chromePath) {
    launchOpts.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOpts);

  try {
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({
      format: 'A4',
      landscape: options.landscape ?? true,
      printBackground: true,
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
