/* aha 导出菜单 —— serve.mjs 注入到每个本地会话的图解页。
   工具条「分享」→「导出 ▾」:四格式整页导出(终态 iframe 捕获)+
   Markdown/SVG 图解(服务端生成)+ 公网分享(原按钮流程)。 */
(function () {
  if (window.__ahaExportMenuBooted) return;
  window.__ahaExportMenuBooted = true;

  var PAGE_FILE = location.pathname.split("/").pop();
  var EXPORT_W = 1200;

  function ensureSpinStyle() {
    if (document.getElementById("__aha-spin-style")) return;
    var st = document.createElement("style");
    st.id = "__aha-spin-style";
    st.textContent =
      "@keyframes __aha_spin{to{transform:rotate(360deg)}}" +
      ".__aha-spin{width:20px;height:20px;border-radius:50%;border:2px solid " +
      css("--line-2", "#5c4b39") + ";border-top-color:" + css("--accent", "#ffab2e") +
      ";animation:__aha_spin .8s linear infinite}";
    document.head.appendChild(st);
  }

  /** 导出进行中:整菜单遮罩 + 转圈,顺带挡住重复点击 */
  function startBusy(menu, title, subText) {
    ensureSpinStyle();
    var o = document.createElement("div");
    o.style.cssText =
      "position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;" +
      "justify-content:center;gap:.55rem;border-radius:.7rem;background:rgba(10,8,6,.88);" +
      "backdrop-filter:blur(2px);";
    var sp = document.createElement("div");
    sp.className = "__aha-spin";
    var t = document.createElement("div");
    t.textContent = title;
    t.style.cssText = "font-size:.8rem;color:" + css("--t-2", "#d9cdba") + ";";
    var sub = document.createElement("div");
    sub.textContent = subText;
    sub.style.cssText = "font-size:.66rem;opacity:.5;";
    o.appendChild(sp);
    o.appendChild(t);
    o.appendChild(sub);
    menu.appendChild(o);
    return o;
  }

  function boot() {
    var orig = document.querySelector("[data-tb-share]");
    if (orig) return setupDetailPage(orig);
    var shelfBtn = document.querySelector("[data-share]");
    if (shelfBtn) return setupShelf(shelfBtn);
  }

  /** 书架首页:点分享 → 弹窗立即出现,loading 铺满,生成完转就绪态 */
  function setupShelf(shelfBtn) {
    // 旧版结果 UI(status/url 盒)让位:流程中隐藏,取到链接后删除
    var statusEl = document.querySelector("[data-share-status]");
    var urlBox = document.querySelector("[data-share-url]");
    if (statusEl) statusEl.style.display = "none";
    if (urlBox) urlBox.style.display = "none";
    shelfBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var dlg = openShareDialogLoading();
      // 页面原有的分享监听在本监听之前注册,同一次真实点击已经驱动它,无需再补合成点击
      var t0 = Date.now();
      var iv = setInterval(function () {
        var link = urlBox && !urlBox.hidden && urlBox.querySelector("a[href^=http]");
        if (link) {
          clearInterval(iv);
          urlBox.remove();
          if (statusEl) statusEl.remove();
          dlg.done(link.href);
          return;
        }
        if (Date.now() - t0 > 90000) {
          clearInterval(iv);
          dlg.fail("隧道开启超时,请重试或检查网络");
        }
      }, 250);
    });
  }

  function setupDetailPage(orig) {
    // 克隆替换:不带原监听;原按钮隐藏保留,「公网分享」仍走它
    var btn = orig.cloneNode(true);
    btn.removeAttribute("data-tb-share");
    btn.setAttribute("data-aha-export", "");
    btn.textContent = "导出 ▾";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    orig.style.display = "none";
    orig.insertAdjacentElement("afterend", btn);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggle(btn);
    });
    document.addEventListener("click", function () {
      var m = document.getElementById("__aha-export-menu");
      if (m) close(m, btn);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var m = document.getElementById("__aha-export-menu");
        if (m) close(m, btn);
      }
    });
  }

  function toggle(btn) {
    var m = document.getElementById("__aha-export-menu");
    if (m) return close(m, btn);
    m = buildMenu();
    document.body.appendChild(m);
    position(m, btn);
    btn.setAttribute("aria-expanded", "true");
  }

  function close(m, btn) {
    m.remove();
    btn.setAttribute("aria-expanded", "false");
  }

  function position(m, btn) {
    var r = btn.getBoundingClientRect();
    var w = m.offsetWidth || 208;
    var left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    m.style.left = left + "px";
    var top = r.bottom + 8;
    if (top + m.offsetHeight > window.innerHeight - 8) {
      top = Math.max(8, r.top - m.offsetHeight - 8);
    }
    m.style.top = top + "px";
  }

  function css(v, fb) {
    var s = getComputedStyle(document.documentElement).getPropertyValue(v);
    return (s && s.trim()) || fb;
  }

  /** 变量命名兼容:书架用 --t2,详情页用 --t-2,依次尝试 */
  function cssAny(names, fb) {
    var st = getComputedStyle(document.documentElement);
    for (var i = 0; i < names.length; i++) {
      var v = st.getPropertyValue(names[i]);
      if (v && v.trim()) return v.trim();
    }
    return fb;
  }

  function buildMenu() {
    var m = document.createElement("div");
    m.id = "__aha-export-menu";
    m.setAttribute("role", "menu");
    m.style.cssText =
      "position:fixed;z-index:9999;min-width:13rem;padding:.4rem;border-radius:.7rem;" +
      "background:" + css("--surface", "#171310") + ";" +
      "border:1px solid " + css("--line-2", "#5c4b39") + ";" +
      "box-shadow:0 12px 34px rgba(0,0,0,.4);font:500 .85rem/1.2 var(--font-ui, system-ui, sans-serif);";
    var items = [
      { label: "WebP 整页", hint: "终态截图", run: function () { return exportImage("webp"); } },
      { label: "PNG 整页", hint: "终态截图", run: function () { return exportImage("png"); } },
      { label: "SVG 整页", hint: "浏览器打开可交互", run: exportSvgPage },
      { label: "PDF 整页", hint: "A4 分页", run: exportPdf },
      { sep: true },
      { label: "Markdown", hint: "纯内容", run: function () { return serverExport("md"); } },
      { sep: true },
      {
        label: "公网分享",
        hint: "隧道链接",
        busyTitle: "正在开启公网隧道 …",
        busySub: "首次使用需安装 cloudflared,可能要等一会",
        run: shareViaTunnel,
      },
    ];
    items.forEach(function (it) {
      if (it.sep) {
        var hr = document.createElement("div");
        hr.style.cssText = "margin:.35rem .2rem;border-top:1px solid " + css("--line", "#423629");
        m.appendChild(hr);
        return;
      }
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.style.cssText =
        "display:flex;align-items:baseline;justify-content:space-between;gap:1.2rem;width:100%;" +
        "padding:.45rem .6rem;border:0;border-radius:.45rem;background:none;cursor:pointer;text-align:left;" +
        "color:" + css("--t-2", "#d9cdba") + ";";
      b.onmouseenter = function () {
        b.style.background = css("--surface-2", "rgba(255,171,46,.08)");
        b.style.color = css("--accent", "#ffab2e");
      };
      b.onmouseleave = function () {
        b.style.background = "none";
        b.style.color = css("--t-2", "#d9cdba");
      };
      var l = document.createElement("span");
      l.textContent = it.label;
      var h = document.createElement("span");
      h.textContent = it.hint || "";
      h.style.cssText = "font-size:.68rem;opacity:.55;";
      b.appendChild(l);
      b.appendChild(h);
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var busy = startBusy(m, it.busyTitle || ("正在导出 " + it.label + " …"), it.busySub || "终态渲染中,一般几秒");
        Promise.resolve()
          .then(it.run)
          .catch(function (err) {
            console.error("[aha export]", err);
            alert("导出失败:" + (err && err.message ? err.message : err));
          })
          .then(function () {
            busy.remove();
          });
      });
      m.appendChild(b);
    });
    return m;
  }

  /* —— 库懒加载 —— */
  function loadScript(src) {
    if (loadScript.done && loadScript.done[src]) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () {
        (loadScript.done = loadScript.done || {})[src] = true;
        res();
      };
      s.onerror = function () {
        rej(new Error("加载 " + src + " 失败"));
      };
      document.head.appendChild(s);
    });
  }

  function ensureLibs(pdf) {
    var p = loadScript("/__aha/vendor/html-to-image.js");
    if (pdf) p = p.then(function () { return loadScript("/__aha/vendor/jspdf.umd.min.js"); });
    return p;
  }

  /* —— 终态 iframe:加载 ?aha-export=1,等服务端注入的收尾脚本就绪 —— */
  function finalFrame() {
    return new Promise(function (resolve, reject) {
      var f = document.createElement("iframe");
      // 带上当前页面的深浅色/配色风格,导出与所见一致
      var theme = document.documentElement.dataset.theme || localStorage.getItem("aha-theme") || "";
      var preset = document.documentElement.dataset.preset || localStorage.getItem("aha-preset") || "";
      var q = "?aha-export=1";
      if (theme) q += "&theme=" + encodeURIComponent(theme);
      if (preset) q += "&preset=" + encodeURIComponent(preset);
      f.src = location.pathname + q;
      f.style.cssText =
        "position:fixed;left:-99999px;top:0;width:" + EXPORT_W + "px;height:600px;visibility:hidden;border:0;";
      var to = setTimeout(function () {
        cleanup();
        reject(new Error("页面终态加载超时"));
      }, 20000);
      function cleanup() {
        clearTimeout(to);
        f.remove();
      }
      f.onload = function () {
        var t = setInterval(function () {
          try {
            if (f.contentWindow && f.contentWindow.__ahaExportReady) {
              clearInterval(t);
              // 动画/字体最后收敛
              setTimeout(function () {
                resolve({ frame: f, cleanup: cleanup });
              }, 600);
            }
          } catch (e) {
            clearInterval(t);
            cleanup();
            reject(e);
          }
        }, 120);
      };
      document.body.appendChild(f);
    });
  }

  function captureCanvas(lib, body) {
    var bg = getComputedStyle(body).backgroundColor || "#0e0b08";
    return lib
      .toCanvas(body, { backgroundColor: bg, pixelRatio: 2, width: EXPORT_W })
      .catch(function () {
        return lib.toCanvas(body, { backgroundColor: bg, pixelRatio: 1, width: EXPORT_W });
      });
  }

  function baseName() {
    return PAGE_FILE.replace(/\.html$/i, "");
  }

  function saveBlob(blob, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 4000);
    // 归档一份到 ~/.aha/exports/(尽力而为,失败不打扰)
    try {
      fetch("/__aha/archive?name=" + encodeURIComponent(filename), { method: "POST", body: blob }).catch(
        function () {}
      );
    } catch (e) {}
  }

  function exportImage(type) {
    return ensureLibs(false).then(function () {
      var lib = window.htmlToImage;
      return finalFrame().then(function (ctx) {
        var body = ctx.frame.contentDocument.body;
        return captureCanvas(lib, body).then(function (canvas) {
          var mime = type === "webp" ? "image/webp" : "image/png";
          var q = type === "webp" ? 0.92 : undefined;
          return new Promise(function (res, rej) {
            canvas.toBlob(
              function (blob) {
                if (!blob) return rej(new Error(mime + " 编码失败(浏览器可能不支持)"));
                saveBlob(blob, baseName() + "." + type);
                res();
              },
              mime,
              q
            );
          });
        }).then(function (r) {
          ctx.cleanup();
          return r;
        });
      });
    });
  }

  function exportSvgPage() {
    return ensureLibs(false).then(function () {
      var lib = window.htmlToImage;
      return finalFrame().then(function (ctx) {
        var body = ctx.frame.contentDocument.body;
        return lib
          .toSvg(body, { width: EXPORT_W })
          .then(function (dataUrl) {
            return fetch(dataUrl).then(function (r) { return r.blob(); });
          })
          .then(function (blob) {
            saveBlob(blob, baseName() + ".svg");
            ctx.cleanup();
          })
          .catch(function (e) {
            ctx.cleanup();
            throw e;
          });
      });
    });
  }

  function exportPdf() {
    return ensureLibs(true).then(function () {
      var lib = window.htmlToImage;
      return finalFrame().then(function (ctx) {
        var body = ctx.frame.contentDocument.body;
        return captureCanvas(lib, body).then(function (canvas) {
          var JsPDF = window.jspdf.jsPDF;
          var pdf = new JsPDF("p", "mm", "a4");
          var pw = 210;
          var ph = 297;
          // 按 A4 比例把整图切片;宽度铺满,高分页拼接
          var pxPerMm = canvas.width / pw;
          var sliceH = Math.floor(ph * pxPerMm);
          var y = 0;
          var page = 0;
          while (y < canvas.height) {
            var h = Math.min(sliceH, canvas.height - y);
            var c = document.createElement("canvas");
            c.width = canvas.width;
            c.height = h;
            c.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            if (page > 0) pdf.addPage();
            pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pw, (h / pxPerMm));
            y += h;
            page++;
          }
          saveBlob(pdf.output("blob"), baseName() + ".pdf");
          ctx.cleanup();
        });
      });
    });
  }

  /* —— 公网分享:触发页面原流程,链接就绪后弹注意事项 —— */
  function shareViaTunnel() {
    var orig = document.querySelector("[data-tb-share]");
    if (!orig) return Promise.reject(new Error("本页不支持分享"));
    // 旧版右上角弹层从一开始就让位(加载态也不闪现,链接由说明弹窗承载)
    var oldPop = document.querySelector("[data-share-pop]");
    if (oldPop) oldPop.style.display = "none";
    // 不冒泡的合成点击:页面自己的监听照常触发,但不会误关导出菜单
    orig.dispatchEvent(new MouseEvent("click", { bubbles: false }));
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      var iv = setInterval(function () {
        var pop = document.querySelector("[data-share-pop]");
        var link = pop && !pop.hidden && pop.querySelector("a[href^=http]");
        if (link) {
          clearInterval(iv);
          pop.remove(); // 旧版弹层直接删除,链接由说明弹窗承载
          showShareDialog(link.href);
          var m = document.getElementById("__aha-export-menu");
          if (m) m.remove(); // 菜单连同遮罩一起收,弹窗接管注意力
          resolve();
          return;
        }
        if (Date.now() - t0 > 90000) {
          clearInterval(iv);
          reject(new Error("隧道开启超时,请重试或检查网络"));
        }
      }, 250);
    });
  }

  function copyToClipboard(text, btn, doneText) {
    var mark = function () {
      var old = btn.textContent;
      btn.textContent = doneText || "已复制";
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(mark, function () { mark(); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      ta.remove();
      mark();
    }
  }

  /** 弹窗立即打开,loading 铺满;done(href) 切就绪态,fail(msg) 报错并关闭 */
  function openShareDialogLoading() {
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;" +
      "padding:1rem;background:rgba(8,6,4,.45)";
    var card = document.createElement("div");
    card.style.cssText =
      "width:100%;max-width:26rem;max-height:88vh;overflow-y:auto;border-radius:.9rem;padding:1.35rem 1.4rem;" +
      "background:" + css("--surface", "#171310") + ";border:1px solid " + css("--line-2", "#5c4b39") + ";" +
      "box-shadow:0 18px 50px rgba(0,0,0,.5);";
    ensureSpinStyle();
    var load = document.createElement("div");
    load.style.cssText =
      "min-height:11rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.55rem;";
    var sp = document.createElement("div");
    sp.className = "__aha-spin";
    var lt = document.createElement("div");
    lt.textContent = "正在开启公网隧道 …";
    lt.style.cssText = "font-size:.85rem;color:" + cssAny(["--t-2", "--t2"], "#d9cdba") + ";";
    var lsub = document.createElement("div");
    lsub.textContent = "首次使用需安装 cloudflared,可能要等一会";
    lsub.style.cssText = "font-size:.66rem;opacity:.5;";
    load.appendChild(sp);
    load.appendChild(lt);
    load.appendChild(lsub);
    card.appendChild(load);
    ov.appendChild(card);
    document.body.appendChild(ov);
    return {
      done: function (href) {
        card.innerHTML = "";
        buildShareReady(card, ov, href);
      },
      fail: function (msg) {
        ov.remove();
        alert(msg);
      },
    };
  }

  function showShareDialog(href) {
    var dlg = openShareDialogLoading();
    dlg.done(href);
  }

  function buildShareReady(card, ov, href) {
    var h = document.createElement("div");
    h.textContent = "公网链接已开启";
    h.style.cssText =
      "font-size:1.05rem;font-weight:700;color:" + cssAny(["--t-1", "--t1"], "#f7f1e7") + ";";
    // 链接盒
    var box = document.createElement("div");
    box.style.cssText =
      "margin-top:.9rem;display:flex;align-items:baseline;gap:.55rem;";
    var code = document.createElement("input");
    code.type = "text";
    code.readOnly = true;
    code.value = href;
    code.setAttribute("aria-label", "公网分享链接");
    code.style.cssText =
      "flex:1;min-width:0;font:500 .76rem/1.5 ui-monospace,Menlo,monospace;color:" +
      css("--accent", "#ffab2e") + ";background:transparent;border:0;" +
      "border-bottom:1px dashed " + css("--line-2", "#5c4b39") + ";outline:none;padding:.15rem 0;";
    code.addEventListener("focus", function () { code.select(); });
    var cp = document.createElement("button");
    cp.type = "button";
    cp.textContent = "复制";
    cp.style.cssText =
      "flex-shrink:0;padding:.32em .8em;border-radius:999px;cursor:pointer;font-size:.72rem;" +
      "background:none;border:1px solid " + css("--line-2", "#5c4b39") + ";color:" + cssAny(["--t-2", "--t2"], "#d9cdba") + ";";
    cp.addEventListener("click", function () { copyToClipboard(href, cp); });
    box.appendChild(code);
    box.appendChild(cp);
    // 注意事项
    var cap = document.createElement("div");
    cap.textContent = "注意事项";
    cap.style.cssText =
      "margin-top:1.1rem;font-size:.7rem;font-weight:700;letter-spacing:.08em;color:" + cssAny(["--t-3", "--t3"], "#a99b82") + ";";
    var ul = document.createElement("ul");
    ul.style.cssText = "margin:.5rem 0 0;padding-left:1.1rem;display:grid;gap:.45rem;";
    [
      "链接是<strong>临时</strong>的 —— 关闭 aha serve 或隧道进程退出即失效。",
      "分享期间请保持电脑<strong>开机联网</strong> —— 休眠期间链接无法访问(唤醒后一般会自动恢复)。",
      "<strong>电脑重启后</strong>,需要重新生成分享链接。",
    ].forEach(function (txt) {
      var li = document.createElement("li");
      li.style.cssText = "font-size:.8rem;line-height:1.55;color:" + cssAny(["--t-2", "--t2"], "#d9cdba") + ";";
      li.innerHTML = txt;
      ul.appendChild(li);
    });
    // 底部按钮
    var ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "我知道了";
    ok.style.cssText =
      "margin-top:1.2rem;width:100%;padding:.6rem 0;border-radius:.6rem;cursor:pointer;font-size:.85rem;font-weight:700;" +
      "background:" + css("--accent", "#ffab2e") + ";color:" + cssAny(["--accent-ink"], "#241a09") + ";border:0;";
    function close() { ov.remove(); document.removeEventListener("keydown", onKey); }
    var onKey = function (e) { if (e.key === "Escape") close(); };
    ok.addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", onKey);
    card.appendChild(h);
    card.appendChild(box);
    card.appendChild(cap);
    card.appendChild(ul);
    card.appendChild(ok);
    ov.appendChild(card);
    document.body.appendChild(ov);
  }

  function serverExport(format) {
    return fetch("/__aha/export?file=" + encodeURIComponent(PAGE_FILE) + "&format=" + format)
      .then(function (r) {
        var ct = r.headers.get("content-type") || "";
        if (!r.ok || ct.includes("application/json")) {
          return r.json().then(function (j) { throw new Error(j.error || "导出失败"); });
        }
        return r.blob().then(function (blob) {
          saveBlob(blob, baseName() + ".md");
        });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

