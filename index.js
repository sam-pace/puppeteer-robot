const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const { authenticate, sendMessage } = require('./handleWhatsApp');
const player = require('play-sound')();
require('dotenv').config();

puppeteer.use(StealthPlugin());

const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const selectors = {
    login: {
      email: 'input[name="Email"]',
      password: 'input[type="password"]',
      button: '#login-form > button'
    },
    serviceRow: '#dataTableServices > tbody > tr:nth-child(3)',
    serviceButton: '#dataTableServices > tbody > tr:nth-child(3) button'
  };

  const msg = {
    login: 'Aviso: Novo login em sua conta do consulado',
    booking: 'Aviso: Encontramos uma data disponível para agendamento!'
  };

  const urls = {
    base: 'https://prenotami.esteri.it/',
    login: 'https://prenotami.esteri.it/Home?ReturnUrl=%2fServices',
    services: 'https://prenotami.esteri.it/Services',
    booking: 'https://prenotami.esteri.it/Services/Booking/2427'
  };

  const login = async (page) => {
    try {
      await page.waitForSelector(selectors.login.email);
      await page.waitForSelector(selectors.login.password);

      // Simulate human typing with random delays
      for (const char of process.env.EMAIL) {
        await page.type(selectors.login.email, char, { delay: randomDelay(30, 150) });
      }

      for (const char of process.env.PASSWORD) {
        await page.type(selectors.login.password, char, { delay: randomDelay(30, 150) });
      }

      await page.click(selectors.login.button);

      await page.waitForNavigation({ waitUntil: 'networkidle0' });

      const cookies = await page.cookies();
      fs.writeFileSync('./cookies.json', JSON.stringify(cookies, null, 2));
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const configurePage = async (page) => {
    await page.setViewport({ width: 1080, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    await page.deleteCookie(...await page.cookies());
  };

  const playSound = () => {
    player.play('sound/alarm-clock.mp3', function(err) {
      if (err) throw err;
    });
  };

  const simulateUserInteraction = async (page, selector) => {
    const element = await page.$(selector);
    const box = await element.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y, { steps: randomDelay(20, 40) });
    await page.mouse.click(x, y);
  };

  const clickAndWait = async (page, attemptCount = 1) => {
    try {
      await page.click(selectors.serviceButton);

      console.log(`Button clicked, waiting... (Attempt: ${attemptCount})`);
      await sendMessage(`Tentativa: ${attemptCount}`);

      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
      if (page.url() === urls.booking) {
        console.log('Booking page reached!');
        playSound();
        await sendMessage(msg.booking);
        // Pause execution without closing the browser
        await new Promise(() => {});
      } else {
        await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });

        if (page.url() === urls.login) {
          console.log('URL indicates logged out, logging in again');
          await login(page);
          await page.goto(urls.services);
          await page.waitForSelector(selectors.serviceRow);
        } else {
          await page.waitForSelector(selectors.serviceRow);
        }

        await wait(60000); // Wait for 1 minute before the next attempt
        await clickAndWait(page, attemptCount + 1);
      }
    } catch (error) {
      console.error(`Error on attempt ${attemptCount}:`, error);
      await wait(60000); // Wait for 1 minute before the next attempt
      await clickAndWait(page, attemptCount + 1);
    }
  };

  try {
    console.log('Waiting for WhatsApp authentication...');
    await authenticate();
    console.log('WhatsApp authenticated.');

    const browser = await puppeteer.launch({
      headless: false,
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--disable-features=IsolateOrigins,site-per-process',
        '--flag-switches-begin',
        '--flag-switches-end',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    await configurePage(page);

    await page.goto(urls.login, { timeout: 0 });
    await login(page);
    await sendMessage(msg.login);

    if (await page.$(selectors.serviceRow) === null) {
      await page.goto(urls.services);
      await page.waitForSelector(selectors.serviceRow);
    }

    await clickAndWait(page);

    await browser.close();
  } catch (error) {
    console.error('Error on Puppeteer:', error);
  }
})();
