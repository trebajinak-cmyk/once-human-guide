/* Data quality panel — reads /audit, never writes the pack. */
(function () {
  if (!window.fetch) return;
  const ROUTES = ["home", "db", "settings"];
  let data = null;

  function card(summary, sample) {
    const rows = (summary || []).map(function (r) {
      return "<div class='chip'>" + r.severity + " · " + r.code + " · " + r.n + "</div>";
    }).join(" ") || "<span class='muted'>žádné nálezy</span>";
    const list = (sample || []).slice(0, 8).map(function (s) {
      return "<div class='muted'>" + (s.table_name || "") + "/" + (s.entity_id || "—") + " — " + (s.detail || s.code) + "</div>";
    }).join("");
    return "<div class='card' id='ohg-audit'><div class='kicker'>Databáze</div><b>Audit kvality</b><p class='muted'>Odvozeno při buildu SQLite. Pack se nemění.</p><div>" + rows + "</div>" + list + "</div>";
  }

  async function mount() {
    const view = document.getElementById("ws");
    if (!view || document.getElementById("ohg-audit")) return;
    if (ROUTES.indexOf(route) < 0) return;
    try {
      if (!data) {
        const res = await fetch("/audit");
        if (!res.ok) return;
        data = await res.json();
      }
      if (document.getElementById("ohg-audit")) return;
      view.insertAdjacentHTML("beforeend", card(data.summary, data.sample));
    } catch (e) { /* offline */ }
  }

  const baseRender = window.render;
  if (typeof baseRender === "function") {
    window.render = function () {
      baseRender.apply(this, arguments);
      mount();
    };
  }
  mount();
})();
