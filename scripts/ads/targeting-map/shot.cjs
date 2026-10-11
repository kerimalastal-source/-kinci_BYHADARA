const { chromium } = require(process.env.GLOBAL_NM + "/playwright");
(async () => {
  const [html, png, w, h] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  await p.goto("file://" + html);
  await p.waitForTimeout(600);
  await p.screenshot({ path: png });
  await b.close();
})();
