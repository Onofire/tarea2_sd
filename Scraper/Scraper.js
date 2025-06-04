const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const isMac = false;
const modifierKey = isMac ? 'Meta' : 'Control';
const FILE_PATH = path.join("/app/eventos", "eventos-waze.jsonl");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setRequestInterception(true);

  // Buffer donde vamos acumulando los datos
  let bufferEvento = {};

  // Validamos si ya tenemos todos los fragmentos deseados
  const isEventoCompleto = (evento) =>
    evento.visitor_id &&
    evento._request_scope &&
    evento.city;

  const guardarEventoUnificado = (evento) => {
    fs.appendFileSync(FILE_PATH, JSON.stringify(evento) + "\n");
    console.log(`✅ Evento unificado guardado`);
  };

  page.on("request", (request) => {
    if (request.resourceType() === "fetch" && !request.url().includes("google-analytics")) {
      console.log(" fetch request =>", request.method(), request.url());
    }
    request.continue();
  });

  page.on("response", async (response) => {
    const request = response.request();
    if (request.resourceType() !== "fetch" || request.url().includes("google-analytics")) return;

    const url = response.url();
    const status = response.status();
    console.log(` fetch response => [${status}] ${url}`);

    try {
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("application/json")) return;

      const data = await response.json();
      const eventosData = Array.isArray(data) ? data : [data];

      for (const fragment of eventosData) {
        // Verificamos si tiene alguna clave relevante
        const tieneDatos = fragment.visitor_id || fragment._request_scope || fragment.city;
        if (!tieneDatos) continue;

        // Acumular en el buffer
        bufferEvento = { ...bufferEvento, ...fragment };

        // Si ya están todos los campos, guardar y limpiar buffer
        if (isEventoCompleto(bufferEvento)) {
          guardarEventoUnificado(bufferEvento);
          bufferEvento = {};
        }
      }
    } catch (err) {
      console.error(`❌ Error procesando respuesta ${url}:`, err.message);
    }
  });

  await page.goto("https://www.waze.com/es-419/live-map");
  console.log("🌍 Mapa abierto. Escuchando eventos fetch...\n");

  process.on("SIGINT", async () => {
    console.log("\n🛑 Terminando scraper...");
    if (Object.keys(bufferEvento).length > 0) {
      console.log("🕗 Guardando buffer incompleto por cierre...");
      guardarEventoUnificado(bufferEvento);
    }
    process.exit();
  });

  setInterval(async () => {
    const x = Math.floor(Math.random() * 100) + 100;
    const y = Math.floor(Math.random() * 100) + 100;
    await page.mouse.move(x, y);
    console.log(` Mouse movido a (${x}, ${y})`);
    const zoomIn = Math.random() < 0.5;
    await page.keyboard.down(modifierKey);
    await page.keyboard.press(zoomIn ? '+' : '-');
    await page.keyboard.up(modifierKey);
  }, 100000);

  await new Promise(() => {});
})();
