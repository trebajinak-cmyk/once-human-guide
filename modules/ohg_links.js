/* Related entities from /links — pack stays read-only. */
(function () {
  const ctx = document.getElementById("ctx");
  if (!ctx || !window.fetch) return;
  async function show(table, id) {
    try {
      const res = await fetch("/links/" + encodeURIComponent(table) + "/" + encodeURIComponent(id));
      if (!res.ok) return;
      const data = await res.json();
      const old = document.getElementById("ohg-links");
      if (old) old.remove();
      const host = Object.assign(document.createElement("div"), { id: "ohg-links" });
      host.innerHTML = "<h4 style='margin:12px 0 6px'>Vazby</h4>" +
        (data.links || []).slice(0, 8).map(function (l) {
          return "<div class='chip'>" + l.relation + " · " + (l.dst_table || l.src_table) + "/" + (l.dst_id || l.src_id) + "</div>";
        }).join(" ") || "<span class='muted'>žádné odvozené vazby</span>";
      const target = device === "phone" ? document.getElementById("sheet") : ctx.querySelector(".body");
      if (target) target.appendChild(host);
    } catch (e) { /* offline pack */ }
  }
  document.addEventListener("click", function (ev) {
    const item = ev.target.closest("[data-table][data-id]");
    if (item) show(item.dataset.table, item.dataset.id);
  });
})();
