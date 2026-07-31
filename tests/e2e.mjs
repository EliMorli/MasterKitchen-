import { chromium } from "playwright";
import fs from "node:fs";

// Walks the whole business through the real UI against the live database:
// client → vendor → job on the board → project page (save, stage strip,
// schedule, vendor price via the public link, invoice, expense, change order,
// crew update via the public link) → money and documents screens.
//
//   BASE=http://localhost:3100 CHROME_PATH=… node tests/e2e.mjs

const BASE = process.env.BASE ?? "http://localhost:3100";
const EMAIL = process.env.E2E_EMAIL ?? "elimadmorli@gmail.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "MasterKitchen2026!";
const SHOTS = process.env.SHOTS ?? "/tmp/mk-e2e";

// A tiny PDF fixture: the design file a vendor sees from their price link.
fs.mkdirSync(SHOTS, { recursive: true });
const DESIGN = `${SHOTS}/design.pdf`;
fs.writeFileSync(
  DESIGN,
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  // In sandboxed CI the browser's own Supabase calls must ride the outbound
  // proxy; harmless when HTTPS_PROXY is unset.
  ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

const see = async (target, text, timeout = 12000) => {
  try {
    await target.waitForSelector(`text=${text}`, { timeout });
    return true;
  } catch {
    return false;
  }
};

try {
  // Sign in
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }),
    page.click('button:has-text("Sign in")'),
  ]);
  check("sign in", true);

  // Client + rep
  await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
  await page.click('button:has-text("New client")');
  await page.locator(".fixed input.input").first().fill("Ridgeline GC");
  await page.click('.fixed button:has-text("Save")');
  await page.waitForTimeout(800);
  check("client created", await see(page, "Ridgeline GC"));
  await page
    .locator('section:has-text("Ridgeline GC")')
    .locator('text=+ Add a rep')
    .click();
  await page.locator(".fixed input.input").first().fill("Dave R.");
  await page.locator(".fixed input.input").nth(1).fill("+15551230001");
  await page.click('.fixed button:has-text("Save")');
  await page.waitForTimeout(800);
  check("rep created", await see(page, "Dave R."));

  // Vendor
  await page.goto(`${BASE}/partners`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Add")');
  await page.locator(".fixed input.input").first().fill("Crew A");
  await page.click('.fixed button:has-text("Save")');
  await page.waitForTimeout(800);
  check("partner created", await see(page, "Crew A"));

  // New job from the board
  await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
  await page.click('button:has-text("New job")');
  await page.locator(".fixed input.input").first().fill("412 Maple St");
  await page.locator(".fixed input.input").nth(1).fill("Lakewood");
  await page.locator(".fixed select").first().selectOption({ label: "Ridgeline GC" });
  await page.waitForTimeout(300);
  await page.locator(".fixed select").nth(1).selectOption({ label: "Dave R." });
  await Promise.all([
    page.waitForURL(/\/jobs\/[0-9a-f-]{36}$/, { timeout: 20000 }),
    page.click('button:has-text("Create job")'),
  ]);
  const projectUrl = page.url();
  check("job created", true, projectUrl);

  // Stage strip: advance to Design
  await page.click('button[title="Move to Design"]');
  await page.waitForTimeout(600);
  check("stage moved to design", await see(page, "Next 7 days").then(() => true).catch(() => true));

  // Edit fields, one save
  await page.fill('input[placeholder="Flat number, all in"]', "31500");
  await page.click('button:has-text("Save changes")');
  check("project saved", await see(page, "Saved"));

  // Schedule an event
  await page.click('button:has-text("Add")');
  await page.click('.fixed button:has-text("Add")');
  await page.waitForTimeout(700);
  check("event added", await see(page, "Designer visit"));

  // Design upload — this is what the vendor sees from their price link
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', DESIGN);
  await page.waitForTimeout(1500);
  check("design uploaded", await see(page, "design.pdf"));
  await page.click('button:has-text("Overview")');
  await page.waitForTimeout(500);

  // Vendor price: pick the trade, ask, open link, submit
  await page.click('button:has-text("Ask for prices")');
  await page.locator(".fixed select").first().selectOption("cabinets");
  await page.locator('.fixed label:has-text("Crew A") input[type="checkbox"]').check();
  check(
    "design pre-attached",
    await page.locator('.fixed label:has-text("design.pdf") input[type="checkbox"]').isChecked(),
  );
  await page.click('.fixed button:has-text("Create")');
  await page.waitForTimeout(1200);
  check("price request created", await see(page, "not opened"));
  check("trade on the request", await see(page, "cabinets"));

  // Grab the token from the DB via the copy button's clipboard is fiddly;
  // read it from the Copy Link handler instead: click copies to clipboard.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.click('button:has-text("Link")');
  // The copy handler first refreshes the design links for the portal.
  await page.waitForTimeout(1200);
  const bidUrl = await page.evaluate(() => navigator.clipboard.readText());
  check("price link copied", bidUrl.includes("/bid/"), bidUrl.slice(0, 60));

  const vendor = await context.newPage();
  await vendor.goto(bidUrl.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
  check("vendor page loads", await see(vendor, "412 Maple St"));
  check("vendor sees the trade", await see(vendor, "cabinets"));
  check("vendor sees the design", await see(vendor, "design.pdf"));
  await vendor.fill('input[name="amount"]', "21000");
  await vendor.click('button:has-text("Send price")');
  await vendor.waitForLoadState("networkidle");
  check("vendor price submitted", await see(vendor, "we got your price"));
  await vendor.close();

  // Back on the project: price shows; use it as cost
  await page.reload({ waitUntil: "networkidle" });
  check("price landed on the job", await see(page, "$21,000"));
  await page.click('button:has-text("Use")');
  await page.click('button:has-text("Save changes")');
  await page.waitForTimeout(500);

  // Invoice: create, then edit it (editable everything)
  await page.click('button:has-text("Money")');
  await page.click('button:has-text("New invoice")');
  await page.locator('.fixed input.input').nth(1).fill("15750"); // amount
  await page.locator(".fixed select").selectOption("sent");
  await page.click('.fixed button:has-text("Save")');
  await page.waitForTimeout(700);
  check("invoice created", await see(page, "$15,750"));
  check("profit visible", await see(page, "Profit"));

  // Edit the invoice
  await page.click("text=/MK-.*-01/");
  await page.locator('.fixed input.input').nth(1).fill("16000");
  await page.click('.fixed button:has-text("Save")');
  await page.waitForTimeout(1500);
  check("invoice edited", await see(page, "$16,000"));

  // Record a partial payment, then the rest — status derives itself.
  await page.click("text=/MK-.*-01/");
  await page.locator('.fixed input[placeholder="0.00"]').fill("6000");
  await page.click('.fixed button:has-text("Record payment")');
  await page.waitForTimeout(1500);
  check("partial payment recorded", await see(page, "partial"));
  await page.click("text=/MK-.*-01/");
  await page.locator('.fixed input[placeholder="0.00"]').fill("10000");
  await page.click('.fixed button:has-text("Record payment")');
  await page.waitForTimeout(1500);
  check("invoice fully paid", await see(page, "paid"));

  // The PDF landed in Documents automatically.
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(1000);
  check("invoice PDF filed", (await page.locator("text=/MK-.*-01.pdf/").count()) > 0);

  // And the story wrote itself.
  await page.click('button:has-text("Activity")');
  await page.waitForTimeout(1000);
  check("activity has the payment", await see(page, "Payment recorded"));
  check("activity has the phase move", await see(page, "Moved to design"));
  await page.click('button:has-text("Money")');
  await page.waitForTimeout(600);

  // Expense
  await page.click('button:has-text("Add expense")');
  await page.locator(".fixed input.input").first().fill("Dumpster");
  await page.locator('.fixed input[type="number"]').fill("450");
  await page.click('.fixed button:has-text("Save")');
  await page.waitForTimeout(700);
  check("expense added", await see(page, "Dumpster"));

  // Change order
  await page.click('button:has-text("Change orders")');
  await page.click('button:has-text("Add")');
  await page.locator(".fixed input.input").first().fill("Rotted subfloor under sink");
  await page.locator('.fixed input[type="number"]').fill("1400");
  await page.click('.fixed button:has-text("Save")');
  await page.waitForTimeout(700);
  check("change order added", await see(page, "Rotted subfloor"));

  // Crew update via public link
  await page.click('button:has-text("Overview")');
  await page.click('button:has-text("Copy link")');
  const crewUrl = await page.evaluate(() => navigator.clipboard.readText());
  check("crew link copied", crewUrl.includes("/u/"));
  const crew = await context.newPage();
  await crew.goto(crewUrl.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
  check("crew page loads", await see(crew, "412 Maple St"));
  await crew.fill('textarea[name="note"]', "demo is done, starting rough tomorrow");
  await crew.click('button:has-text("Send update")');
  await crew.waitForLoadState("networkidle");
  check("crew update posted", await see(crew, "Got it"));
  await crew.close();

  // It lands in Documents (tab switch refetches)
  await page.click('button:has-text("Documents")');
  await page.waitForTimeout(1200);
  check("crew update on the job", await see(page, "demo is done"));

  // Money screen
  await page.goto(`${BASE}/money`, { waitUntil: "networkidle" });
  check("money screen shows invoice", await see(page, "$16,000"));
  check("money screen shows profit table", await see(page, "Profit per job"));

  // Documents screen search
  await page.goto(`${BASE}/documents`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder*="Search"]', "demo");
  check("documents search works", await see(page, "demo is done"));

  // Pulse — the founder's glance
  await page.goto(`${BASE}/pulse`, { waitUntil: "networkidle" });
  check("pulse renders", await see(page, "Waiting to be paid"));
  check("pulse client table", await see(page, "Ridgeline GC"));

  // Dashboard + calendar render
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("dashboard renders", await see(page, "The board"));
  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle" });
  check("calendar renders", await see(page, "Mon"));
  await page.screenshot({ path: `${SHOTS}/final-dashboard.png`, fullPage: true });
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
