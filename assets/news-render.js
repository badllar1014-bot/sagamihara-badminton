/*!
 * news-render.js
 * - Reads ./assets/news-data.json and renders into #newsList
 * - Handles: updated-date display (from updated), NEW tag (<=7 days), sort + pagination
 *
 * How to use:
 * 1) Put news-data.json in assets/ (or adjust DATA_URL)
 * 2) In index-news.html, keep:
 *    - <div id="newsList"></div>
 *    - top controls IDs: sortSelect, prevPage, nextPage, pageInfo
 *    - bottom controls (optional): sortSelectBottom, prevPageBottom, nextPageBottom, pageInfoBottom
 * 3) Add: <script src="assets/news-render.js" defer></script>
 */
(function(){
  const DATA_URL = "data/news-data.json";
  const PAGE_SIZE = 10;
  const NEW_DAYS = 14; // 0..14 days => NEW, 8 days+ => none

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function parseYmdLocal(ymd){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
    if(!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function floorToLocalDay(dt){
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }
  function diffDaysFromToday(ymd){
    const d = parseYmdLocal(ymd);
    if(!d) return null;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const today = floorToLocalDay(new Date());
    return Math.floor((today - floorToLocalDay(d)) / MS_PER_DAY);
  }
  function formatJP(ymd){
    const d = parseYmdLocal(ymd);
    if(!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}年${m}月${day}日`;
  }
  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }

  function buildEntry(item){
    const updatedJP = formatJP(item.updated);
    const d = diffDaysFromToday(item.updated);
    const showNew = (d !== null && d >= 0 && d <= NEW_DAYS);

    // lines -> render
    const linesHtml = (item.lines || []).map(line => {
      const actions = (line.actions || [])
        .filter(a => a.url)
        .map(a => {
          // If your HTML uses PDF/XLS icons, customize here. For now: plain button style.
          const label = escapeHtml(a.label || "リンク");
          const url = escapeHtml(a.url);
          const target = a.target ? ` target="${escapeHtml(a.target)}" rel="noopener"` : "";
          return `<a class="doc" href="${url}"${target}>${label}</a>`;
        }).join("");
      const value = actions ? actions : escapeHtml(line.text || "");
      return `
        <div class="line">
          <div class="label">${escapeHtml(line.label || "")}</div>
          <div class="value actions">${value}</div>
        </div>
      `;
    }).join("");

    const tagHtml = showNew ? `<span class="tag new">NEW</span>` : "";

    return `
      <article class="entry" data-updated="${escapeHtml(item.updated || "")}">
        <div class="entry-head">
          <a class="entry-title" href="${escapeHtml(item.url || "#")}">${escapeHtml(item.title || "")}</a>
          ${tagHtml}
        </div>
        <div class="entry-meta">更新日：${escapeHtml(updatedJP)}</div>
        <div class="entry-body entry-lines">${linesHtml}</div>
      </article>
    `;
  }

  function ensureBottomControls(){
    // In your latest HTML, bottom has only pager. Create bottom sort/pager if missing.
    // We'll support both patterns:
    // A) full bottom controls exist (sortSelectBottom etc.)
    // B) only bottom pager exists (prevPageBottom etc.)
    const hasSortBottom = !!$("#sortSelectBottom");
    const hasPagerBottom = !!$("#prevPageBottom") && !!$("#nextPageBottom") && !!$("#pageInfoBottom");
    return {hasSortBottom, hasPagerBottom};
  }

  async function main(){
    const listRoot = $("#newsList");
    const sortTop = $("#sortSelect");
    const prevTop = $("#prevPage");
    const nextTop = $("#nextPage");
    const infoTop = $("#pageInfo");
    if(!listRoot || !sortTop || !prevTop || !nextTop || !infoTop) return;

    const {hasSortBottom, hasPagerBottom} = ensureBottomControls();
    const sortBottom = hasSortBottom ? $("#sortSelectBottom") : null;
    const prevBottom = hasPagerBottom ? $("#prevPageBottom") : null;
    const nextBottom = hasPagerBottom ? $("#nextPageBottom") : null;
    const infoBottom = hasPagerBottom ? $("#pageInfoBottom") : null;

    const res = await fetch(DATA_URL, {cache:"no-store"});
    const data = await res.json();
    const items = (data.items || []).slice();

    function getUpdatedDate(item){
      const d = parseYmdLocal(item.updated);
      return d ? d.getTime() : 0;
    }

    let currentPage = 1;
    let currentOrder = sortTop.value; // desc/asc
    let sorted = items.slice();

    function sortItems(){
      const dir = currentOrder === "asc" ? 1 : -1;
      sorted.sort((a,b) => (getUpdatedDate(a) - getUpdatedDate(b)) * dir);
    }

    function syncUI(totalPages){
      const text = `${currentPage} / ${totalPages}`;
      infoTop.textContent = text;
      prevTop.disabled = currentPage <= 1;
      nextTop.disabled = currentPage >= totalPages;

      if(sortBottom) sortBottom.value = currentOrder;
      if(infoBottom) infoBottom.textContent = text;
      if(prevBottom) prevBottom.disabled = currentPage <= 1;
      if(nextBottom) nextBottom.disabled = currentPage >= totalPages;
    }

    function render(scrollToTop){
      listRoot.innerHTML = "";
      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);

      const start = (currentPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageItems = sorted.slice(start, end);

      listRoot.insertAdjacentHTML("beforeend", pageItems.map(buildEntry).join(""));
      syncUI(totalPages);

      if(scrollToTop){
        $(".content")?.scrollIntoView({behavior:"smooth", block:"start"});
      }
    }

    function setOrder(newOrder){
      currentOrder = newOrder;
      currentPage = 1;
      sortItems();
      render(false);
    }

    sortTop.addEventListener("change", () => setOrder(sortTop.value));
    sortBottom?.addEventListener("change", () => setOrder(sortBottom.value));

    function goPrev(){ currentPage -= 1; render(true); }
    function goNext(){ currentPage += 1; render(true); }

    prevTop.addEventListener("click", goPrev);
    nextTop.addEventListener("click", goNext);
    prevBottom?.addEventListener("click", goPrev);
    nextBottom?.addEventListener("click", goNext);

    sortItems();
    render(false);
  }

  document.addEventListener("DOMContentLoaded", main);
})();