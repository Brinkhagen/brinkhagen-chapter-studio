const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.route('https://inkstone.webnovel.com/mock',route=>route.fulfill({
      status:200, contentType:'text/html',
      body:'<!doctype html><html><body><h1>Published</h1><main><a href="/edit/1">Chapter 01 - Original</a><a href="/edit/2">Chapter 02 - Original</a></main></body></html>'
    }));
    await page.goto('https://inkstone.webnovel.com/mock');
    await page.evaluate(() => {
      const saved = {}, listeners = [];
      window.chrome = {storage:{
        local:{
          async get(k) {return {[k]:saved[k]};},
          async set(obj) {Object.assign(saved,obj);for(const cb of listeners)cb(Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,{newValue:v}])), 'local');}
        },
        onChanged:{addListener(fn){listeners.push(fn);}}
      }};
    });
    const root = path.resolve(__dirname,'..');
    await page.addStyleTag({path:path.join(root,'src/panel.css')});
    await page.addScriptTag({path:path.join(root,'src/core.js')});
    await page.addScriptTag({path:path.join(root,'src/content.js')});
    await page.locator('#inkstone-pro-root').waitFor();
    await page.locator('#inkstone-pro-files').setInputFiles([
      {name:'CH01 - Revised.md',mimeType:'text/markdown',buffer:Buffer.from('The first replacement is here with enough characters.')},
      {name:'CH02 - Revised.md',mimeType:'text/markdown',buffer:Buffer.from('The second replacement is here with enough characters.')}
    ]);
    await page.locator('[data-ip="scan"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.ip-item.ip-ok').length === 2);
    assert.equal(await page.locator('.ip-item.ip-ok').count(),2);
    assert.equal(await page.locator('.ip-error').count(),0);
    assert.equal(await page.locator('[data-ip="backup"]').isEnabled(),true);
    assert.equal(await page.locator('[data-ip="apply"]').isEnabled(),false);
    console.log('UI smoke: passed (2 matches, backup enabled, destructive apply disabled)');
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
