const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:4174/';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if(response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const ready = () => page.waitForFunction(() => document.querySelector('#loading')?.hidden, null, { timeout: 60000 });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await ready();
    await page.locator('#next').click();
    await page.waitForFunction(() => spread === 1 && !motion);
    await page.locator('#previous').click();
    await page.waitForFunction(() => spread === 0 && !motion);
    await page.getByText('Book options', {exact:true}).click();
    await page.locator('#book-name').fill('Web shelf original');
    await page.locator('#book-name').dispatchEvent('input');
    await page.locator('#save-book').click();
    await page.locator('#book-name').fill('Web shelf renamed');
    await page.locator('#book-name').dispatchEvent('input');
    await page.locator('#save-book').click();
    assert.equal(await page.evaluate(() => savedBooks.length), 2);
    await page.reload(); await ready();
    assert.deepEqual(await page.evaluate(() => savedBooks.map(book => book.name)), ['Web shelf original', 'Web shelf renamed']);
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'buook-web-'));
    for (const pages of [8, 28, 56]) for (const edge of ['front', 'back']) {
      const geometry = await page.evaluate(({ pages, edge }) => {
        pageCount=pages; spread=edge==='front'?0:spreadCount()-1;
        bookContent.palette={outside:'#31594c',inside:'#587a62',metal:'gold'};
        applyBookPalette(false);closedEdge=edge;spineView=false;motion=null;draw();
        const points=[{x:300,y:134},{x:700,y:134},{x:710,y:624},{x:290,y:624}];
        const layer=closedBookLayers(points,1);
        const [a,b,c,d]=layer.paper;
        if(Math.abs((b.y-a.y)-(c.y-d.y))>1e-8)throw new Error('Wedge-shaped closed paper block');
        if(Math.abs((c.y-b.y)-(d.y-a.y))>1e-8)throw new Error('Unequal closed block depth');
        if(layer.farBoard[3].y<=d.y)throw new Error('Missing lower cover overhang');
        return {pages,edge,depth:layer.depth};
      }, {pages,edge});
      await page.locator('#book').screenshot({path:path.join(output,`closed-${edge}-${pages}.png`)});
      console.log(JSON.stringify(geometry));
    }
    await page.evaluate(() => {closedEdge=null;spineView=true;draw();});
    await page.locator('#book').screenshot({path:path.join(output,'spine.png')});
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({url,pageTurns:true,shelfRenameAndReload:true,errors,output}));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
