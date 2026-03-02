(() => {
  const DATA_URL = "data/results-data.json";
  const NEW_DAYS = 14;

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
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}年${m}月${day}日`;
  }

  function isNew(updatedYmd) {
    const updated = parseYmdLocal(updatedYmd);
    if (!updated) return false;
    const today = floorToLocalDay(new Date());
    const diffDays = Math.floor((today - floorToLocalDay(updated)) / MS_PER_DAY);
    return diffDays >= 0 && diffDays <= NEW_DAYS;
  }

  function getParam(name) {
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }

  function iconTypeToClass(type) {
    const t = String(type || "").toLowerCase();
    if (t === "pdf") return { cls: "pdf", text: "PDF" };
    if (t === "xls" || t === "xlsx" || t === "excel") return { cls: "xls", text: "X" };
    return { cls: "pdf", text: "PDF" };
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, String(v));
    }
    for (const ch of children) node.appendChild(ch);
    return node;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const key = getParam("key") || "open_team";

    const listRoot = document.getElementById("resultsList");
    const pageTitle = document.getElementById("pageTitle");
    const crumbTitle = document.getElementById("crumbTitle");

    if (!listRoot) return;

    let data;
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      data = await res.json();
    } catch (e) {
      listRoot.appendChild(
        el("div", { class: "note", text: "データの読み込みに失敗しました。data/results-data.json のパスと内容を確認してください。" })
      );
      return;
    }

    const categories = Array.isArray(data.categories) ? data.categories : [];
    const cat = categories.find((c) => c && c.key === key) || categories[0];

    if (!cat) {
      listRoot.appendChild(el("div", { class: "note", text: "表示できる大会カテゴリがありません。" }));
      return;
    }

    const label = cat.label || "大会結果";
    if (pageTitle) pageTitle.textContent = label;
    if (crumbTitle) crumbTitle.textContent = label;
    document.title = `${label}｜相模原市バドミントン協会`;

    listRoot.innerHTML = "";

    const years = Array.isArray(cat.years) ? cat.years.slice() : [];
    years.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));

    if (years.length === 0) {
      listRoot.appendChild(el("div", { class: "note", text: "この大会の結果データはまだありません。" }));
      return;
    }

    for (let yi = 0; yi < years.length; yi++) {
      const y = years[yi];

      // ★ 2年度目以降だけ区切り線を入れる（タイトル直下が2本にならない）
      if (yi > 0) {
        listRoot.appendChild(el("div", { class: "section-bar", "aria-hidden": "true" }));
      }

      // ★ 年度見出し（2026年度など）は表示しない
      //   （必要ならここでコメントではなく小さく表示に変更も可能）

      const entries = Array.isArray(y.entries) ? y.entries.slice() : [];
      entries.sort((a, b) => {
        const da = parseYmdLocal(a?.updated)?.getTime() ?? 0;
        const db = parseYmdLocal(b?.updated)?.getTime() ?? 0;
        return db - da;
      });

      if (entries.length === 0) {
        listRoot.appendChild(el("div", { class: "note", text: "この年度の結果はまだありません。" }));
        continue;
      }

      for (const item of entries) {
        const updated = item?.updated || "";
        const title = item?.title || "(無題)";
        const url = item?.url || "#";
        const lines = Array.isArray(item?.lines) ? item.lines : [];
        const docs = Array.isArray(item?.docs) ? item.docs : [];

        const head = el("div", { class: "entry-head" }, [
          el("a", { class: "entry-title", href: url, text: title })
        ]);

        if (isNew(updated)) {
          head.appendChild(el("span", { class: "tag new", text: "NEW" }));
        }

        const meta = el("div", { class: "entry-meta", text: updated ? `更新日：${formatJPDate(updated)}` : "" });

        const body = el("div", { class: "entry-body entry-lines" });

        for (const ln of lines) {
          body.appendChild(
            el("div", { class: "line" }, [
              el("div", { class: "label", text: ln?.label ?? "" }),
              el("div", { class: "value", html: String(ln?.value ?? "") })
            ])
          );
        }

        if (docs.length) {
          const actions = el("div", { class: "value actions" });
          for (const d of docs) {
            const info = iconTypeToClass(d?.type);
            actions.appendChild(
              el("a", { class: "doc", href: d?.url || "#", target: "_blank", rel: "noopener" }, [
                el("span", { class: `icon ${info.cls}`, text: info.text }),
                el("span", { text: d?.label || "資料" })
              ])
            );
          }
          body.appendChild(
            el("div", { class: "line" }, [
              el("div", { class: "label", text: "資料：" }),
              actions
            ])
          );
        }

        listRoot.appendChild(el("article", { class: "entry" }, [head, meta, body]));
      }
    }
  });
})();
