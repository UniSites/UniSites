(function attachBase64Lab(global) {
  "use strict";

  const STANDARD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const URL_SAFE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  function utf8ToBytes(text) {
    return new TextEncoder().encode(text);
  }

  function bytesToBinaryString(bytes) {
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return binary;
  }

  function bytesToBase64(bytes, options = {}) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError("输入必须是 Uint8Array。");
    }
    const { urlSafe = false, padding = true } = options;
    let result;
    if (typeof global.btoa === "function") {
      result = global.btoa(bytesToBinaryString(bytes));
    } else if (typeof Buffer !== "undefined") {
      result = Buffer.from(bytes).toString("base64");
    } else {
      throw new Error("当前环境不支持 Base64 编码。");
    }
    if (urlSafe) {
      result = result.replace(/\+/g, "-").replace(/\//g, "_");
    }
    if (!padding) {
      result = result.replace(/=+$/g, "");
    }
    return result;
  }

  function base64ToBytes(input, options = {}) {
    if (typeof input !== "string") {
      throw new TypeError("Base64 输入必须是字符串。");
    }
    const { urlSafe = false } = options;
    const compact = input.replace(/[\t\n\f\r ]/g, "");
    if (!compact) {
      return new Uint8Array(0);
    }

    const match = compact.match(/^([A-Za-z0-9+/_-]*)(={0,2})$/);
    const body = match ? match[1] : "";
    const padding = match ? match[2] : "";
    const bodyPattern = urlSafe ? /^[A-Za-z0-9_-]*$/ : /^[A-Za-z0-9+/]*$/;

    if (!match || !bodyPattern.test(body)) {
      throw new Error(urlSafe ? "包含 URL-safe Base64 不允许的字符。" : "包含标准 Base64 不允许的字符。");
    }
    if (padding && compact.length % 4 !== 0) {
      throw new Error("填充位置或数量不正确，请检查末尾的 =。");
    }
    if (body.length % 4 === 1) {
      throw new Error("Base64 长度无效：有效字符数不能是 4 的倍数加 1。");
    }

    let normalized = body.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4 !== 0) {
      normalized += "=";
    }

    let binary;
    if (typeof global.atob === "function") {
      binary = global.atob(normalized);
    } else if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(normalized, "base64"));
    } else {
      throw new Error("当前环境不支持 Base64 解码。");
    }
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function bytesToUtf8(bytes) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new Error("解码结果不是有效的 UTF-8 文本；原始内容可能是图片、文件或其他二进制数据。");
    }
  }

  function encodeText(text, options = {}) {
    return bytesToBase64(utf8ToBytes(text), options);
  }

  function decodeText(text, options = {}) {
    return bytesToUtf8(base64ToBytes(text, options));
  }

  const api = {
    STANDARD_ALPHABET,
    URL_SAFE_ALPHABET,
    utf8ToBytes,
    bytesToBase64,
    base64ToBytes,
    bytesToUtf8,
    encodeText,
    decodeText
  };

  global.Base64Lab = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  function initializeInterface() {
    const elements = {
      input: document.getElementById("inputText"),
      output: document.getElementById("outputText"),
      inputLabel: document.getElementById("inputLabel"),
      outputLabel: document.getElementById("outputLabel"),
      inputMeta: document.getElementById("inputMeta"),
      outputMeta: document.getElementById("outputMeta"),
      outputNote: document.getElementById("outputNote"),
      status: document.getElementById("statusMessage"),
      copy: document.getElementById("copyButton"),
      clear: document.getElementById("clearButton"),
      sample: document.getElementById("sampleButton"),
      swap: document.getElementById("swapButton"),
      urlSafe: document.getElementById("urlSafeToggle"),
      padding: document.getElementById("paddingToggle"),
      byteCards: document.getElementById("byteCards"),
      bitStream: document.getElementById("bitStream"),
      bitStreamLabel: document.getElementById("bitStreamLabel"),
      sextetCards: document.getElementById("sextetCards"),
      sampleSource: document.getElementById("sampleSource"),
      sampleHex: document.getElementById("sampleHex"),
      alphabetGrid: document.getElementById("alphabetGrid"),
      specialAlphabet: document.getElementById("specialAlphabet")
    };
    const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
    const state = { mode: "encode", urlSafe: false, padding: true };
    let currentEncodedCharacters = "";

    function codecOptions() {
      return { urlSafe: state.urlSafe, padding: state.padding };
    }

    function setStatus(message, type = "neutral") {
      elements.status.classList.toggle("is-error", type === "error");
      elements.status.replaceChildren();
      const dot = document.createElement("span");
      dot.className = "status-dot";
      const text = document.createElement("span");
      text.textContent = message;
      elements.status.append(dot, text);
    }

    function characterCount(text) {
      return Array.from(text).length;
    }

    function updateModeInterface() {
      const encoding = state.mode === "encode";
      modeButtons.forEach((button) => {
        const active = button.dataset.mode === state.mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      elements.inputLabel.textContent = encoding ? "输入 · UTF-8 文本" : "输入 · Base64";
      elements.outputLabel.textContent = encoding ? "输出 · Base64" : "输出 · UTF-8 文本";
      elements.input.placeholder = encoding ? "在这里输入文字，例如：你好，世界 🌍" : "粘贴 Base64，例如：5L2g5aW977yM5LiW55WMIPCfjI0=";
      elements.output.placeholder = encoding ? "Base64 结果会实时出现在这里" : "解码后的文字会实时出现在这里";
      elements.outputNote.textContent = encoding ? "UTF-8 SAFE · REAL-TIME" : "STRICT UTF-8 · LOCAL DECODE";
      elements.sample.querySelector("span").textContent = "↗";
    }

    function updateSwitch(button, enabled) {
      button.classList.toggle("is-on", enabled);
      button.setAttribute("aria-checked", String(enabled));
    }

    function renderBitLab(bytes, hasCurrentInput) {
      const sourceBytes = bytes.length ? Array.from(bytes.slice(0, 3)) : [72, 105, 33];
      const sample = Uint8Array.from(sourceBytes);
      const binary = sourceBytes.map((byte) => byte.toString(2).padStart(8, "0")).join("");
      const encoded = bytesToBase64(sample, { urlSafe: state.urlSafe, padding: true });
      const significantGroups = Math.ceil(binary.length / 6);

      elements.sampleSource.textContent = hasCurrentInput && bytes.length
        ? `当前输入 · 前 ${sourceBytes.length} 个字节`
        : "默认示例 · Hi!";
      elements.sampleHex.textContent = sourceBytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ").toUpperCase();
      elements.bitStreamLabel.textContent = `${binary.length} BITS`;

      elements.byteCards.replaceChildren();
      sourceBytes.forEach((byte, index) => {
        const card = document.createElement("div");
        card.className = "byte-card";
        card.innerHTML = `<span class="byte-index">BYTE 0${index + 1}</span><strong>0x${byte.toString(16).padStart(2, "0").toUpperCase()}</strong><span class="byte-decimal">DEC ${byte}</span><span class="byte-bits">${byte.toString(2).padStart(8, "0")}</span>`;
        elements.byteCards.append(card);
      });

      elements.bitStream.replaceChildren();
      Array.from(binary).forEach((bit, index) => {
        const cell = document.createElement("span");
        cell.className = `bit group-${Math.floor(index / 6)}`;
        cell.textContent = bit;
        elements.bitStream.append(cell);
      });

      elements.sextetCards.replaceChildren();
      for (let index = 0; index < 4; index += 1) {
        const card = document.createElement("div");
        const isPadding = index >= significantGroups;
        card.className = `sextet-card${isPadding ? " is-padding" : ""}`;
        if (isPadding) {
          card.innerHTML = `<span class="sextet-index">GROUP 0${index + 1} · PADDING</span><span class="sextet-bits">------</span><strong>=</strong><span class="sextet-value">补齐长度</span>`;
        } else {
          const bits = binary.slice(index * 6, index * 6 + 6).padEnd(6, "0");
          const value = Number.parseInt(bits, 2);
          card.innerHTML = `<span class="sextet-index">GROUP 0${index + 1}</span><span class="sextet-bits">${bits}</span><strong>${encoded[index]}</strong><span class="sextet-value">INDEX ${value}</span>`;
        }
        elements.sextetCards.append(card);
      }
    }

    function renderAlphabet() {
      const alphabet = state.urlSafe ? URL_SAFE_ALPHABET : STANDARD_ALPHABET;
      elements.specialAlphabet.textContent = state.urlSafe ? "- _" : "+ /";
      elements.alphabetGrid.replaceChildren();
      Array.from(alphabet).forEach((character, index) => {
        const cell = document.createElement("div");
        cell.className = `alphabet-cell group-${index < 26 ? 0 : index < 52 ? 1 : index < 62 ? 2 : 3}${currentEncodedCharacters.includes(character) ? " is-used" : ""}`;
        cell.setAttribute("aria-label", `索引 ${index}，字符 ${character}`);
        const number = document.createElement("span");
        number.textContent = String(index).padStart(2, "0");
        const letter = document.createElement("strong");
        letter.textContent = character;
        cell.append(number, letter);
        elements.alphabetGrid.append(cell);
      });
    }

    function convert() {
      const input = elements.input.value;
      let visualBytes = new Uint8Array(0);
      let hasValidInput = false;
      currentEncodedCharacters = "";

      if (!input) {
        elements.output.value = "";
        elements.inputMeta.textContent = state.mode === "encode" ? "0 字符 · 0 bytes" : "0 Base64 chars";
        elements.outputMeta.textContent = "等待输入";
        setStatus("等待输入");
      } else {
        try {
          if (state.mode === "encode") {
            visualBytes = utf8ToBytes(input);
            const result = bytesToBase64(visualBytes, codecOptions());
            elements.output.value = result;
            currentEncodedCharacters = result;
            elements.inputMeta.textContent = `${characterCount(input)} 字符 · ${visualBytes.length} bytes`;
            elements.outputMeta.textContent = `${result.length} Base64 chars`;
            setStatus(`编码完成 · ${visualBytes.length} bytes → ${result.length} chars`);
          } else {
            visualBytes = base64ToBytes(input, codecOptions());
            const result = bytesToUtf8(visualBytes);
            elements.output.value = result;
            currentEncodedCharacters = input.replace(/[\t\n\f\r ]/g, "");
            elements.inputMeta.textContent = `${input.replace(/[\t\n\f\r ]/g, "").length} Base64 chars`;
            elements.outputMeta.textContent = `${characterCount(result)} 字符 · ${visualBytes.length} bytes`;
            setStatus(`解码完成 · 已恢复 ${visualBytes.length} bytes`);
          }
          hasValidInput = true;
        } catch (error) {
          elements.output.value = "";
          elements.outputMeta.textContent = "等待有效输入";
          elements.inputMeta.textContent = state.mode === "encode"
            ? `${characterCount(input)} 字符 · ${utf8ToBytes(input).length} bytes`
            : `${input.replace(/[\t\n\f\r ]/g, "").length} Base64 chars`;
          setStatus(error.message || "转换失败，请检查输入。", "error");
        }
      }

      const hasOutput = Boolean(elements.output.value);
      elements.copy.disabled = !hasOutput;
      elements.swap.disabled = !hasOutput;
      renderBitLab(visualBytes, hasValidInput);
      renderAlphabet();
    }

    modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        updateModeInterface();
        convert();
      });
    });

    elements.input.addEventListener("input", convert);

    elements.urlSafe.addEventListener("click", () => {
      state.urlSafe = !state.urlSafe;
      updateSwitch(elements.urlSafe, state.urlSafe);
      convert();
    });

    elements.padding.addEventListener("click", () => {
      state.padding = !state.padding;
      updateSwitch(elements.padding, state.padding);
      convert();
    });

    elements.clear.addEventListener("click", () => {
      elements.input.value = "";
      convert();
      elements.input.focus();
    });

    elements.sample.addEventListener("click", () => {
      elements.input.value = state.mode === "encode"
        ? "你好，Base64！🌍"
        : encodeText("你好，Base64！🌍", codecOptions());
      convert();
      elements.input.focus();
    });

    elements.swap.addEventListener("click", () => {
      if (!elements.output.value) return;
      elements.input.value = elements.output.value;
      state.mode = state.mode === "encode" ? "decode" : "encode";
      updateModeInterface();
      convert();
      elements.input.focus();
    });

    elements.copy.addEventListener("click", async () => {
      if (!elements.output.value) return;
      const label = elements.copy.querySelector("span");
      try {
        if (navigator.clipboard && global.isSecureContext) {
          await navigator.clipboard.writeText(elements.output.value);
        } else {
          elements.output.focus();
          elements.output.select();
          const copied = document.execCommand("copy");
          if (!copied) throw new Error("copy failed");
        }
        label.textContent = "已复制";
        setStatus("结果已复制到剪贴板");
        global.setTimeout(() => { label.textContent = "复制结果"; }, 1600);
      } catch (error) {
        setStatus("无法自动复制，请在结果框中手动复制。", "error");
      }
    });

    updateModeInterface();
    updateSwitch(elements.urlSafe, state.urlSafe);
    updateSwitch(elements.padding, state.padding);
    convert();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeInterface, { once: true });
    } else {
      initializeInterface();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
