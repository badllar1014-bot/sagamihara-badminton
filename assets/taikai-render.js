/*!
 * taikai-render.js
 * - Reads ./data/taikai-data.json and renders each year section
 * - NEW if updated is within 14 days from today (today = day 0)
 */
(function(){
  const DATA_URL = "data/taikai-data.json";
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const NEW_DAYS = 14; // ★ここが「14日」

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#39;")
      .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    }

  function parseYmdLocal(ymd){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
    if(!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function floorToLocalDay(dt){
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }
  function formatJP(ymd){
    const d = parseYmdLocal(ymd);
    if(!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}年${m}月${day}日`;
  }

  const today = floorToLocalDay(new Date());

  // file label から表示テキストを作る（例： "要項（PDF）" -> "要項"）
  function cleanFileLabel(label){
    let s = String(label || "").trim();
    s = s.replace(/（PDF）|\(PDF\)|（xlsx）|\(xlsx\)|（xls）|\(xls\)/gi, "");
    s = s.replace(/^PDF\s*/i, "").replace(/^X\s*/i, "");
    return s.trim() || "資料";
  }

  // 拡張子などで PDF / X を判定
  function detectDocType(file){
    const type = String(file?.type || "").trim().toLowerCase();
    const url = String(file?.url || "");
    const label = String(file?.label || "");

    if (type === "pdf") {
      return { cls: "pdf", icon: "PDF" };
    }

    if (type === "excel" || type === "xls" || type === "xlsx") {
      return { cls: "xls", icon: "X" };
    }

    if (type === "form") {
      return { cls: "form", icon: "FORM" };
    }

    // 互換: type未指定の旧データはURLやラベルから判定
    if (/\.(xlsx|xls)$/i.test(url)) {
      return { cls: "xls", icon: "X" };
    }

    if (/forms\.gle|docs\.google\.com\/forms/i.test(url)) {
      return { cls: "form", icon: "FORM" };
    }

    if (/^X\b|参加申込/i.test(label) && /\.(xlsx|xls)/i.test(url)) {
      return { cls: "xls", icon: "X" };
    }

    return { cls: "pdf", icon: "PDF" };
  }

  function buildDocButton(f){
    const url = f?.url || "#";
    const label = f?.label || "";
    const text = cleanFileLabel(label);
    const t = detectDocType(f);

    return `
      <a class="doc" href="${escapeHtml(url)}" target="_blank" rel="noopener">
        <span class="icon ${t.cls}">${escapeHtml(t.icon)}</span><span>${escapeHtml(text)}</span>
      </a>
    `;
  }

  function buildEntry(e){
    // --- NEW判定（0〜14日前のみ） ---
    let tagHtml = "";
    const upd = parseYmdLocal(e.updated);
    if(upd){
      const diffDays = Math.floor((today - floorToLocalDay(upd)) / MS_PER_DAY);
      if(diffDays >= 0 && diffDays <= NEW_DAYS){
        tagHtml = `<span class="tag new">NEW</span>`;
      }
    }

    // --- 更新日表示（右寄せはCSS側 .entry-meta の text-align に任せる） ---
    const meta = e.updated ? `更新日：${formatJP(e.updated)}` : (e.meta || "");

    // --- 基本行（期日/会場など） ---
    const lines = (e.rows || []).map(r => {
      const key = escapeHtml(r.key || "");
      const val = escapeHtml(r.value || "");
      return `
        <div class="line">
          <div class="label">${key}</div>
          <div class="value">${val}</div>
        </div>
      `;
    }).join("");

    // --- ファイルを「要項等/参加申込/組合せ等/結果等」に振り分け ---
    const groups = {
      guideline: [], // 要項等
      entry: [],     // 参加申込
      draw: [],      // 組合せ等（＋タイムテーブル）
      result: []     // 結果等
    };

    (e.files || []).forEach(f => {
      const label = String(f?.label || "");
      const url = String(f?.url || "");

      if (label.includes("要項")) {
        groups.guideline.push(f);
      } else if (label.includes("参加申込") || label.includes("申込") || /\.(xlsx|xls)$/i.test(url)) {
        groups.entry.push(f);
      } else if (label.includes("組合せ") || label.includes("タイムテーブル")) {
        groups.draw.push(f);
      } else if (label.includes("結果")) {
        groups.result.push(f);
      } else {
        // 迷ったら要項等へ（必要ならここを調整）
        groups.guideline.push(f);
      }
    });

    function buildGroupLine(labelText, arr){
      if (!arr || !arr.length) return "";
      const btns = arr.map(buildDocButton).join("");
      return `
        <div class="line">
          <div class="label">${escapeHtml(labelText)}</div>
          <div class="value actions">${btns}</div>
        </div>
      `;
    }

    const fileLines =
      buildGroupLine("要　項：", groups.guideline) +
      buildGroupLine("申込み：", groups.entry) +
      buildGroupLine("組合せ：", groups.draw) +
      buildGroupLine("結　果：", groups.result);

    return `
      <article class="entry" data-updated="${escapeHtml(e.updated || "")}">
        <div class="entry-head">
          <!-- ★タイトルはリンクにしない -->
          <div class="entry-title">${escapeHtml(e.title || "")}</div>
          ${tagHtml}
        </div>
        <div class="entry-meta">${escapeHtml(meta)}</div>

        <!-- ★newsと同じ「label + value(actions)」構造 -->
        <div class="entry-body entry-lines">
          ${lines}
          ${fileLines}
        </div>
      </article>
    `;
  }

  async function main(){
    let data;
    try{
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if(!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
      data = await res.json();
    }catch(err){
      console.error("[taikai-render] data load error:", err);
      return;
    }

    const years = data.years || [];
    years.forEach(y => {
      const sec = document.getElementById(y.id);
      if(!sec) return;

      sec.innerHTML = `<div class="section-bar"></div>`;

      const sortedEntries = [...(y.entries || [])].sort((a, b) => {
        const aNum = Number(String(a.id || "").split("-")[1] || 0);
        const bNum = Number(String(b.id || "").split("-")[1] || 0);
        return bNum - aNum; // 降順（新しいものが上）
      });

      sortedEntries.forEach(e => {
        sec.insertAdjacentHTML("beforeend", buildEntry(e));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", main);
})();
