const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

// 🧠 Launch Browser (Render Safe)
const launchBrowser = async () => {
  console.log("🔁 Launching browser...");
  return await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
};

// 🔐 Login using sessionid
const loginWithSession = async (page, sessionid) => {
  console.log("🔐 Logging in with sessionid...");

  await page.setCookie({
    name: "sessionid",
    value: sessionid,
    domain: ".tiktok.com",
    path: "/",
    httpOnly: true,
    secure: true,
  });

  await page.goto("https://www.tiktok.com/foryou", {
    waitUntil: "networkidle2",
  });
};

// 🔢 Get repost count
const getRepostsCount = async (page) => {
  console.log("📥 Opening repost page to count...");

  await page.goto("https://www.tiktok.com/favorites/reposts", {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector("div[data-e2e='user-post-item-list']", {
    timeout: 15000,
  });

  const count = await page.$$eval(
    "div[data-e2e='user-post-item-list'] > div",
    (divs) => divs.length
  );

  console.log("✅ Reposts count:", count);
  return count;
};

// 🗑️ Delete reposts
const deleteReposts = async (page) => {
  console.log("🗑️ Deleting reposts...");

  await page.goto("https://www.tiktok.com/favorites/reposts", {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector("div[data-e2e='user-post-item-list']", {
    timeout: 15000,
  });

  const videos = await page.$$("div[data-e2e='user-post-item-list'] > div");

  let deleted = 0;

  for (const video of videos) {
    try {
      const menuButton = await video.$("button[aria-label='More']");
      if (menuButton) {
        await menuButton.click();
        await page.waitForTimeout(500);

        const [removeBtn] = await page.$x(
          "//div[contains(text(), 'Remove from reposts') or contains(text(), 'إزالة من المشاركات')]"
        );

        if (removeBtn) {
          await removeBtn.click();
          await page.waitForTimeout(1000);
          deleted++;
        }
      }
    } catch (err) {
      console.warn("⚠️ Error deleting repost:", err.message);
      continue;
    }
  }

  console.log("✅ Deleted", deleted, "reposts");
  return deleted;
};

// ================= ROUTES =================

// Count reposts
app.post("/count", async (req, res) => {
  console.log("📩 /count endpoint hit");

  const { sessionid } = req.body;

  if (!sessionid) {
    return res.status(400).json({ error: "Missing sessionid" });
  }

  let browser;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await loginWithSession(page, sessionid);
    const count = await getRepostsCount(page);

    return res.json({ count });
  } catch (err) {
    console.error("❌ Error in /count:", err.message);
    return res.status(500).json({
      error: err.message || "Unknown error while counting.",
    });
  } finally {
    if (browser) await browser.close();
  }
});

// Clean reposts
app.post("/clean", async (req, res) => {
  console.log("📩 /clean endpoint hit");

  const { sessionid } = req.body;

  if (!sessionid) {
    return res.status(400).json({ error: "Missing sessionid" });
  }

  let browser;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await loginWithSession(page, sessionid);
    const deleted = await deleteReposts(page);

    return res.json({ success: true, deleted });
  } catch (err) {
    console.error("❌ Error in /clean:", err.message);
    return res.status(500).json({
      error: err.message || "Unknown error while cleaning.",
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ================= START SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
