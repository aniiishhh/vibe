// Records each scene of the demo video from the mock UI clone.
// Usage: node scenes.mjs hook start class trip memory pip solo outfits   (any subset)
import { open, sleep, humanType, glideTo, waitRunsDone, pipAt } from './lib.mjs';

const CLASS = 'p-class';
const TRIP = 'p-trip';

async function send(page, text, speed) {
  await page.locator('textarea.composer-input').click();
  await humanType(page, text, speed);
  await sleep(500);
  await glideTo(page, 'button.send-button', 12);
  await page.locator('button.send-button').click();
}

const scenes = {
  // Four friends talking over each other in the class party.
  async hook() {
    const take = await open({ path: `/parties/${CLASS}?scene=class`, storage: pipAt(0.93, 0.78) });
    const { page } = take;
    await sleep(2200);
    take.mark('start');
    const lines = [
      ['u-leo', 'ok which 500-level CSE class are we doing together??'],
      ['u-jordan', 'something with a group project pls, I need a team'],
      ['u-maya', 'anything but 8ams 😭 also I’m vegetarian so no dining hall study sessions lol'],
      ['u-priya', 'lol fair. I just want one that isn’t brutal'],
      ['u-leo', 'wait do we even know who’s teaching it'],
    ];
    for (const [author, text] of lines) {
      await page.evaluate(([a, t]) => window.__director.post(a, t, 'p-class'), [author, text]);
      take.mark(`msg ${author}`);
      await sleep(850);
    }
    await sleep(2500);
    await take.finish('hook');
  },

  // Create a party from a starter; Vibe picks the Studies theme.
  async start() {
    const take = await open({ path: '/?scene=home' });
    const { page } = take;
    await page.mouse.move(1300, 760);
    await sleep(1500);
    take.mark('start');
    await glideTo(page, 'button.starter:has-text("Classes next semester")', 30);
    await sleep(250);
    await page.locator('button.starter:has-text("Classes next semester")').click();
    take.mark('dialog');
    await sleep(1400);
    await glideTo(page, 'button[type=submit]:has-text("Create party")', 26);
    await sleep(200);
    await page.locator('button[type=submit]:has-text("Create party")').click();
    take.mark('choosing theme');
    await page.locator('button:has-text("Continue to chat")').waitFor();
    take.mark('created');
    await sleep(1200);
    await glideTo(page, 'button:has-text("Continue to chat")', 22);
    await page.locator('button:has-text("Continue to chat")').click();
    take.mark('party open');
    await sleep(4500);
    await take.finish('start');
  },

  // Four @Vibe questions, each hitting a different source, then notes, task and invite.
  async class() {
    const take = await open({ path: `/parties/${CLASS}?scene=class-chatter`, storage: pipAt(0.93, 0.8) });
    const { page } = take;
    await page.mouse.move(1500, 860);
    await sleep(2500);
    take.mark('start');
    await send(page, '@Vibe what 500-level CSE classes are open for spring?');
    take.mark('q1 sent');
    await waitRunsDone(page, CLASS);
    take.mark('q1 answered');
    await sleep(6000);
    await page.evaluate(() => window.__director.post('u-priya', '@Vibe how heavy is CSE 511? any final project?', 'p-class'));
    take.mark('q2 sent');
    await waitRunsDone(page, CLASS);
    take.mark('q2 answered');
    await sleep(3500);
    await page.evaluate(() => window.__director.post('u-leo', '@Vibe what do students say about the profs?', 'p-class'));
    take.mark('q3 sent');
    await waitRunsDone(page, CLASS);
    take.mark('q3 answered');
    await sleep(6500);
    await page.evaluate(() => window.__director.post('u-jordan', '@Vibe which section works for all 4 of us? Maya can’t do 8ams', 'p-class'));
    take.mark('q4 sent');
    await waitRunsDone(page, CLASS);
    take.mark('q4 answered');
    await sleep(5600);
    await glideTo(page, '.msg-vibe:last-of-type .message-sources summary, .message-group:last-child .message-sources summary', 22);
    await sleep(200);
    await page.locator('.message-sources summary').last().click();
    take.mark('sources');
    await sleep(2800);
    // Teamwork: details panel, accept the task, switch mode, invite.
    await glideTo(page, 'button[aria-label="Party details"]', 24);
    await page.locator('button[aria-label="Party details"]').click();
    take.mark('details open');
    await sleep(1600);
    await page.locator('.details-section:has(h3:has-text("Party notes"))').evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    take.mark('notes');
    await sleep(2200);
    await page.locator('.details-section:has(h3:has-text("Tasks and Vibe mode"))').evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await sleep(1400);
    await glideTo(page, 'button:has-text("Accept assignment")', 22);
    await sleep(200);
    await page.locator('button:has-text("Accept assignment")').click();
    take.mark('accepted');
    await sleep(1500);
    await glideTo(page, 'select[aria-label="Vibe mode"]', 18);
    await page.locator('select[aria-label="Vibe mode"]').selectOption('focused');
    take.mark('mode focused');
    await sleep(700);
    await page.locator('select[aria-label="Vibe mode"]').selectOption('banter');
    take.mark('mode banter');
    await sleep(1400);
    await glideTo(page, '.party-actions button:has-text("Invite")', 24);
    await page.locator('.party-actions button:has-text("Invite")').click();
    take.mark('invite open');
    await sleep(900);
    await glideTo(page, 'button:has-text("Create link and QR code")', 18);
    await page.locator('button:has-text("Create link and QR code")').click();
    take.mark('qr');
    await sleep(3500);
    await take.finish('class');
  },

  // Day trip: weather check, then an itinerary that respects Maya's approved memory.
  async trip() {
    const take = await open({ path: `/parties/${TRIP}?scene=trip-chatter`, storage: pipAt(0.93, 0.8) });
    const { page } = take;
    await page.mouse.move(1500, 860);
    await sleep(2500);
    take.mark('start');
    await page.evaluate(() => window.__director.post('u-jordan', '@Vibe what’s the weather Saturday in Sedona vs Flagstaff?', 'p-trip'));
    take.mark('weather sent');
    await waitRunsDone(page, TRIP);
    take.mark('weather answered');
    await sleep(14000);
    await send(page, '@Vibe plan our day? we leave Tempe at 9');
    take.mark('plan sent');
    await waitRunsDone(page, TRIP);
    take.mark('plan answered');
    await sleep(8000);
    await take.finish('trip');
  },

  // Supermemory: approve the learned point, then switch it on for the trip party.
  async memory() {
    const take = await open({ path: '/memory?scene=memory', dark: true });
    const { page } = take;
    await page.mouse.move(1300, 700);
    await sleep(2000);
    take.mark('start');
    await page.locator('#memory-mem-veg').evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(1600);
    take.mark('candidate visible');
    await glideTo(page, '#memory-mem-veg button:has-text("Approve for reuse")', 26);
    await sleep(250);
    await page.locator('#memory-mem-veg button:has-text("Approve for reuse")').click();
    take.mark('approved');
    await sleep(2600);
    await glideTo(page, 'a.party-nav-item:has-text("Saturday day trip")', 28);
    await page.locator('a.party-nav-item:has-text("Saturday day trip")').click();
    take.mark('trip open');
    await sleep(2200);
    await glideTo(page, 'button[aria-label="Party details"]', 24);
    await page.locator('button[aria-label="Party details"]').click();
    take.mark('details open');
    await sleep(1500);
    await glideTo(page, 'button[aria-label="Use my approved memory in this party"]', 22);
    await sleep(300);
    await page.locator('button[aria-label="Use my approved memory in this party"]').click();
    take.mark('sharing on');
    await sleep(3000);
    await take.finish('memory');
  },

  // Pip's reactions in a live chat: peek, laugh, love, sad, drag, dizzy, nap, poke.
  async pip() {
    const take = await open({ path: `/parties/${TRIP}?scene=pip&sleepMs=7000`, storage: pipAt(0.62, 0.62) });
    const { page } = take;
    await page.mouse.move(1500, 300);
    await sleep(3200);
    take.mark('start');
    await page.locator('textarea.composer-input').click();
    take.mark('typing');
    await humanType(page, 'lol Pip is so cute', 80);
    take.mark('typed lol');
    await sleep(2400);
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.mouse.move(1500, 300, { steps: 10 });
    await sleep(1200);
    await page.evaluate(() => window.__director.post('u-leo', 'thank you for planning this!! ❤️', 'p-trip'));
    take.mark('love');
    await sleep(3000);
    await page.evaluate(() => window.__director.post('u-priya', 'ugh I have two exams that week 😭', 'p-trip'));
    take.mark('sad');
    await sleep(3200);
    const pip = page.locator('button.pip-dock');
    const box = await pip.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy, { steps: 20 });
    await sleep(300);
    await page.mouse.down();
    take.mark('grab');
    const path = [[-200, -60], [-420, -140], [-180, -220], [80, -120], [-60, -40]];
    for (const [dx, dy] of path) { await page.mouse.move(cx + dx, cy + dy, { steps: 22 }); await sleep(120); }
    await page.mouse.up();
    take.mark('drop');
    await page.mouse.move(cx + 300, cy + 200, { steps: 15 });
    await sleep(9500);
    take.mark('asleep');
    await sleep(2500);
    const nap = await pip.boundingBox();
    await page.mouse.move(nap.x + nap.width / 2, nap.y + nap.height * 0.55, { steps: 20 });
    await sleep(200);
    await page.mouse.down();
    await sleep(90);
    await page.mouse.up();
    take.mark('poke');
    await sleep(3500);
    await take.finish('pip');
  },

  // TinyFish: two live-web questions, each answer's Sources opened.
  async tinyfish() {
    const take = await open({ path: `/parties/${TRIP}?scene=trip-chatter`, storage: pipAt(0.93, 0.8) });
    const { page } = take;
    await page.mouse.move(1500, 860);
    await sleep(2500);
    take.mark('start');
    await page.evaluate(() => window.__director.post('u-jordan', '@Vibe what’s the weather Saturday in Sedona vs Flagstaff?', 'p-trip'));
    take.mark('weather sent');
    await waitRunsDone(page, TRIP);
    take.mark('weather answered');
    await sleep(4500);
    await glideTo(page, '.message-sources summary', 20);
    await page.locator('.message-sources summary').last().click();
    take.mark('weather sources');
    await sleep(3500);
    await page.evaluate(() => window.__director.post('u-leo', '@Vibe is Slide Rock open Saturday? how much is parking?', 'p-trip'));
    take.mark('park sent');
    await waitRunsDone(page, TRIP);
    take.mark('park answered');
    await sleep(5000);
    await glideTo(page, '.message-group:last-child .message-sources summary', 20);
    await page.locator('.message-sources summary').last().click();
    take.mark('park sources');
    await sleep(3500);
    await take.finish('tinyfish');
  },

  // Supermemory: learning switch, categorized profile, then correct vegetarian -> vegan.
  async memory2() {
    const take = await open({ path: '/memory?scene=memory2', dark: true });
    const { page } = take;
    await page.mouse.move(1300, 700);
    await sleep(2200);
    take.mark('start');
    await glideTo(page, 'summary:has-text("Your categorized profile")', 24);
    await page.locator('summary:has-text("Your categorized profile")').click();
    take.mark('profile open');
    await sleep(2500);
    await page.locator('#memory-mem-veg').evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(1500);
    await glideTo(page, '#memory-mem-veg button:has-text("Edit")', 22);
    await page.locator('#memory-mem-veg button:has-text("Edit")').click();
    take.mark('edit');
    await sleep(700);
    const box = page.locator('#memory-mem-veg textarea');
    await box.click();
    await page.keyboard.press('Meta+A');
    await humanType(page, 'Vegan. No meat, dairy or eggs.', 60);
    take.mark('typed');
    await sleep(500);
    await glideTo(page, '#memory-mem-veg button:has-text("Save changes")', 18);
    await page.locator('#memory-mem-veg button:has-text("Save changes")').click();
    take.mark('saved');
    await sleep(3500);
    await take.finish('memory2');
  },

  // SES: send an email invitation from the invite dialog.
  async invite() {
    const take = await open({ path: `/parties/${CLASS}?scene=class-chatter`, storage: pipAt(0.93, 0.8) });
    const { page } = take;
    await page.mouse.move(1500, 700);
    await sleep(2200);
    take.mark('start');
    await glideTo(page, '.party-actions button:has-text("Invite")', 24);
    await page.locator('.party-actions button:has-text("Invite")').click();
    take.mark('invite open');
    await sleep(900);
    await page.locator('.invite-dialog input[type=email]').click();
    await humanType(page, 'sam@asu.edu', 70);
    await sleep(300);
    await glideTo(page, 'button:has-text("Send invitation")', 18);
    await page.locator('button:has-text("Send invitation")').click();
    take.mark('sent');
    await sleep(3000);
    await take.finish('invite');
  },

  async solo() {
    const take = await open({ path: '/pip.html?view=solo&theme=outdoors&action=juggle' });
    await sleep(4500);
    await take.page.evaluate(() => window.__pip.act('juggle'));
    await sleep(3500);
    await take.finish('pip-solo');
  },

  async outfits() {
    const take = await open({ path: '/pip.html?view=outfits' });
    await sleep(7000);
    await take.finish('pip-outfits');
  },
};

for (const name of process.argv.slice(2)) {
  console.log(`== ${name}`);
  await scenes[name]();
}
