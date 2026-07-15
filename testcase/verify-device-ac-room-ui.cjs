const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('http://127.0.0.1:8802/pages/device-ac-room.html');
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    const row = [...document.querySelectorAll('#treeBody tr')]
      .find((item) => item.querySelector('.cell-name span:last-child')?.textContent === '1号楼');
    row.querySelector('.arr').click();
  });
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('#treeBody tr')]
      .find((item) => item.querySelector('.cell-name span:last-child')?.textContent === '13层');
    row.querySelector('.arr').click();
  });

  const markerState = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#treeBody tr')];
    const byName = (name) => rows.find((row) =>
      row.querySelector('.cell-name span:last-child')?.textContent === name);
    return {
      building: byName('1号楼').children[2].textContent.trim(),
      floor: byName('13层').children[2].textContent.trim(),
      roomSwitches: byName('1301').children[2].querySelectorAll('.switch').length,
      roomText: byName('1301').children[2].textContent.trim()
    };
  });
  assert.deepEqual(markerState, {
    building: '—',
    floor: '—',
    roomSwitches: 1,
    roomText: ''
  });

  await page.evaluate(() => {
    const row = [...document.querySelectorAll('#treeBody tr')]
      .find((item) => item.querySelector('.cell-name span:last-child')?.textContent === '1302');
    row.querySelector('.switch').click();
  });
  assert.deepEqual(await page.evaluate(() => {
    const row = [...document.querySelectorAll('#treeBody tr')]
      .find((item) => item.querySelector('.cell-name span:last-child')?.textContent === '1302');
    const button = row.querySelector('.switch');
    return {
      active: button.classList.contains('on'),
      checked: button.getAttribute('aria-checked')
    };
  }), { active: true, checked: 'true' });

  await page.evaluate(() => {
    const row = [...document.querySelectorAll('#treeBody tr')]
      .find((item) => item.querySelector('.cell-name span:last-child')?.textContent === '1301');
    row.querySelector('input[type="checkbox"]').click();
  });
  const selectedRows = await page.evaluate(() => relFiltered.map((row) =>
    [row.bld, row.fl, row.room]));
  assert.ok(selectedRows.length > 0);
  assert.ok(selectedRows.every((row) =>
    row[0] === '1号楼' && row[1] === '13层' && row[2] === '1301'));
  await page.screenshot({
    path: path.join(os.tmpdir(), 'device-ac-room-filtered.png'),
    fullPage: true
  });

  await page.evaluate(() => {
    const row = [...document.querySelectorAll('#treeBody tr')]
      .find((item) => item.querySelector('.cell-name span:last-child')?.textContent === '1301');
    row.querySelector('input[type="checkbox"]').click();
  });
  assert.equal(await page.evaluate(() => relFiltered.length), 618);

  await page.screenshot({
    path: path.join(os.tmpdir(), 'device-ac-room-verified.png'),
    fullPage: true
  });
  assert.deepEqual(consoleErrors, []);
  } finally {
    await browser.close();
  }
  console.log('device-ac-room UI interaction passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
