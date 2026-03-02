(() => {
  const DATA_URL = "data/news-data.json"; // index.html から見た相対パス
  const MAX_ITEMS = 5;                   // 最新5件
  const NEW_DAYS = 14;                    // 0〜7日：NEW（不要なら 0 に）

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function parseYmdLocal(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function floorToLocalDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function formatJPDate(ymd) {
    const d = parseYmdLocal(ymd);
    if (!d) return "-";
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function isNew(updatedYmd) {
    if (NEW_DAYS <= 0) return false;
    const updated = parseYmdLocal(updatedYmd);
    if (!updated) return false;
    const today = floorToLocalDay(new Date());
    const diffDays = Math.floor((today - floorToLocalDay(updated)) / MS_PER_DAY);
    return diffDays >= 0 && diffDays <= NEW_DAYS;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, String(v));
    }
    children.forEach((c) => node.appendChild(c));
    return node;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("homeNewsList");
    const updatedEl = document.getElementById("homeNewsUpdated");
    if (!root) return;

    let data;
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      data = await res.json();
    } catch (e) {
      console.error("[home-news-render] JSON読み込み失敗", e);
      root.appendChild(el("div", { class: "note", text: "お知らせデータの読み込みに失敗しました。" }));
      return;
    }

    const items = Array.isArray(data.items) ? data.items.slice() : [];
    items.sort((a, b) => {
      const da = parseYmdLocal(a?.updated)?.getTime() ?? 0;
      const db = parseYmdLocal(b?.updated)?.getTime() ?? 0;
      return db - da; // 新しい順
    });

    const top = items.slice(0, MAX_ITEMS);

    // 「更新：」を最新日に
    if (updatedEl) {
      const latest = top[0]?.updated || "";
      updatedEl.textContent = `更新：${latest ? latest : "-"}`;
    }

    // 描画
    root.innerHTML = "";

    if (!top.length) {
      root.appendChild(el("div", { class: "note", text: "お知らせがありません。" }));
      return;
    }

    const list = el("ul", { class: "news-simple-list" });

    top.forEach((it) => {
      const updated = it?.updated || "";
      const title = it?.title || "(無題)";
      const url = it?.url || "#";

      const date = el("time", {
        class: "news-simple-date",
        datetime: updated,
        text: formatJPDate(updated)
      });

      const a = el("a", { class: "news-simple-title", href: url, text: title });

      const titleWrap = el("div", { class: "news-simple-titlewrap" }, [a]);

      if (isNew(updated)) {
        titleWrap.appendChild(el("span", { class: "news-simple-badge", text: "NEW" }));
      }

      list.appendChild(el("li", { class: "news-simple-row" }, [date, titleWrap]));
    });

    root.appendChild(list);
  });
})();
