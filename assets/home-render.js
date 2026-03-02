(() => {
  const DATA_URL = "data/taikai-data.json"; // index.html から見た相対パス
  const MAX_ITEMS = 3;                     // 最新3件
  const NEW_DAYS = 14;                     // 0〜14日：NEW

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function parseYmdLocal(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function floorToLocalDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function isNew(updatedYmd) {
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

  // "更新日：2026年02月10日" → "2026-02-10"
  function extractUpdatedFromMeta(meta) {
    const s = String(meta || "");
    const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(s);
    if (!m) return "";
    const y = m[1];
    const mo = String(m[2]).padStart(2, "0");
    const d = String(m[3]).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  function getUpdated(item) {
    // 1) updated を優先
    const u = String(item?.updated || "").trim();
    if (u) return u;
    // 2) meta から抽出（互換）
    return extractUpdatedFromMeta(item?.meta);
  }

  // rows: [{key,value}] から「期日」「会場」などを拾う
  function pickRow(rows, keyword) {
    const arr = Array.isArray(rows) ? rows : [];
    const hit = arr.find((r) => String(r?.key || "").includes(keyword));
    return hit?.value || "";
  }

  // docs label を短く（例: "要項（PDF）" -> "要項"）
  function shortLabel(label) {
    return String(label || "")
      .replace(/（.*?）/g, "")
      .replace(/\(.*?\)/g, "")
      .trim() || "資料";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("homeTaikaiList");
    if (!root) return;

    let data;
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      data = await res.json();
    } catch (e) {
      console.error("[home-render] JSON読み込み失敗", e);
      root.innerHTML = "";
      root.appendChild(el("div", { class: "note", text: "大会情報データの読み込みに失敗しました。" }));
      return;
    }

    // ✅ taikai-v1(years[]) / results-v1(categories[]) の両方に対応（事故防止）
    const flat = [];

    // taikai-v1: { years:[{id,label,entries:[...]}] }
    if (Array.isArray(data?.years)) {
      data.years.forEach((y) => {
        const entries = Array.isArray(y?.entries) ? y.entries : [];
        entries.forEach((it) => {
          flat.push({
            __yearId: y?.id || "",
            __yearLabel: y?.label || "",
            ...it
          });
        });
      });
    }

    // results-v1: { categories:[{key,label,years:[{year,entries:[...]}]}] }
    if (Array.isArray(data?.categories)) {
      data.categories.forEach((cat) => {
        const years = Array.isArray(cat?.years) ? cat.years : [];
        years.forEach((y) => {
          const entries = Array.isArray(y?.entries) ? y.entries : [];
          entries.forEach((it) => {
            flat.push({
              __categoryKey: cat?.key || "",
              __categoryLabel: cat?.label || "",
              __year: y?.year,
              ...it
            });
          });
        });
      });
    }

    // updated で新しい順
    flat.sort((a, b) => {
      const da = parseYmdLocal(getUpdated(a))?.getTime() ?? 0;
      const db = parseYmdLocal(getUpdated(b))?.getTime() ?? 0;
      return db - da;
    });

    const top = flat.slice(0, MAX_ITEMS);

    root.innerHTML = "";
    if (!top.length) {
      root.appendChild(el("div", { class: "note", text: "大会情報がありません。" }));
      return;
    }

    top.forEach((it) => {
      const updated = getUpdated(it);
      const title = it?.title || it?.__categoryLabel || "(無題)";
      const url = it?.url || "#";

      // meta（更新日 + NEWは必要な時だけ）
      const meta = el("div", { class: "meta" }, [
        el("span", { class: "date", text: `更新日：${updated || "-"}` })
      ]);

      if (updated && isNew(updated)) {
        meta.appendChild(el("span", { class: "badge", text: "NEW" }));
      }
      // ✅ NEWじゃない時は badge を生成しない＝「青い丸だけ残る」を根本解消

      // title
      const a = el("a", { class: "title", href: url, text: title });

      // desc（期日 / 会場 + 資料リンク）
      const desc = el("p", { class: "desc" });

      // taikai-v1: rows/files
      const rows = Array.isArray(it?.rows) ? it.rows : null;
      const files = Array.isArray(it?.files) ? it.files : null;

      // results-v1: lines/docs（互換）
      const lines = Array.isArray(it?.lines) ? it.lines : null;
      const docs = Array.isArray(it?.docs) ? it.docs : null;

      // 期日/会場
      let kiji = "";
      let kaijo = "";
      if (rows) {
        kiji = pickRow(rows, "期日");
        kaijo = pickRow(rows, "会場");
      } else if (lines) {
        const lk = lines.find(x => String(x?.label||"").includes("期"))?.value || "";
        const lj = lines.find(x => String(x?.label||"").includes("会"))?.value || "";
        kiji = lk;
        kaijo = lj;
      }

      const parts = [];
      if (kiji) parts.push(`期日：${kiji}`);
      if (kaijo) parts.push(`会場：${kaijo}`);

      if (parts.length) desc.appendChild(document.createTextNode(parts.join(" / ")));

      // 資料リンク（taikai-v1: files / results-v1: docs）
      const linkItems = [];
      if (files) {
        files.forEach(f => {
          if (f?.url) linkItems.push({ label: shortLabel(f.label), url: f.url });
        });
      } else if (docs) {
        docs.forEach(d => {
          if (d?.url) linkItems.push({ label: shortLabel(d.label), url: d.url });
        });
      }

      if (linkItems.length) {
        // 期日/会場がある場合は改行して資料を下段へ
        if (parts.length) desc.appendChild(document.createElement("br"));

        // 既存：docsRow.appendChild(document.createTextNode("資料："));
        // 〜 linkItems.forEach(...) の中身を置き換え

        const docsRow = el("div", { class: "home-docs-row" });
        docsRow.appendChild(el("span", { class: "home-docs-label", text: "資料：" }));

        linkItems.forEach((d) => {
          // 1アイテム： 要項： [PDF(link)]
          const label = el("span", { class: "home-doc-label", text: `${d.label}：` }); // ← span
          const pdf = el("a", {
            class: "home-doc-pdf",
            href: d.url,
            target: "_blank",
            rel: "noopener",
            text: "PDF"
          });

          const item = el("span", { class: "home-doc-item" }, [label, pdf]);
          docsRow.appendChild(item);
        });

        desc.appendChild(docsRow);
      }

      const li = el("li", { class: "item" }, [meta, a, desc]);
      root.appendChild(li);
    });
  });
})();
