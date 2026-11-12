(function attachPasswordLab(global) {
  "use strict";

  const CHARACTER_SETS = Object.freeze({
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~"
  });
  const AMBIGUOUS_CHARACTERS = "Il1O0o";

  function selectedSets(options = {}) {
    const names = Object.keys(CHARACTER_SETS).filter((name) => options[name] !== false);
    return names.map((name) => {
      const characters = options.excludeAmbiguous
        ? Array.from(CHARACTER_SETS[name]).filter((character) => !AMBIGUOUS_CHARACTERS.includes(character)).join("")
        : CHARACTER_SETS[name];
      return characters;
    }).filter(Boolean);
  }

  function characterPool(options = {}) {
    return Array.from(new Set(selectedSets(options).join(""))).join("");
  }

  function secureRandomInt(max, cryptoSource = global.crypto) {
    if (!Number.isSafeInteger(max) || max <= 0 || max > 0x100000000) {
      throw new RangeError("随机数范围必须是 1 到 2^32 之间的整数。");
    }
    if (!cryptoSource || typeof cryptoSource.getRandomValues !== "function") {
      throw new Error("当前浏览器不支持加密安全随机数，请使用最新版浏览器并通过 HTTPS 打开。");
    }
    const range = 0x100000000;
    const limit = Math.floor(range / max) * max;
    const buffer = new Uint32Array(1);
    let value;
    do {
      cryptoSource.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % max;
  }

  function generatePassword(options = {}) {
    const length = options.length ?? 20;
    if (!Number.isInteger(length) || length < 4 || length > 128) {
      throw new RangeError("密码长度必须是 4 到 128 之间的整数。");
    }
    const sets = selectedSets(options);
    if (!sets.length) {
      throw new Error("请至少选择一种字符类型。");
    }
    if (length < sets.length) {
      throw new Error("密码长度不能小于已选择的字符类型数量。");
    }
    const pool = characterPool(options);
    const cryptoSource = options.cryptoSource || global.crypto;

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const password = Array.from({ length }, () => pool[secureRandomInt(pool.length, cryptoSource)]);
      if (sets.every((set) => Array.from(set).some((character) => password.includes(character)))) {
        return password.join("");
      }
    }
    throw new Error("暂时无法生成满足条件的密码，请调整选项后重试。");
  }

  function estimateEntropy(options = {}) {
    const length = options.length ?? 20;
    const poolSize = characterPool(options).length;
    return poolSize ? length * Math.log2(poolSize) : 0;
  }

  const api = {
    CHARACTER_SETS,
    AMBIGUOUS_CHARACTERS,
    selectedSets,
    characterPool,
    secureRandomInt,
    generatePassword,
    estimateEntropy
  };

  global.PasswordLab = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  function initializeInterface() {
    const elements = {
      output: document.getElementById("passwordOutput"),
      length: document.getElementById("lengthRange"),
      lengthValue: document.getElementById("lengthValue"),
      passwordLengthLabel: document.getElementById("passwordLengthLabel"),
      exclude: document.getElementById("excludeAmbiguous"),
      regenerate: document.getElementById("regenerateButton"),
      copy: document.getElementById("copyButton"),
      status: document.getElementById("statusMessage"),
      strengthLabel: document.getElementById("strengthLabel"),
      strengthMeter: document.getElementById("strengthMeter"),
      entropyValue: document.getElementById("entropyValue"),
      poolValue: document.getElementById("poolValue"),
      lengthMirror: document.getElementById("lengthMirror"),
      poolMirror: document.getElementById("poolMirror"),
      entropyMirror: document.getElementById("entropyMirror")
    };
    const setInputs = Array.from(document.querySelectorAll("[data-set]"));

    function currentOptions() {
      const options = {
        length: Number(elements.length.value),
        excludeAmbiguous: elements.exclude.checked
      };
      setInputs.forEach((input) => { options[input.dataset.set] = input.checked; });
      return options;
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

    function updateStrength(entropy) {
      const level = entropy < 60 ? 1 : entropy < 80 ? 2 : entropy < 120 ? 3 : 4;
      const label = ["较弱", "良好", "很强", "极强"][level - 1];
      elements.strengthLabel.textContent = label;
      elements.strengthLabel.style.color = ["#b94d27", "#8a7210", "#557b12", "#3f7010"][level - 1];
      elements.strengthMeter.dataset.level = String(level);
      elements.strengthMeter.setAttribute("aria-valuenow", String(level));
      elements.strengthMeter.setAttribute("aria-valuetext", `${label}，约 ${Math.round(entropy)} bits 熵`);
    }

    function generateAndRender() {
      const options = currentOptions();
      try {
        const password = generatePassword(options);
        const entropy = estimateEntropy(options);
        const poolSize = characterPool(options).length;
        elements.output.value = password;
        elements.lengthValue.value = String(options.length);
        elements.lengthValue.textContent = String(options.length);
        elements.passwordLengthLabel.textContent = `${options.length} CHARACTERS`;
        elements.entropyValue.textContent = `约 ${Math.round(entropy)} bits 熵`;
        elements.poolValue.textContent = `字符池 ${poolSize}`;
        elements.lengthMirror.textContent = String(options.length);
        elements.poolMirror.textContent = String(poolSize);
        elements.entropyMirror.textContent = `≈${Math.round(entropy)}`;
        updateStrength(entropy);
        setStatus("密码已在此设备本地生成");
      } catch (error) {
        elements.output.value = "";
        setStatus(error.message || "无法生成密码，请调整选项。", "error");
      }
    }

    elements.length.addEventListener("input", generateAndRender);
    elements.exclude.addEventListener("change", generateAndRender);
    setInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (!setInputs.some((item) => item.checked)) {
          input.checked = true;
          setStatus("至少需要保留一种字符类型", "error");
          return;
        }
        generateAndRender();
      });
    });
    elements.regenerate.addEventListener("click", generateAndRender);

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
        setStatus("密码已复制；请将它保存到可信的密码管理器");
        global.setTimeout(() => { label.textContent = "复制密码"; }, 1600);
      } catch (error) {
        setStatus("无法自动复制，请在密码框中手动复制。", "error");
      }
    });

    generateAndRender();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeInterface, { once: true });
    } else {
      initializeInterface();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
