import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3100";
const EMAIL = "elimadmorli@gmail.com";
const PASSWORD = "MasterKitchen2026!";
const SHOTS = process.env.SHOTS ?? "/tmp/mk-e2e";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}


async function seeText(target, text, timeout = 15000) {
  try {
    await target.waitForSelector(`text=${text}`, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function act(target, selector) {
  await target.click(selector);
  await target.waitForLoadState("networkidle");
  await target.waitForTimeout(700);
}

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

try {
  // ---- sign in -------------------------------------------------------------
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
    page.click('button:has-text("Sign in")'),
  ]);
  check("sign in reaches dashboard", page.url().endsWith("/"), page.url());
  await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });

  // ---- add a client and a rep ---------------------------------------------
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', "Ridgeline GC");
  await page.fill('input[name="billing_email"]', "ap@ridgeline.example");
  await act(page, 'button:has-text("Add client")');
  check("client created", await seeText(page, "Ridgeline GC"));

  await page.click('summary:has-text("Add a rep")');
  await page.fill('input[name="full_name"]', "Dave R.");
  await page.fill('input[name="phone"]', "+15551230001");
  await act(page, 'button:has-text("Add rep")');
  check("rep created", await seeText(page, "Dave R."));

  // ---- add partners --------------------------------------------------------
  await page.goto(`${BASE}/partners`, { waitUntil: "networkidle" });
  for (const [name, type] of [
    ["Cabinet Co", "cabinet_vendor"],
    ["Crew A", "full_service_crew"],
  ]) {
    await page.fill('input[name="name"]', name);
    await page.selectOption('select[name="type"]', type);
    await act(page, 'button:has-text("Add")');
  }
  check("partners created", await seeText(page, "Cabinet Co"));

  // ---- create a job --------------------------------------------------------
  await page.goto(`${BASE}/projects/new`, { waitUntil: "networkidle" });
  await page.fill('input[name="address_line1"]', "412 Maple St");
  await page.fill('input[name="city"]', "Lakewood");
  await page.fill('input[name="state"]', "NJ");
  await page.selectOption('select[name="client_company_id"]', { label: "Ridgeline GC" });
  await page.waitForTimeout(300);
  await page.selectOption('select[name="contact_id"]', { label: "Dave R." });
  await page.selectOption('select[name="job_type"]', "full_remodel");
  await page.fill(
    'textarea[name="intake_note"]',
    "Hey, we just sold a job with a kitchen at 412 Maple St",
  );
  await Promise.all([
    page.waitForURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 30000 }),
    page.click('button:has-text("Create job")'),
  ]);
  const projectUrl = page.url();
  check("job created", /\/projects\/[0-9a-f-]{36}$/.test(projectUrl), projectUrl);
  await page.screenshot({ path: `${SHOTS}/02-project.png`, fullPage: true });

  // ---- design --------------------------------------------------------------
  await act(page, 'button:has-text("Send designer")');
  await act(page, 'button:has-text("Design complete")');
  check("design completed", await seeText(page, "Scope is fixed against this design"));

  // ---- bids ----------------------------------------------------------------
  await page.goto(`${projectUrl}/bids`, { waitUntil: "networkidle" });
  await page.selectOption('select[name="scope"]', "full_job");
  await act(page, 'button:has-text("Create request")');

  await page.click('summary:has-text("Invite more")');
  const boxes = page.locator('input[name="partner_ids"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  await act(page, 'button:has-text("Send links")');
  check("bid invites sent", await seeText(page, "not opened"));

  const bidUrl = await page.locator('input[readonly]').first().inputValue();
  await page.screenshot({ path: `${SHOTS}/03-bids.png`, fullPage: true });

  // ---- vendor submits a price, with no account ----------------------------
  const vendor = await browser.newPage();
  const bidPath = new URL(bidUrl).pathname;
  await vendor.goto(`${BASE}${bidPath}`, { waitUntil: "networkidle" });
  check("vendor portal loads", await seeText(vendor, "412 Maple St"));
  await vendor.fill('input[name="amount"]', "21000");
  await vendor.fill('input[name="lead_time_days"]', "10");
  await vendor.fill('textarea[name="notes"]', "Prefab stone, standard overlay");
  await act(vendor, 'button:has-text("Submit price")');
  check("vendor bid submitted", await seeText(vendor, "we got your price"));
  await vendor.screenshot({ path: `${SHOTS}/04-vendor-portal.png`, fullPage: true });
  await vendor.close();

  // ---- bid board shows it --------------------------------------------------
  await page.goto(`${BASE}/bids`, { waitUntil: "networkidle" });
  check("bid board shows price", await seeText(page, "$21,000"));
  await page.screenshot({ path: `${SHOTS}/05-bid-board.png`, fullPage: true });

  // ---- select the bid, price the job --------------------------------------
  await page.goto(`${projectUrl}/bids`, { waitUntil: "networkidle" });
  await act(page, 'button:has-text("Use this price")');

  await page.goto(`${projectUrl}/quote`, { waitUntil: "networkidle" });
  const priceValue = await page.locator('input[name="price"]').inputValue();
  check("markup applied to cost", Number(priceValue) === 31500, `price=${priceValue}`);
  const gm = await page.locator("text=/Gross margin/").count();
  check("both markup and gross margin shown", gm > 0);
  await page.screenshot({ path: `${SHOTS}/06-quote.png`, fullPage: true });

  await page.click('button:has-text("Save quote")');
  await page.waitForLoadState("networkidle");
  await page.click('button:has-text("Mark quote sent")');
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="approval_note"]', "yes go ahead");
  await page.click('button:has-text("Mark won")');
  await page.waitForLoadState("networkidle");
  check("quote approved", await seeText(page, "yes go ahead"));

  // ---- money: milestones split, invoice drafts ----------------------------
  await page.goto(`${projectUrl}/money`, { waitUntil: "networkidle" });
  check("milestones laid out", await seeText(page, "Demo complete"));
  await page.locator('button:has-text("Mark reached")').first().click();
  await page.waitForLoadState("networkidle");
  await page.locator('button:has-text("Draft invoice")').first().click();
  await page.waitForLoadState("networkidle");
  check("invoice drafted", await seeText(page, "/MK-\\d{4}-\\d{4}/"));
  await page.locator('button:has-text("Send")').first().click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS}/07-money.png`, fullPage: true });

  await page.goto(`${BASE}/money`, { waitUntil: "networkidle" });
  check("receivables show the invoice", await seeText(page, "Ridgeline GC"));
  await page.screenshot({ path: `${SHOTS}/08-receivables.png`, fullPage: true });

  // ---- schedule ------------------------------------------------------------
  await page.goto(`${projectUrl}/schedule`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Lay out standard tasks")');
  await page.waitForLoadState("networkidle");
  const today = new Date().toISOString().slice(0, 10);
  const waiting = page.locator('form:has(button:has-text("Schedule"))');
  await waiting.first().waitFor({ timeout: 15000 });
  const before = await waiting.count();
  const row = waiting.first();
  await row.locator('input[name="scheduled_date"]').fill(today);
  await act(page, 'form:has(button:has-text("Schedule")) >> nth=0 >> button:has-text("Schedule")');
  const after = await page.locator('form:has(button:has-text("Schedule"))').count();
  check("task scheduled", after === before - 1, `${before} waiting -> ${after}`);
  check(
    "scheduled row is editable",
    (await page.locator("input[name=start_time]").count()) > 0,
  );
  await page.goto(`${BASE}/schedule`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/09-schedule.png`, fullPage: true });

  // ---- crew job link -------------------------------------------------------
  await page.goto(projectUrl, { waitUntil: "networkidle" });
  await page.locator('input[name="label"]').fill("Crew A");
  await page.click('button:has-text("New link")');
  await page.waitForLoadState("networkidle");
  const jobUrl = await page
    .locator('input[readonly][value*="/j/"]')
    .first()
    .inputValue();

  const crew = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await crew.goto(`${BASE}${new URL(jobUrl).pathname}`, { waitUntil: "networkidle" });
  check("crew link loads", await seeText(crew, "412 Maple St"));
  await crew.fill('textarea[name="note"]', "found rot under the old sink, needs subfloor");
  await crew.check('input[value="extra_work"]');
  await act(crew, 'button:has-text("Send update")');
  check("crew update posted", await seeText(crew, "Got it"));
  await crew.screenshot({ path: `${SHOTS}/10-crew-link.png`, fullPage: true });
  await crew.close();

  // ---- the agent notices the extra work -----------------------------------
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Re-run checks")');
  await page.waitForLoadState("networkidle");
  check("attention panel raised something", await seeText(page, "Needs attention"));
  check("extra work flagged with no change order", await seeText(page, "/Extra work reported/"));
  await page.screenshot({ path: `${SHOTS}/11-attention.png`, fullPage: true });

  // ---- comms + outbox ------------------------------------------------------
  await page.goto(`${projectUrl}/comms`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Set up groups")');
  await page.waitForLoadState("networkidle");
  check("groups named by convention", await seeText(page, "/412 Maple St . Sales/"));
  await page.fill('input[name="body"]', "Crew will be at 412 Maple St tomorrow at 8:00 AM.");
  await page.click('button:has-text("Queue it")');
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SHOTS}/12-comms.png`, fullPage: true });

  await page.goto(`${BASE}/outbox`, { waitUntil: "networkidle" });
  await page.waitForSelector("textarea[name=body]", { timeout: 15000 }).catch(() => {});
  const bodies = page.locator("textarea[name=body]");
  const count = await bodies.count();
  let found = false;
  for (let i = 0; i < count; i++) {
    if ((await bodies.nth(i).inputValue()).includes("tomorrow at 8:00 AM")) found = true;
  }
  check("outbox holds the draft", found, `${count} draft(s)`);
  const wa = await page.locator('a:has-text("Open WhatsApp")').first().getAttribute("href").catch(() => "");
  check("one-tap wa.me link built", (wa ?? "").startsWith("https://wa.me/15551230001?text="));
  await page.screenshot({ path: `${SHOTS}/13-outbox.png`, fullPage: true });
} catch (err) {
  check("run completed without throwing", false, err.message);
  await page.screenshot({ path: `${SHOTS}/error.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILED:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
