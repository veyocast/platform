import {lgSitesCssScript} from "./lg-sites-css";

/** ES5-only bridge: the standalone LG document reuses its existing decoder in each zone. */
export function lgSitesRuntimeScript() {
  return `
    ${lgSitesCssScript()}
    var legacyIsCompositionZone = Boolean(window.frameElement && window.frameElement.getAttribute("data-lg-composition-zone"));
    var legacyZoneCallbacks = null;
    var legacyZoneHeld = false;
    var legacyZoneBlueprint = legacyIsCompositionZone ? null : document.documentElement.outerHTML;
    var legacyCompositionPending = null;
    var legacyCompositionAckKey = null;

    function lgCompositionIdentity(envelope) {
      var composition = envelope && envelope.composition;
      if (!composition) return "full";
      var published = composition.published;
      if (!published || !Array.isArray(published.bindings)) return "invalid";
      return String(published.id) + ":" + String(published.revision) + ":" + published.bindings.map(function (binding) {
        return binding.zoneId + ":" + binding.releaseId;
      }).join(":");
    }
    function lgEnvelopeDataIdentity(envelope) {
      var envelopes = [envelope];
      var composition = envelope && envelope.composition;
      if (composition && composition.zones) {
        ["side", "bottom"].forEach(function (id) { if (composition.zones[id]) envelopes.push(composition.zones[id]); });
      }
      return envelopes.map(function (zone) {
        return (zone.manifest && zone.manifest.items || []).map(function (item) {
          return item.id + ":" + (item.dynamicTemplate && item.dynamicTemplate.snapshotHash || "");
        }).join(":");
      }).join("|");
    }
    function lgCompositionZones(envelope) {
      var composition = envelope && envelope.composition;
      if (!composition) return [];
      var published = composition.published;
      var configuration = published && published.configuration;
      var layout = configuration && configuration.layout;
      var ids = layout === "full" ? ["main"] : layout === "sidebar" ? ["main", "side"] : layout === "bottom" ? ["main", "bottom"] : layout === "three" ? ["main", "side", "bottom"] : [];
      var main = configuration && Number(configuration.mainWidthPercent);
      var bottom = configuration && Number(configuration.bottomHeightPercent);
      if (!published || !/^[a-f0-9-]{36}$/i.test(published.id || "") || typeof published.revision !== "number" || !isFinite(published.revision) || Math.floor(published.revision) !== published.revision || published.revision < 1 ||
        !configuration || configuration.schemaVersion !== 1 || ["portrait", "landscape"].indexOf(configuration.orientation) === -1 ||
        !ids.length || !isFinite(main) || main < 50 || main > 80 || main % 5 || !isFinite(bottom) || bottom < 15 || bottom > 35 || bottom % 5 ||
        !Array.isArray(published.bindings) || published.bindings.length !== ids.length || !Array.isArray(configuration.zones) || configuration.zones.length !== ids.length) return null;
      var width = ids.indexOf("side") !== -1 ? main : 100;
      var height = ids.indexOf("bottom") !== -1 ? 100 - bottom : 100;
      var zones = [];
      for (var index = 0; index < ids.length; index += 1) {
        var id = ids[index];
        var bindings = published.bindings.filter(function (binding) { return binding.zoneId === id; });
        var configured = configuration.zones.filter(function (zone) { return zone.id === id; });
        var child = id === "main" ? envelope : composition.zones && composition.zones[id];
        if (bindings.length !== 1 || configured.length !== 1 || configured[0].playlistId !== bindings[0].playlistId || !isManifestEnvelope(child) ||
          child.manifest.tenantId !== envelope.manifest.tenantId || child.device.id !== envelope.device.id || child.device.screenId !== envelope.device.screenId ||
          (id !== "main" && (child.composition || child.manifest.releaseId !== bindings[0].releaseId || child.manifest.playlistId !== bindings[0].playlistId))) return null;
        zones.push({ id: id, envelope: child, left: id === "side" ? width : 0, top: id === "bottom" ? height : 0,
          width: id === "bottom" ? 100 : id === "side" ? 100 - width : width, height: id === "bottom" ? bottom : height });
      }
      return zones;
    }
    function lgZoneBoundary() {
      if (!legacyIsCompositionZone || !legacyZoneCallbacks || !legacyZoneCallbacks.boundary()) return false;
      legacyZoneHeld = true;
      clearPlaybackTimers();
      silenceCurrentMediaEvents();
      return true;
    }
    function lgCompositionCancelBoundary() {
      var controller = runtime.currentElement && runtime.currentElement.lgComposition;
      if (!controller || runtime.pendingRelease) return;
      controller.held = {};
      controller.activationRequested = false;
      controller.frames.forEach(function (frame) { if (frame.contentWindow && frame.contentWindow.__veyocastLgZone) frame.contentWindow.__veyocastLgZone.resume(); });
    }
    function lgCompositionPause(paused) {
      var controller = runtime.currentElement && runtime.currentElement.lgComposition;
      if (!controller) return;
      controller.frames.forEach(function (frame) { if (frame.contentWindow && frame.contentWindow.__veyocastLgZone) frame.contentWindow.__veyocastLgZone.pause(paused); });
    }
    function lgCompositionStart(envelope, generation) {
      var zones = lgCompositionZones(envelope);
      if (!zones || !zones.length || !legacyZoneBlueprint) { failItem("LEGACY_COMPOSITION_INVALID"); return; }
      var root = document.createElement("div");
      root.className = "lg-screen-composition";
      root.style.background = "#050505";
      var controller = { root: root, envelope: envelope, frames: [], ready: {}, held: {}, generation: generation, disposed: false, committed: false, timer: null };
      root.lgComposition = controller;
      root.lgCleanup = function () {
        if (controller.disposed) return;
        controller.disposed = true;
        window.clearTimeout(controller.timer);
        controller.frames.forEach(function (frame) {
          try { if (frame.contentWindow && frame.contentWindow.__veyocastLgZone) frame.contentWindow.__veyocastLgZone.dispose(); } catch (error) {}
          if (frame.parentNode) frame.parentNode.removeChild(frame);
        });
        if (legacyCompositionPending === controller) legacyCompositionPending = null;
      };
      function failed() {
        if (controller.disposed || controller.committed || generation !== runtime.playbackGeneration) return;
        if (runtime.pendingElement === root) cancelPendingMedia();
        else root.lgCleanup();
        failItem("LEGACY_COMPOSITION_FRAME_UNAVAILABLE");
      }
      function frameReady(id, item, index) {
        if (controller.disposed || generation !== runtime.playbackGeneration) return;
        controller.ready[id] = true;
        if (id === "main") { controller.mainItem = item; controller.mainIndex = index; if (controller.committed) { runtime.currentItem = item; runtime.activeIndex = index; } }
        if (controller.committed || !zones.every(function (zone) { return controller.ready[zone.id]; })) return;
        window.clearTimeout(controller.timer);
        controller.committed = true;
        runtime.currentItem = controller.mainItem;
        runtime.activeIndex = controller.mainIndex;
        if (commitPendingMedia(root, [], generation)) legacyCompositionPending = null;
      }
      function boundary(id) {
        if (controller.disposed || runtime.currentElement !== root || !runtime.pendingRelease || runtime.goalPauseApplied) return false;
        controller.held[id] = true;
        if (!controller.activationRequested && zones.every(function (zone) { return controller.held[zone.id]; })) { controller.activationRequested = true; window.setTimeout(function () {
          if (!controller.disposed && runtime.currentElement === root && runtime.pendingRelease) nextItem();
        }, 0); }
        return true;
      }
      beginPendingMedia(root, []);
      legacyCompositionPending = controller;
      controller.timer = window.setTimeout(failed, 30000);
      zones.forEach(function (zone) {
        if (controller.disposed) return;
        var frame = document.createElement("iframe");
        frame.setAttribute("data-lg-composition-zone", zone.id);
        frame.setAttribute("title", "Contentzone " + zone.id);
        frame.setAttribute("allow", "autoplay");
        frame.setAttribute("aria-hidden", "true");
        frame.style.position = "absolute";
        frame.style.left = String(zone.left) + "%";
        frame.style.top = String(zone.top) + "%";
        frame.style.width = String(zone.width) + "%";
        frame.style.height = String(zone.height) + "%";
        frame.style.border = "0";
        frame.style.pointerEvents = "none";
        controller.frames.push(frame);
        root.appendChild(frame);
        try {
          frame.contentDocument.open();
          frame.contentDocument.write(legacyZoneBlueprint);
          frame.contentDocument.close();
          var bridge = frame.contentWindow.__veyocastLgZone;
          if (!bridge) { failed(); return; }
          bridge.initialize(zone.envelope, zone.id === "main" ? runtime.activeIndex : 0, {
            ready: function (item, index) { frameReady(zone.id, item, index); },
            boundary: function () { return boundary(zone.id); }, wantsBoundary: function () { return Boolean(runtime.pendingRelease); }, failed: failed
          });
        } catch (error) { failed(); }
      });
    }
    function lgCompositionAck() {
      var controller = runtime.currentElement && runtime.currentElement.lgComposition;
      var composition = controller && controller.envelope.composition;
      var target = controller && controller.envelope.target;
      if (!controller || !controller.committed || controller.disposed || !composition || !target || !runtime.deviceToken || runtime.offline) return;
      var key = composition.published.id + ":" + target.revision;
      if (key === legacyCompositionAckKey) return;
      legacyCompositionAckKey = key;
      request("POST", "/api/player/composition/ack", { Authorization: "Bearer " + runtime.deviceToken, "Content-Type": "application/json" },
        JSON.stringify({ compositionId: composition.published.id, targetRevision: target.revision }), function (transport, status) {
          if (transport || status < 200 || status >= 300) { if (legacyCompositionAckKey === key) legacyCompositionAckKey = null; }
        });
    }
    function lgInstallZoneBridge() {
      window.__veyocastLgZone = {
        initialize: function (envelope, index, callbacks) {
          legacyZoneCallbacks = callbacks;
          runtime.envelope = envelope;
          runtime.offline = false;
          runtime.activeIndex = index;
          runtime.targetGeneration += 1;
          runtime.deviceToken = null;
          runtime.identityReady = false;
          byId("status").hidden = true;
          byId("watermark").style.display = "none";
          byId("offline").style.display = "none";
          playCurrent();
        },
        resume: function () { if (legacyZoneHeld) { legacyZoneHeld = false; nextItem(); } },
        pause: function (paused) { if (paused) pauseGoalUnderlay(); else resumeGoalUnderlay(); },
        refresh: function (envelope) { refreshSameReleaseMediaAccess(envelope); },
        dispose: function () { legacyZoneCallbacks = null; runtime.playbackGeneration += 1; clearMedia(); }
      };
    }

    function lgSitesMarkupSupported() {
      return Boolean(document.createElement && window.getComputedStyle);
    }
    function lgSitesValidDocument(value) {
      return Boolean(value && (value.rendererVersion === "sites-v11" && value.sourceRevision === "b1cae899af19fc39908217253094c5240d7359fc" || value.rendererVersion === "sites-v17" && value.sourceRevision === "6800bc858436ba0843eaea89b682cd5b43c3521d") &&
        ["portrait", "landscape"].indexOf(value.orientation) !== -1 && value.width === (value.orientation === "portrait" ? 1080 : 1920) && value.height === (value.orientation === "portrait" ? 1920 : 1080) &&
        Array.isArray(value.pages) && value.pages.length > 0 && value.pages.length <= 250 && value.pages.every(function (page) { return typeof page === "string" && page.length <= 1048576; }) &&
        typeof value.css === "string" && value.css.length <= 1048576 && Array.isArray(value.assetTokens) && value.assetTokens.length <= 2000);
    }
    function lgSitesResolveDocument(item, callback) {
      var value = item.sitesPresentation;
      if (!lgSitesValidDocument(value)) { callback(null, []); return; }
      var replacements = {};
      var objectUrls = [];
      var index = 0;
      function next() {
        if (index >= value.assetTokens.length) { callback({ document: value, replacements: replacements }, objectUrls); return; }
        var entry = value.assetTokens[index++];
        if (!entry || typeof entry.token !== "string" || !/^VEYOSITES_ASSET_[a-f0-9]{64}$/.test(entry.token) || typeof entry.cacheKey !== "string" || !/^\\/__veyocast-(player|goal)-cache\\/[a-f0-9]{64}$/.test(entry.cacheKey) || entry.token.slice("VEYOSITES_ASSET_".length) !== entry.cacheKey.slice(entry.cacheKey.lastIndexOf("/")+1)) {
          revokeObjectUrls(objectUrls); callback(null, []); return;
        }
        var checksum = entry.token.slice("VEYOSITES_ASSET_".length);
        function received(url, objectUrl) {
          if (!url) { revokeObjectUrls(objectUrls); callback(null, []); return; }
          replacements[entry.token] = url;
          if (objectUrl) objectUrls.push(objectUrl);
          next();
        }
        if (entry.cacheKey.indexOf("/__veyocast-goal-cache/") === 0) {
          var ids = Object.keys(item.sitesGoalAssets || {});
          var asset = ids.map(function (id) { return item.sitesGoalAssets[id]; }).filter(function (candidate) { return candidate.checksum === checksum && candidate.mimeType.indexOf("image/") === 0; })[0];
          if (!asset) { received(null,null); return; }
          goalV2LocalUrl(asset).then(function (url) { received(url,url); }, function () { received(null,null); });
        } else cachedAssetUrl({checksumSha256:checksum},function (url,objectUrl) {
          if (url) received(url,objectUrl);
          else if (typeof lgSitesSystemLocalUrl === "function") lgSitesSystemLocalUrl(checksum,received);
          else received(null,null);
        });
      }
      next();
    }
    function lgSitesReplaceTokens(value, replacements) {
      return value.replace(/VEYOSITES_ASSET_[a-f0-9]{64}/g, function (token) { return replacements[token] || ""; });
    }
    function lgSitesSafeMarkup(markup) {
      var container = document.createElement("div");
      container.innerHTML = markup;
      var blocked = container.querySelectorAll("script,iframe,object,embed,base,link,meta");
      for (var index = 0; index < blocked.length; index += 1) blocked[index].parentNode.removeChild(blocked[index]);
      var nodes = container.querySelectorAll("*");
      for (var n = 0; n < nodes.length; n += 1) {
        var attributes = Array.prototype.slice.call(nodes[n].attributes);
        attributes.forEach(function (attribute) {
          if (/^on/i.test(attribute.name) || /^(href|src|xlink:href)$/i.test(attribute.name) && /^\\s*(javascript|vbscript):/i.test(attribute.value)) nodes[n].removeAttribute(attribute.name);
        });
      }
      return container;
    }
    function lgSitesInlineUnits(artboard, width, height) {
      var nodes = artboard.querySelectorAll("[style]");
      for (var index = 0; index < nodes.length; index += 1) {
        for (var property = 0; property < nodes[index].style.length; property += 1) {
          var name = nodes[index].style[property];
          var value = nodes[index].style.getPropertyValue(name);
          if (/cqw|cqh|cqmin|cqmax/.test(value)) nodes[index].style.setProperty(name, normalizeLgSitesCss(value, width, height), nodes[index].style.getPropertyPriority(name));
        }
      }
      var canvas = artboard.firstElementChild;
      if (canvas) { canvas.style.width = String(width) + "px"; canvas.style.height = String(height) + "px"; canvas.style.maxWidth = String(width) + "px"; canvas.style.maxHeight = String(height) + "px"; }
    }
    function lgSitesCompileCss(css, width, height) {
      var calculations = [];
      var output = normalizeLgSitesCss(css, width, height).replace(/([^{}]+)\\{([^{}]*)\\}/g, function (rule, selector, declarations) {
        if (/^\\s*@|^\\s*(from|to|[0-9.]+%)\\s*$/.test(selector)) return rule;
        var body = declarations.replace(/(^|;)([\\w-]+)\\s*:\\s*([^;]+)/g, function (declaration, separator, name, value) {
          if (!/\\b(calc|min|max|clamp|color-mix)\\(/.test(value)) return declaration;
          var important = /\\s*!important\\s*$/.test(value);
          var expression = value.replace(/\\s*!important\\s*$/, "");
          var variable = "--lg-sites-math-" + String(calculations.length);
          calculations.push({selector: selector, variable: variable, expression: expression});
          return separator + name + ":var(" + variable + "," + expression + ")" + (important ? "!important" : "");
        });
        return selector + "{" + body + "}";
      });
      return {css: output, calculations: calculations};
    }
    function lgSitesApplyMath(artboard, compiled, width, height) {
      compiled.calculations.forEach(function (calculation) {
        var nodes;
        try { nodes = artboard.querySelectorAll(calculation.selector); } catch (error) { return; }
        for (var index = 0; index < nodes.length; index += 1) {
          var node = nodes[index];
          var computed = window.getComputedStyle(node);
          var variables = {};
          calculation.expression.replace(/var\\(\\s*(--[\\w-]+)/g, function (match, name) { variables[name] = computed.getPropertyValue(name).trim(); return match; });
          var value = normalizeLgSitesCss(calculation.expression, width, height, variables);
          if (!/\\b(min|max|clamp|color-mix)\\(/.test(value) && value.indexOf("var(") === -1) node.style.setProperty(calculation.variable, value);
        }
      });
    }
    function lgSitesAutoFit(artboard) {
      var menuImages = artboard.querySelectorAll(".vm-widget-image[data-ratio]");
      for (var imageIndex = 0; imageIndex < menuImages.length; imageIndex += 1) {
        var frame = menuImages[imageIndex]; var image = frame.querySelector("img"); if (!image) continue;
        var imageRatio = frame.getAttribute("data-ratio") === "9:16" ? 9 / 16 : 16 / 9;
        var imageWidth = Math.min(frame.clientWidth, frame.clientHeight * imageRatio);
        image.style.width = String(imageWidth) + "px"; image.style.height = String(imageWidth / imageRatio) + "px";
      }
      var boxes = artboard.querySelectorAll("[data-fit-box]");
      for (var index = 0; index < boxes.length; index += 1) {
        var box = boxes[index]; var inner = box.querySelector("[data-fit-content]"); if (!inner) continue;
        var base = inner.getBoundingClientRect(); var ratio = base.width / Math.max(1, inner.offsetWidth) || 1;
        var left = base.left; var right = base.right; var top = base.top; var bottom = base.bottom;
        for (var child = 0; child < inner.children.length; child += 1) { var bounds = inner.children[child].getBoundingClientRect(); left = Math.min(left, bounds.left); right = Math.max(right, bounds.right); top = Math.min(top, bounds.top); bottom = Math.max(bottom, bounds.bottom); }
        var width = Math.max(inner.scrollWidth, inner.offsetWidth, (right - left) / ratio, 1);
        var height = Math.max(inner.scrollHeight, inner.offsetHeight, (bottom - top) / ratio, 1);
        var isMenu = inner.classList.contains("vm-content");
        var scale = Math.min(1, box.clientWidth / (width * (isMenu ? 1 : 1.035)), box.clientHeight / (height * (isMenu ? 1 : 1.08)));
        inner.style.setProperty("--led-auto-fit", String(Math.max(.01, scale)));
      }
      var text = artboard.querySelectorAll(".otv-live-score,.otv-score-team h2,.otv-score-screen h1,.ns-match-teams h3,.otv-generic h1,.nk-welcome-copy h1,.nk-walking-feature h2");
      for (var n = 0; n < text.length; n += 1) {
        var element = text[n];
        if (element.lgOriginalFontSize === undefined) element.lgOriginalFontSize = element.style.fontSize;
        else element.style.fontSize = element.lgOriginalFontSize;
        var computed = window.getComputedStyle(element); var size = parseFloat(computed.fontSize); var baseSize = size; var maximum = parseFloat(computed.maxHeight);
        for (var attempt = 0; attempt < 22 && size > baseSize * .45 && (element.scrollWidth > element.clientWidth + 2 || isFinite(maximum) && element.scrollHeight > maximum + 2); attempt += 1) { size *= .94; element.style.fontSize = String(size) + "px"; }
      }
    }
    function playSitesMarkup(item, fallbackUrl, objectUrls, generation) {
      if (!lgSitesMarkupSupported() || !lgSitesValidDocument(item.sitesPresentation)) return false;
      lgSitesResolveDocument(item, function (resolved, extraUrls) {
        if (generation !== runtime.playbackGeneration) { revokeObjectUrls(extraUrls); return; }
        if (!resolved) { playImage(item, fallbackUrl, objectUrls, generation); return; }
        var root = document.createElement("div");
        root.className = "lg-sites-canvas";
        var style = document.createElement("style");
        var artboard = document.createElement("div");
        artboard.className = "lg-sites-artboard";
        artboard.style.width = String(resolved.document.width) + "px";
        artboard.style.height = String(resolved.document.height) + "px";
        artboard.style.containerType = "inline-size";
        var compiled = lgSitesCompileCss(lgSitesReplaceTokens(resolved.document.css, resolved.replacements), resolved.document.width, resolved.document.height);
        style.textContent = compiled.css;
        root.appendChild(style);
        root.appendChild(artboard);
        var pageIndex = 0;
        function fit() {
          var width = root.clientWidth;
          var height = root.clientHeight;
          var scale = Math.min(width / resolved.document.width, height / resolved.document.height);
          artboard.style.position = "absolute";
          artboard.style.left = String((width - resolved.document.width * scale) / 2) + "px";
          artboard.style.top = String((height - resolved.document.height * scale) / 2) + "px";
          artboard.style.transformOrigin = "0 0";
          artboard.style.transform = "scale(" + scale + ")";
          lgSitesApplyMath(artboard, compiled, resolved.document.width, resolved.document.height);
          lgSitesAutoFit(artboard);
          lgSitesApplyMath(artboard, compiled, resolved.document.width, resolved.document.height);
        }
        function render() {
          var safe = lgSitesSafeMarkup(lgSitesReplaceTokens(resolved.document.pages[pageIndex], resolved.replacements));
          while (artboard.firstChild) artboard.removeChild(artboard.firstChild);
          while (safe.firstChild) artboard.appendChild(safe.firstChild);
          lgSitesInlineUnits(artboard, resolved.document.width, resolved.document.height);
          fit();
        }
        function advance() {
          if (generation !== runtime.playbackGeneration) return;
          if (runtime.pendingRelease || legacyIsCompositionZone && legacyZoneCallbacks && legacyZoneCallbacks.boundary()) { nextItem(); return; }
          pageIndex += 1;
          if (pageIndex >= resolved.document.pages.length) { nextItem(); return; }
          render();
          scheduleTemplateAdvance(advance, Math.max(1000, Number(resolved.document.pageDurationSeconds) * 1000 || itemDurationMs(item)));
        }
        var allUrls = objectUrls.concat(extraUrls);
        var refreshGeneration = 0;
        root.liveDataObjectUrls = extraUrls;
        root.refreshSitesData = function (freshItem) {
          var refresh = ++refreshGeneration;
          lgSitesResolveDocument(freshItem, function (fresh, freshUrls) {
            if (!fresh || refresh !== refreshGeneration || generation !== runtime.playbackGeneration || runtime.currentElement !== root) { revokeObjectUrls(freshUrls); return; }
            var oldUrls = root.liveDataObjectUrls || [];
            resolved = fresh;
            pageIndex = Math.min(pageIndex, resolved.document.pages.length - 1);
            compiled = lgSitesCompileCss(lgSitesReplaceTokens(resolved.document.css, resolved.replacements), resolved.document.width, resolved.document.height);
            style.textContent = compiled.css;
            root.liveDataObjectUrls = freshUrls;
            runtime.currentObjectUrls = runtime.currentObjectUrls.filter(function (url) { return oldUrls.indexOf(url) === -1; }).concat(freshUrls);
            render();
            Promise.resolve(document.fonts && document.fonts.ready).then(function () { if (refresh === refreshGeneration && runtime.currentElement === root) { fit(); revokeObjectUrls(oldUrls); } });
          });
        };
        root.lgCleanup = function () { refreshGeneration += 1; window.removeEventListener("resize", fit); artboard.removeEventListener("animationend", fit); };
        beginPendingMedia(root, allUrls);
        render();
        window.addEventListener("resize", fit);
        artboard.addEventListener("animationend", fit);
        Promise.resolve(document.fonts && document.fonts.ready).then(function () {
          if (generation !== runtime.playbackGeneration || runtime.pendingElement !== root) return;
          var images = Array.prototype.slice.call(artboard.querySelectorAll("img"));
          return Promise.all(images.map(function (image) { return image.complete ? Promise.resolve() : new Promise(function (resolve) { image.onload = image.onerror = resolve; }); })).then(function () {
            window.requestAnimationFrame(function () {
              if (generation !== runtime.playbackGeneration || runtime.pendingElement !== root) return;
              fit();
              if (commitPendingMedia(root, allUrls, generation)) { window.clearTimeout(runtime.watchdogTimer); runtime.watchdogTimer = null; scheduleTemplateAdvance(advance, Math.max(1000, Number(resolved.document.pageDurationSeconds) * 1000 || itemDurationMs(item))); }
            });
          });
        });
        runtime.watchdogTimer = window.setTimeout(function () {
          if (generation !== runtime.playbackGeneration || runtime.pendingElement !== root) return;
          cancelPendingMedia();
          sourceForItem(item, function (url, objectUrl) { if (generation === runtime.playbackGeneration && url) playImage(item, url, objectUrl ? [objectUrl] : [], generation); });
        }, 15000);
      });
      return true;
    }
  `;
}
