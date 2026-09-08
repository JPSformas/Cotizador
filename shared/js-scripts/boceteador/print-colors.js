import { PANTONES } from "./pantones.js";

const HEX = /^#[0-9a-fA-F]{6}$/;
const PANTONE_RECENT_KEY = "formasPantonesRecientes";

function pantoneNombre(code) {
  const norm = String(code || "").trim().toUpperCase().replace(/\s+/g, " ");
  return "Pantone " + norm + (/\d$/.test(norm) ? " C" : "");
}

function pantoneHex(code) {
  const m = String(code || "").match(/\d{2,4}/);
  return (m && PANTONES[m[0]]) || null;
}

function nearestPantone(hex) {
  const n = parseInt(String(hex || "").replace("#", ""), 16);
  if (isNaN(n)) return null;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  let best = null;
  let bd = Infinity;
  for (const code in PANTONES) {
    const v = parseInt(PANTONES[code].slice(1), 16);
    const dr = r - ((v >> 16) & 255);
    const dg = g - ((v >> 8) & 255);
    const db = b - (v & 255);
    const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (dist < bd) {
      bd = dist;
      best = { code, hex: PANTONES[code] };
    }
  }
  return best;
}

function pantoneRecents() {
  try {
    const a = JSON.parse(localStorage.getItem(PANTONE_RECENT_KEY) || "[]");
    return Array.isArray(a) ? a.filter((c) => PANTONES[(String(c).match(/\d+/) || [""])[0]]) : [];
  } catch (e) {
    return [];
  }
}

function pantoneRecuerda(label) {
  try {
    const a = pantoneRecents().filter((c) => c !== label);
    a.unshift(label);
    localStorage.setItem(PANTONE_RECENT_KEY, JSON.stringify(a.slice(0, 8)));
  } catch (e) { /* quota */ }
}

function pantoneMatches(q) {
  const num = (String(q).toUpperCase().match(/\d+/) || [""])[0];
  if (!num) return [];
  const keys = Object.keys(PANTONES);
  const pre = keys.filter((k) => k.startsWith(num));
  const inc = keys.filter((k) => !k.startsWith(num) && k.includes(num));
  return pre.concat(inc).slice(0, 14);
}

function safeHex(value, fallback) {
  const v = String(value || "").trim();
  const withHash = v.startsWith("#") ? v : "#" + v;
  return HEX.test(withHash) ? withHash : fallback;
}

export function createPrintColors(root) {
  let colors = [{ hex: "#FFFFFF", nom: "Blanco", pant: "" }];
  let codeMode = "hex";
  let panPop = null;
  let panPopInput = null;
  let panPopIdx = -1;
  let panPopItems = [];
  let panPicking = false;

  const $ = (id) => root.querySelector("#" + id);

  function cerrarPantonePop() {
    if (panPop) {
      panPop.remove();
      panPop = null;
      panPopInput = null;
      panPopItems = [];
      panPopIdx = -1;
    }
  }

  function panPopAct(i) {
    panPopItems.forEach((el, j) => el.classList.toggle("act", j === i));
    panPopIdx = i;
    if (panPopItems[i]) panPopItems[i].scrollIntoView({ block: "nearest" });
  }

  function panPick(input, label) {
    panPicking = true;
    input.value = label;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    panPicking = false;
    pantoneRecuerda(label);
    cerrarPantonePop();
  }

  function abrirPantonePop(input) {
    cerrarPantonePop();
    const q = input.value.trim();
    const rec = q ? null : pantoneRecents();
    const labels = q ? pantoneMatches(q).map((k) => k + " C") : rec;
    panPop = document.createElement("div");
    panPop.id = "pantonePop";
    panPopInput = input;
    if (!q && labels && labels.length) {
      const h = document.createElement("div");
      h.className = "ph";
      h.textContent = "Recientes";
      panPop.appendChild(h);
    }
    if (!labels || !labels.length) {
      const d = document.createElement("div");
      d.className = "none";
      d.textContent = q ? "Sin coincidencias" : "Escribí el número del Pantone (ej: 185)";
      panPop.appendChild(d);
    } else {
      labels.forEach((label) => {
        const num = (label.match(/\d+/) || [""])[0];
        const hx = PANTONES[num];
        const it = document.createElement("div");
        it.className = "pi";
        const sw = document.createElement("span");
        sw.className = "sw";
        if (HEX.test(hx)) sw.style.background = hx;
        const cd = document.createElement("span");
        cd.className = "cd";
        cd.textContent = label;
        const hxEl = document.createElement("span");
        hxEl.className = "hx";
        hxEl.textContent = hx.toUpperCase();
        it.appendChild(sw);
        it.appendChild(cd);
        it.appendChild(hxEl);
        it.addEventListener("mousedown", (e) => {
          e.preventDefault();
          panPick(input, label);
        });
        panPopItems.push(it);
        panPop.appendChild(it);
      });
    }
    document.body.appendChild(panPop);
    const r = input.getBoundingClientRect();
    panPop.style.minWidth = Math.max(r.width, 210) + "px";
    panPop.style.left = Math.min(r.left, window.innerWidth - panPop.offsetWidth - 8) + "px";
    const abajo = window.innerHeight - r.bottom;
    if (abajo < panPop.offsetHeight + 8 && r.top > abajo) panPop.style.top = r.top - panPop.offsetHeight - 4 + "px";
    else panPop.style.top = r.bottom + 4 + "px";
  }

  function draw() {
    cerrarPantonePop();
    const box = $("bocetoColors");
    if (!box) return;
    box.textContent = "";
    colors.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "pcRow";
      const sw = document.createElement("input");
      sw.type = "color";
      sw.value = safeHex(c.hex, "#FFFFFF");
      const nom = document.createElement("input");
      nom.type = "text";
      nom.className = "pcNom";
      nom.placeholder = "Nombre";
      nom.value = c.nom || "";
      row.appendChild(sw);
      row.appendChild(nom);
      let hxTxt = null;
      let pant = null;
      if (codeMode === "hex") {
        hxTxt = document.createElement("input");
        hxTxt.type = "text";
        hxTxt.className = "pcHexTxt";
        hxTxt.placeholder = "#HEX";
        hxTxt.autocomplete = "off";
        hxTxt.spellcheck = false;
        hxTxt.value = (c.hex || "").toUpperCase();
        hxTxt.style.maxWidth = "92px";
        row.appendChild(hxTxt);
      } else {
        pant = document.createElement("input");
        pant.type = "text";
        pant.className = "pcPant";
        pant.placeholder = "Pantone";
        pant.autocomplete = "off";
        pant.value = c.pant || "";
        pant.style.maxWidth = "92px";
        const pms = document.createElement("button");
        pms.type = "button";
        pms.className = "pms";
        pms.title = "Buscar el Pantone más cercano al color elegido";
        pms.textContent = "◎";
        row.appendChild(pant);
        row.appendChild(pms);
        pms.onclick = () => {
          const near = nearestPantone(c.hex);
          if (!near) return;
          c.pant = near.code + " C";
          c.hex = near.hex;
          c.nom = pantoneNombre(c.pant);
          draw();
        };
      }
      if (colors.length > 1) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "del";
        del.title = "Quitar color";
        del.textContent = "✕";
        del.onclick = () => {
          colors.splice(i, 1);
          draw();
        };
        row.appendChild(del);
      }
      sw.addEventListener("input", (e) => {
        c.hex = e.target.value;
        if (hxTxt) {
          hxTxt.value = c.hex.toUpperCase();
          hxTxt.classList.remove("pcMiss");
        }
      });
      nom.addEventListener("input", (e) => {
        c.nom = e.target.value;
      });
      if (hxTxt) {
        hxTxt.addEventListener("input", (e) => {
          const v = "#" + e.target.value.trim().replace(/^#/, "");
          const ok = HEX.test(v);
          hxTxt.classList.toggle("pcMiss", !ok && e.target.value.trim() !== "");
          if (ok) {
            c.hex = v.toLowerCase();
            sw.value = c.hex;
          }
        });
        hxTxt.addEventListener("change", () => {
          hxTxt.value = (c.hex || "").toUpperCase();
          hxTxt.classList.remove("pcMiss");
        });
      }
      if (pant) {
        pant.addEventListener("input", (e) => {
          c.pant = e.target.value;
          const hx = pantoneHex(c.pant);
          pant.classList.toggle("pcMiss", /\d/.test(c.pant) && !hx);
          if (hx) {
            c.hex = hx;
            sw.value = hx;
            c.nom = pantoneNombre(c.pant);
            nom.value = c.nom;
          }
          if (!panPicking) abrirPantonePop(pant);
        });
        pant.addEventListener("focus", () => abrirPantonePop(pant));
        pant.addEventListener("keydown", (e) => {
          if (!panPop || panPopInput !== pant) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            panPopAct(Math.min(panPopIdx + 1, panPopItems.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            panPopAct(Math.max(panPopIdx - 1, 0));
          } else if (e.key === "Enter" && panPopItems.length) {
            e.preventDefault();
            panPopItems[panPopIdx >= 0 ? panPopIdx : 0].dispatchEvent(new Event("mousedown"));
          } else if (e.key === "Escape") cerrarPantonePop();
        });
      }
      box.appendChild(row);
    });
  }

  function syncToggles() {
    if ($("bcCodeHex")) $("bcCodeHex").setAttribute("aria-pressed", String(codeMode === "hex"));
    if ($("bcCodePant")) $("bcCodePant").setAttribute("aria-pressed", String(codeMode === "pantone"));
  }

  if ($("bcCodeHex")) $("bcCodeHex").onclick = () => {
    codeMode = "hex";
    syncToggles();
    draw();
  };
  if ($("bcCodePant")) $("bcCodePant").onclick = () => {
    codeMode = "pantone";
    syncToggles();
    draw();
  };
  if ($("bcAddColor")) $("bcAddColor").onclick = () => {
    colors.push({ hex: "#000085", nom: "", pant: "" });
    draw();
  };

  document.addEventListener("mousedown", (e) => {
    if (panPop && !panPop.contains(e.target) && e.target !== panPopInput) cerrarPantonePop();
  });
  window.addEventListener("scroll", (e) => {
    if (panPop && !panPop.contains(e.target)) cerrarPantonePop();
  }, true);
  window.addEventListener("resize", cerrarPantonePop);

  syncToggles();
  draw();

  return {
    get() {
      return colors.map((c) => ({ hex: c.hex, nom: c.nom, pant: c.pant }));
    },
    set(next) {
      colors = Array.isArray(next) && next.length
        ? next.map((c) => ({
          hex: safeHex(c.hex, "#FFFFFF"),
          nom: c.nom || "",
          pant: c.pant || "",
        }))
        : [{ hex: "#FFFFFF", nom: "Blanco", pant: "" }];
      draw();
    },
    hide(on) {
      if ($("bcColoresField")) $("bcColoresField").hidden = !!on;
    },
    closePop: cerrarPantonePop,
  };
}
