(function () {
  "use strict";

  var root = document.querySelector("[data-read-aloud]");
  if (!root) return;

  var article = document.querySelector(root.dataset.articleSelector || "#article-content");
  var toggleButton = root.querySelector("[data-reader-toggle]");
  var toggleLabel = root.querySelector("[data-reader-toggle-label]");
  var playIcon = root.querySelector("[data-reader-icon-play]");
  var pauseIcon = root.querySelector("[data-reader-icon-pause]");
  var loadingIcon = root.querySelector("[data-reader-icon-loading]");
  var stopButton = root.querySelector("[data-reader-stop]");
  var status = root.querySelector("[data-reader-status]");
  var progress = root.querySelector("[data-reader-progress]");
  var voiceSelect = root.querySelector("[data-reader-voice]");
  var voiceNote = root.querySelector("[data-reader-voice-note]");
  var rateInput = root.querySelector("[data-reader-rate]");
  var rateOutput = root.querySelector("[data-reader-rate-output]");
  var expressiveInput = root.querySelector("[data-reader-expressive]");
  var synth = window.speechSynthesis;
  var supportsBrowserSpeech = Boolean(
    synth &&
    typeof synth.speak === "function" &&
    typeof synth.cancel === "function" &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
  var supportsGemini = Boolean(
    window.fetch &&
    window.Audio &&
    window.URL &&
    typeof window.URL.createObjectURL === "function" &&
    typeof window.atob === "function"
  );
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var storageKey = "l1uyun-reader-preferences-v1";
  var geminiVoices = [
    { value: "gemini:Sulafat", label: "Sulafat · 温暖叙事" },
    { value: "gemini:Kore", label: "Kore · 坚定清晰" },
    { value: "gemini:Aoede", label: "Aoede · 轻盈自然" },
    { value: "gemini:Charon", label: "Charon · 知性讲述" },
  ];
  var voices = [];
  var browserQueue = [];
  var geminiQueue = [];
  var queueIndex = 0;
  var activeElement = null;
  var activeEngine = "browser";
  var state = "idle";
  var runId = 0;
  var currentAudio = null;
  var currentAudioUrl = "";
  var abortController = null;
  var geminiRequests = new Map();

  function setStatus(message) {
    status.textContent = message;
  }

  function showIcon(icon, visible) {
    icon.toggleAttribute("hidden", !visible);
  }

  function setState(nextState) {
    state = nextState;
    var isIdle = state === "idle";
    var isLoading = state === "loading";
    stopButton.disabled = isIdle;
    toggleButton.disabled = isLoading;
    root.setAttribute("aria-busy", isLoading ? "true" : "false");
    showIcon(playIcon, isIdle || state === "paused");
    showIcon(pauseIcon, state === "speaking");
    showIcon(loadingIcon, isLoading);

    if (isLoading) {
      toggleLabel.textContent = "正在生成";
    } else if (state === "speaking") {
      toggleLabel.textContent = "暂停";
    } else if (state === "paused") {
      toggleLabel.textContent = "继续";
    } else {
      toggleLabel.textContent = "开始朗读";
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          voice: voiceSelect.value,
          rate: rateInput.value,
          expressive: expressiveInput.checked,
        }),
      );
    } catch (_) {
      // Reading still works when storage is unavailable.
    }
  }

  function loadPreferences() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!saved) return;
      if (saved.rate && Number(saved.rate) >= 0.75 && Number(saved.rate) <= 1.35) {
        rateInput.value = saved.rate;
      }
      if (typeof saved.expressive === "boolean") expressiveInput.checked = saved.expressive;
      voiceSelect.dataset.savedVoice = saved.voice || "";
    } catch (_) {
      // Ignore malformed or blocked storage.
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanText(element, includeInlineCode) {
    var clone = element.cloneNode(true);
    var excluded = "script, style, pre, nav, button, .read-aloud, [aria-hidden='true']";
    if (!includeInlineCode) excluded += ", code";
    clone.querySelectorAll(excluded).forEach(function (node) {
      node.remove();
    });
    if (clone.matches("li")) {
      clone.querySelectorAll("ul, ol").forEach(function (node) {
        node.remove();
      });
    }
    return normalizeText(clone.textContent);
  }

  function collectBlocks() {
    if (!article) return [];
    var selector = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, dt, dd";
    return Array.prototype.filter.call(article.querySelectorAll(selector), function (element) {
      if (element.closest("nav, pre, code, script, style, [hidden], [aria-hidden='true']")) return false;
      if (element.matches("blockquote") && element.querySelector("p, li")) return false;
      if (element.matches("p") && element.closest("li")) return false;
      return cleanText(element, false).length > 0;
    });
  }

  function splitLongSentence(text, limit) {
    if (text.length <= limit) return [text];
    var parts = text.split(/(?<=[，、；：,;:])\s*/u);
    var chunks = [];
    var current = "";

    parts.forEach(function (part) {
      if (!part) return;
      if ((current + part).length <= limit) {
        current += part;
        return;
      }
      if (current) chunks.push(current.trim());
      current = part;
      while (current.length > limit) {
        chunks.push(current.slice(0, limit));
        current = current.slice(limit);
      }
    });

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  function splitSentences(text) {
    var segments = [];
    if (window.Intl && Intl.Segmenter) {
      var segmenter = new Intl.Segmenter("zh-CN", { granularity: "sentence" });
      segments = Array.from(segmenter.segment(text), function (item) {
        return item.segment.trim();
      }).filter(Boolean);
    } else {
      segments = text.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [text];
    }

    return segments.reduce(function (all, segment) {
      return all.concat(splitLongSentence(segment, 180));
    }, []);
  }

  function blockKind(element) {
    if (/^H[1-6]$/.test(element.tagName)) return "heading";
    if (element.tagName === "BLOCKQUOTE" || element.closest("blockquote")) return "quote";
    return "body";
  }

  function buildBrowserQueue() {
    var items = [];
    collectBlocks().forEach(function (element) {
      var kind = blockKind(element);
      splitSentences(cleanText(element, false)).forEach(function (text) {
        items.push({ text: text, element: element, kind: kind });
      });
    });
    return items;
  }

  function buildGeminiQueue() {
    var items = [];
    var current = null;

    function flush() {
      if (current && current.segments.length) items.push(current);
      current = null;
    }

    collectBlocks().forEach(function (element) {
      var text = cleanText(element, true);
      if (!text) return;
      splitSentences(text).forEach(function (segment) {
        var nextLength = (current ? current.length + 1 : 0) + segment.length;
        if (!current || nextLength > 620 || current.segments.length >= 8) {
          flush();
          current = { segments: [], elements: [], length: 0 };
        }
        current.segments.push(segment);
        current.length += (current.length ? 1 : 0) + segment.length;
        if (current.elements.indexOf(element) === -1) current.elements.push(element);
      });
    });

    flush();
    return items;
  }

  function estimateMinutes(items) {
    var characters = items.reduce(function (total, item) {
      return total + item.text.length;
    }, 0);
    return Math.max(1, Math.round(characters / 260));
  }

  function voiceScore(voice) {
    var name = (voice.name || "").toLowerCase();
    var lang = (voice.lang || "").toLowerCase();
    var score = 0;
    if (lang === "zh-cn") score += 100;
    else if (lang.indexOf("zh") === 0) score += 70;
    if (/xiaoxiao|xiaoyi|yunxi|yunyang|晓晓|晓伊|云希|云扬|natural|neural/.test(name)) score += 45;
    if (/microsoft|google/.test(name)) score += 10;
    if (voice.default) score += 4;
    return score;
  }

  function createOptionGroup(label, options) {
    var group = document.createElement("optgroup");
    group.label = label;
    options.forEach(function (item) {
      group.appendChild(new Option(item.label, item.value));
    });
    return group;
  }

  function populateVoices() {
    var savedVoice = voiceSelect.dataset.savedVoice || voiceSelect.value;
    if (savedVoice && savedVoice.indexOf(":") === -1) savedVoice = "browser:" + savedVoice;
    var fragment = document.createDocumentFragment();

    if (supportsGemini) {
      fragment.appendChild(createOptionGroup("Gemini AI 声音", geminiVoices));
    }

    if (supportsBrowserSpeech) {
      var available = synth.getVoices().slice();
      if (available.length) {
        voices = available.sort(function (a, b) {
          return voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name, "zh-CN");
        });
      }
      var chinese = voices.filter(function (voice) {
        return /^zh(?:-|$)/i.test(voice.lang || "");
      });
      var shown = chinese.length ? chinese : voices;
      var browserOptions = [{ label: "系统默认", value: "browser:" }];
      shown.forEach(function (voice) {
        browserOptions.push({
          label: voice.name + "（" + voice.lang + "）",
          value: "browser:" + voice.voiceURI,
        });
      });
      fragment.appendChild(createOptionGroup("设备声音", browserOptions));
    }

    voiceSelect.replaceChildren(fragment);
    var optionValues = Array.from(voiceSelect.options, function (option) { return option.value; });
    if (savedVoice && optionValues.indexOf(savedVoice) !== -1) {
      voiceSelect.value = savedVoice;
    } else if (supportsGemini) {
      voiceSelect.value = "gemini:Sulafat";
    } else {
      var preferred = voices.slice().sort(function (a, b) { return voiceScore(b) - voiceScore(a); })[0];
      voiceSelect.value = preferred ? "browser:" + preferred.voiceURI : "browser:";
    }
    updateVoiceNote();
  }

  function updateVoiceNote() {
    if (isGeminiSelected()) {
      voiceNote.textContent = "AI 声音更有表现力；失败时自动使用设备声音。";
    } else {
      voiceNote.textContent = "设备声音无需联网，音色取决于浏览器和操作系统。";
    }
  }

  function isGeminiSelected() {
    return voiceSelect.value.indexOf("gemini:") === 0;
  }

  function selectedGeminiVoice() {
    return isGeminiSelected() ? voiceSelect.value.slice("gemini:".length) : "Sulafat";
  }

  function selectedBrowserVoice() {
    var uri = voiceSelect.value.indexOf("browser:") === 0
      ? voiceSelect.value.slice("browser:".length)
      : "";
    return voices.find(function (voice) {
      return voice.voiceURI === uri;
    }) || null;
  }

  function prosodyFor(item) {
    var baseRate = Number(rateInput.value) || 1;
    var rate = baseRate;
    var pitch = 1;
    var pause = 120;

    if (expressiveInput.checked) {
      if (item.kind === "heading") {
        rate *= 0.9;
        pitch = 1.04;
        pause = 320;
      } else if (item.kind === "quote") {
        rate *= 0.94;
        pitch = 0.98;
        pause = 220;
      }
      if (/[！!]$/.test(item.text)) {
        rate *= 1.03;
        pitch += 0.07;
        pause = Math.max(pause, 230);
      } else if (/[？?]$/.test(item.text)) {
        rate *= 0.98;
        pitch += 0.06;
        pause = Math.max(pause, 250);
      } else if (/[。]$/.test(item.text)) {
        pause = Math.max(pause, 180);
      }
    }

    return {
      rate: Math.min(1.6, Math.max(0.6, rate)),
      pitch: Math.min(1.25, Math.max(0.8, pitch)),
      pause: pause,
    };
  }

  function clearHighlight() {
    if (activeElement) {
      activeElement.removeAttribute("data-reader-active");
      activeElement = null;
    }
  }

  function highlight(element) {
    if (!element || activeElement === element) return;
    clearHighlight();
    activeElement = element;
    activeElement.setAttribute("data-reader-active", "true");

    var rect = activeElement.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight - 48) {
      activeElement.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
  }

  function updateProgress(total) {
    progress.max = Math.max(total, 1);
    progress.value = Math.min(queueIndex + 1, total);
  }

  function cleanupAudio() {
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.ontimeupdate = null;
      currentAudio.pause();
      currentAudio.removeAttribute("src");
      currentAudio.load();
      currentAudio = null;
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = "";
    }
  }

  function cancelResources() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    geminiRequests.clear();
    cleanupAudio();
    if (supportsBrowserSpeech) synth.cancel();
  }

  function finish(total) {
    cancelResources();
    clearHighlight();
    queueIndex = 0;
    progress.max = Math.max(total, 1);
    progress.value = progress.max;
    setState("idle");
    setStatus("朗读完成。你可以重新开始，或调整声音与语速。");
  }

  function speakBrowserCurrent(currentRunId) {
    if (currentRunId !== runId || state === "idle") return;
    if (queueIndex >= browserQueue.length) {
      finish(browserQueue.length);
      return;
    }

    var item = browserQueue[queueIndex];
    var utterance = new SpeechSynthesisUtterance(item.text);
    var prosody = prosodyFor(item);
    var voice = selectedBrowserVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "zh-CN";
    } else {
      utterance.lang = "zh-CN";
    }
    utterance.rate = prosody.rate;
    utterance.pitch = prosody.pitch;
    utterance.volume = 1;

    utterance.onstart = function () {
      if (currentRunId !== runId) return;
      highlight(item.element);
      updateProgress(browserQueue.length);
      setStatus("正在使用设备声音朗读第 " + (queueIndex + 1) + " / " + browserQueue.length + " 段");
    };

    utterance.onend = function () {
      if (currentRunId !== runId || state === "idle") return;
      queueIndex += 1;
      window.setTimeout(function () {
        speakBrowserCurrent(currentRunId);
      }, prosody.pause);
    };

    utterance.onerror = function (event) {
      if (currentRunId !== runId || event.error === "canceled" || event.error === "interrupted") return;
      clearHighlight();
      setState("idle");
      setStatus("朗读被浏览器中断了。请换一个声音后重试。");
    };

    synth.speak(utterance);
  }

  function extractAudioBlob(payload) {
    var audioBlock = null;
    (payload.steps || []).forEach(function (step) {
      if (step.type !== "model_output") return;
      (step.content || []).forEach(function (content) {
        if (content.type === "audio" && content.data) audioBlock = content;
      });
    });

    if (!audioBlock || typeof audioBlock.data !== "string" || audioBlock.data.length > 32_000_000) {
      throw new Error("AI 语音响应无效。");
    }

    var binary = window.atob(audioBlock.data);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: audioBlock.mime_type || audioBlock.mimeType || "audio/wav" });
  }

  function fetchGeminiAudio(index, currentRunId) {
    if (geminiRequests.has(index)) return geminiRequests.get(index);
    var item = geminiQueue[index];
    var promise = fetch("/api/tts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname,
        segments: item.segments,
        voice: selectedGeminiVoice(),
        style: expressiveInput.checked ? "expressive" : "natural",
      }),
      signal: abortController.signal,
    }).then(function (response) {
      if (currentRunId !== runId) throw new DOMException("Canceled", "AbortError");
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || "AI 朗读服务暂时不可用。");
        });
      }
      return response.json();
    }).then(extractAudioBlob);

    geminiRequests.set(index, promise);
    promise.catch(function () {
      // The active chunk reports the error; this prevents a prefetched rejection from becoming unhandled.
    });
    return promise;
  }

  function updateGeminiHighlight(item) {
    if (!currentAudio || !item.elements.length) return;
    var ratio = currentAudio.duration && Number.isFinite(currentAudio.duration)
      ? currentAudio.currentTime / currentAudio.duration
      : 0;
    var elementIndex = Math.min(item.elements.length - 1, Math.floor(ratio * item.elements.length));
    highlight(item.elements[elementIndex]);
  }

  function fallbackToBrowser(message, currentRunId) {
    if (currentRunId !== runId) return;
    cancelResources();
    clearHighlight();

    if (!supportsBrowserSpeech || !browserQueue.length) {
      setState("idle");
      setStatus(message + " 当前设备也没有可用的浏览器语音。");
      return;
    }

    activeEngine = "browser";
    queueIndex = 0;
    progress.max = browserQueue.length;
    progress.value = 0;
    setState("speaking");
    setStatus(message + " 已自动切换为设备声音。");
    window.setTimeout(function () {
      speakBrowserCurrent(currentRunId);
    }, 350);
  }

  async function playGeminiChunk(currentRunId) {
    if (currentRunId !== runId || state === "idle") return;
    if (queueIndex >= geminiQueue.length) {
      finish(geminiQueue.length);
      return;
    }

    var item = geminiQueue[queueIndex];
    setState("loading");
    setStatus("正在生成 AI 语音，第 " + (queueIndex + 1) + " / " + geminiQueue.length + " 段…");

    var blob;
    try {
      blob = await fetchGeminiAudio(queueIndex, currentRunId);
    } catch (error) {
      if (error.name === "AbortError" || currentRunId !== runId) return;
      fallbackToBrowser(error.message || "AI 朗读暂时不可用。", currentRunId);
      return;
    }

    if (currentRunId !== runId || state === "idle") return;
    cleanupAudio();
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentAudioUrl);
    currentAudio.preload = "auto";
    currentAudio.playbackRate = Number(rateInput.value) || 1;
    currentAudio.ontimeupdate = function () {
      updateGeminiHighlight(item);
    };
    currentAudio.onended = function () {
      if (currentRunId !== runId) return;
      cleanupAudio();
      queueIndex += 1;
      playGeminiChunk(currentRunId);
    };
    currentAudio.onerror = function () {
      fallbackToBrowser("AI 音频无法播放。", currentRunId);
    };

    highlight(item.elements[0]);
    updateProgress(geminiQueue.length);
    if (queueIndex + 1 < geminiQueue.length) fetchGeminiAudio(queueIndex + 1, currentRunId);
    setState("speaking");
    setStatus("正在使用 Gemini 朗读第 " + (queueIndex + 1) + " / " + geminiQueue.length + " 段");

    try {
      await currentAudio.play();
    } catch (_) {
      if (currentRunId !== runId) return;
      setState("paused");
      setStatus("AI 语音已经生成。点击“继续”即可播放。");
    }
  }

  function start() {
    browserQueue = buildBrowserQueue();
    geminiQueue = buildGeminiQueue();
    if (!browserQueue.length && !geminiQueue.length) {
      setStatus("没有找到可朗读的正文。");
      return;
    }

    runId += 1;
    queueIndex = 0;
    cancelResources();
    clearHighlight();

    if (isGeminiSelected() && supportsGemini && geminiQueue.length) {
      activeEngine = "gemini";
      abortController = new AbortController();
      progress.max = geminiQueue.length;
      progress.value = 0;
      setState("loading");
      playGeminiChunk(runId);
      return;
    }

    if (supportsBrowserSpeech && browserQueue.length) {
      activeEngine = "browser";
      progress.max = browserQueue.length;
      progress.value = 0;
      setState("speaking");
      setStatus("开始使用设备声音朗读，共 " + browserQueue.length + " 段。");
      speakBrowserCurrent(runId);
      return;
    }

    setState("idle");
    setStatus("当前浏览器没有可用的朗读能力，请使用最新版 Chrome、Edge 或 Safari。");
  }

  function pause() {
    if (activeEngine === "gemini" && currentAudio) currentAudio.pause();
    else if (supportsBrowserSpeech) synth.pause();
    setState("paused");
    var total = activeEngine === "gemini" ? geminiQueue.length : browserQueue.length;
    setStatus("已暂停在第 " + (queueIndex + 1) + " / " + total + " 段。");
  }

  function resume() {
    setState("speaking");
    var total = activeEngine === "gemini" ? geminiQueue.length : browserQueue.length;
    setStatus("继续朗读第 " + (queueIndex + 1) + " / " + total + " 段。");
    if (activeEngine === "gemini" && currentAudio) {
      currentAudio.play().catch(function () {
        setState("paused");
        setStatus("浏览器阻止了自动播放，请再次点击“继续”。");
      });
    } else if (supportsBrowserSpeech) {
      synth.resume();
    }
  }

  function stop(message) {
    runId += 1;
    cancelResources();
    clearHighlight();
    queueIndex = 0;
    progress.value = 0;
    setState("idle");
    setStatus(message || "已停止朗读。");
  }

  function updateReadyStatus() {
    browserQueue = buildBrowserQueue();
    geminiQueue = buildGeminiQueue();
    var selectedCount = isGeminiSelected() ? geminiQueue.length : browserQueue.length;
    progress.max = Math.max(selectedCount, 1);
    progress.value = 0;
    var source = isGeminiSelected() ? "默认使用 Gemini AI 声音" : "使用设备声音，无需联网";
    setStatus(
      "正文共 " + browserQueue.length + " 段，预计约 " + estimateMinutes(browserQueue) + " 分钟；" + source + "。",
    );
  }

  loadPreferences();
  rateOutput.value = Number(rateInput.value).toFixed(2) + "×";
  populateVoices();
  setState("idle");

  if (!article || (!supportsGemini && !supportsBrowserSpeech)) {
    toggleButton.disabled = true;
    stopButton.disabled = true;
    voiceSelect.disabled = true;
    rateInput.disabled = true;
    expressiveInput.disabled = true;
    setStatus("当前浏览器不支持网页朗读，请使用最新版 Chrome、Edge 或 Safari。");
    return;
  }

  updateReadyStatus();
  if (
    supportsBrowserSpeech &&
    "onvoiceschanged" in synth &&
    typeof synth.addEventListener === "function"
  ) {
    synth.addEventListener("voiceschanged", populateVoices);
  }

  toggleButton.addEventListener("click", function () {
    if (state === "idle") start();
    else if (state === "speaking") pause();
    else if (state === "paused") resume();
  });

  stopButton.addEventListener("click", function () {
    stop();
  });

  rateInput.addEventListener("input", function () {
    rateOutput.value = Number(rateInput.value).toFixed(2) + "×";
    if (currentAudio) currentAudio.playbackRate = Number(rateInput.value) || 1;
  });
  rateInput.addEventListener("change", savePreferences);
  voiceSelect.addEventListener("change", function () {
    if (state !== "idle") stop("声音已切换，点击开始即可重新朗读。");
    updateVoiceNote();
    updateReadyStatus();
    savePreferences();
  });
  expressiveInput.addEventListener("change", function () {
    if (state !== "idle") stop("语气设置已更新，点击开始即可重新朗读。");
    savePreferences();
  });
  window.addEventListener("pagehide", function () {
    if (state !== "idle") stop();
  });
})();
