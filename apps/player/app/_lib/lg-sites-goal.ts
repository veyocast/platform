/** Transient Sites overlays reuse normalized delivery authority and the checksum-verified local media caches. */
export function lgSitesGoalScript(){return String.raw`
    var lgSitesSystemCacheName = "veyocast-player-sites-system-v1";
    var lgSitesSystemPreparing = null;
    function lgSitesVerifiedBytes(response, asset) {
      if (!response) return Promise.resolve(null);
      return response.arrayBuffer().then(function (bytes) {
        if (bytes.byteLength !== asset.bytes) return null;
        return new Promise(function (resolve) { sha256Hex(bytes, function (error, checksum) { resolve(!error && checksum === asset.sha256 ? bytes : null); }); });
      });
    }
    function lgSitesPrepareSystemAssets(metadata) {
      if (!Array.isArray(metadata) || metadata.length !== CONFIG.sitesSystemAssets.length || !window.caches) return Promise.resolve(false);
      var seen = {};
      for (var index = 0; index < metadata.length; index += 1) {
        var entry = metadata[index];if (!entry || typeof entry !== "object") return Promise.resolve(false);var trusted = CONFIG.sitesSystemAssets.filter(function (asset) { return asset.path === entry.path; })[0];
        if (!trusted || seen[entry.path] || entry.checksumSha256 !== trusted.sha256 || entry.bytes !== trusted.bytes || entry.mimeType !== trusted.mimeType) return Promise.resolve(false);
        seen[entry.path] = true;
      }
      if (lgSitesSystemPreparing) return lgSitesSystemPreparing;
      var task = caches.open(lgSitesSystemCacheName).then(function (cache) {
        var chain = Promise.resolve(true);
        CONFIG.sitesSystemAssets.forEach(function (asset) {
          chain = chain.then(function (ready) {
            if (!ready) return false;
            var key = CONFIG.cachePathPrefix + asset.sha256;
            return cache.match(key).then(function (response) { return lgSitesVerifiedBytes(response, asset); }).then(function (cached) {
              if (cached) return true;
              if (!playerMediaTraffic.allow(key)) return false;
              return cache.delete(key).then(function () { return downloadMedia(asset.path, asset.sha256, asset.bytes); }).then(function (result) {
                return lgSitesVerifiedBytes(new Response(result.bytes), asset).then(function (bytes) {
                  if (!bytes) { playerMediaTraffic.failure(key); return false; }
                  return cache.put(key, new Response(bytes,{headers:{"Content-Type":asset.mimeType,"Content-Length":String(bytes.byteLength)}})).then(function () { playerMediaTraffic.success(key); return true; });
                });
              });
            });
          });
        });
        return chain;
      }).catch(function () { return false; });
      lgSitesSystemPreparing = task;
      return task.then(function (ready) { if (lgSitesSystemPreparing === task) lgSitesSystemPreparing = null; return ready; });
    }
    function lgSitesSystemLocalUrl(checksum, callback) {
      var asset = CONFIG.sitesSystemAssets.filter(function (entry) { return entry.sha256 === checksum; })[0];
      if (!asset || !window.caches) { callback(null,null); return; }
      caches.open(lgSitesSystemCacheName).then(function (cache) { return cache.match(CONFIG.cachePathPrefix + checksum); }).then(function (response) { return lgSitesVerifiedBytes(response, asset); }).then(function (bytes) {
        if (!bytes) { callback(null,null); return; }
        var url = URL.createObjectURL(new Blob([bytes],{type:asset.mimeType}));callback(url,url);
      }, function () { callback(null,null); });
    }
    function lgSitesGoalDocument(model) {
      var pair = model && model.sitesPresentation;
      var orientation = runtime.goalScreenOrientation || (window.innerHeight > window.innerWidth ? "portrait" : "landscape");
      var value = pair && pair[orientation];
      return lgSitesValidDocument(value) && value.orientation === orientation ? value : null;
    }
    function lgSitesRenderGoal(model, expiresAt, serverOffset, callback) {
      var value = lgSitesGoalDocument(model);
      if (!value) return false;
      clearGoalElement();
      var overlay = byId("goal-overlay");var root = document.createElement("div");var artboard = document.createElement("div");var style = document.createElement("style");
      var disposed = false;var timer = null;var urls = [];var pageIndex = 0;var compiled = null;var resolved = null;var finished = false;
      root.className = "lg-sites-canvas";artboard.className = "lg-sites-artboard";root.appendChild(style);root.appendChild(artboard);
      artboard.style.width = String(value.width) + "px";artboard.style.height = String(value.height) + "px";
      root.style.visibility = "hidden";overlay.appendChild(root);overlay.hidden = false;overlay.setAttribute("data-renderer","sites-v11");
      runtime.goalActiveEventId = model.eventId;runtime.goalActiveKind = model.kind;runtime.goalActiveModel = model;
      function clean() { if (disposed) return;disposed = true;window.clearTimeout(timer);window.removeEventListener("resize",fit);artboard.removeEventListener("animationend",fit);revokeObjectUrls(urls);urls = []; }
      runtime.goalSitesCleanup = clean;
      function complete(ok) { if (finished) return;finished = true;callback(ok); }
      function alive() { return !disposed && runtime.goalActiveEventId === model.eventId && now() + serverOffset < expiresAt; }
      function fit() {
        if (!compiled) return;
        var width = overlay.clientWidth || window.innerWidth;var height = overlay.clientHeight || window.innerHeight;var scale = Math.min(width/value.width,height/value.height);
        artboard.style.position = "absolute";artboard.style.left = String((width-value.width*scale)/2)+"px";artboard.style.top = String((height-value.height*scale)/2)+"px";artboard.style.transformOrigin = "0 0";artboard.style.transform = "scale("+scale+")";
        lgSitesApplyMath(artboard,compiled,value.width,value.height);lgSitesAutoFit(artboard);lgSitesApplyMath(artboard,compiled,value.width,value.height);
      }
      function render() {
        var safe = lgSitesSafeMarkup(lgSitesReplaceTokens(resolved.document.pages[pageIndex],resolved.replacements));while(artboard.firstChild)artboard.removeChild(artboard.firstChild);while(safe.firstChild)artboard.appendChild(safe.firstChild);
        lgSitesInlineUnits(artboard,value.width,value.height);fit();
      }
      function advance() { if (!alive()) return;pageIndex = (pageIndex+1)%value.pages.length;render();timer = window.setTimeout(advance,Math.max(1000,value.pageDurationSeconds*1000)); }
      var maxWait = Math.min(5000,Math.max(1,expiresAt-now()-serverOffset));
      timer = window.setTimeout(function () { if (!disposed) complete(false); },maxWait);
      lgSitesResolveDocument({sitesPresentation:value,sitesGoalAssets:model.assets},function (fresh,freshUrls) {
        if (!alive()) { revokeObjectUrls(freshUrls);complete(false);return; }
        if (!fresh) { complete(false);return; }resolved = fresh;urls = freshUrls;compiled = lgSitesCompileCss(lgSitesReplaceTokens(value.css,fresh.replacements),value.width,value.height);style.textContent = compiled.css;render();
        window.addEventListener("resize",fit);artboard.addEventListener("animationend",fit);
        Promise.resolve(document.fonts && document.fonts.ready).then(function () {
          if (!alive()) { complete(false);return; }
          var images = Array.prototype.slice.call(artboard.querySelectorAll("img"));
          return Promise.all(images.map(function (image) { if(image.complete)return Promise.resolve(image.naturalWidth>0);return new Promise(function(resolve){image.onload=function(){resolve(true);};image.onerror=function(){resolve(false);};}); })).then(function (ready) {
            if (!ready.every(function (valid) { return valid; })) { complete(false);return; }
            window.requestAnimationFrame(function () { window.requestAnimationFrame(function () {
              if (!alive()) { complete(false);return; }fit();root.style.visibility = "visible";byId("watermark").className = "visible";window.clearTimeout(timer);timer = value.pages.length>1?window.setTimeout(advance,Math.max(1000,value.pageDurationSeconds*1000)):null;complete(true);
            }); });
          });
        }).catch(function () { complete(false); });
      });
      return true;
    }
`;}
