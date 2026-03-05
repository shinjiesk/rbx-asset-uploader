const { invoke } = window.__TAURI__.core;

// --- State ---
let currentScreen = "main";
let profiles = [];
let fileEntries = [];
let projectPath = null;
let currentAudio = null;

// --- Store helpers ---
async function loadStore() {
  try {
    const Store = window.__TAURI__.store;
    return await Store.load("settings.json", { autoSave: true });
  } catch (e) {
    console.error("Failed to load store:", e);
    return null;
  }
}

// --- Screen Navigation ---
function showScreen(name) {
  document.getElementById("settings-screen").classList.toggle("hidden", name !== "settings");
  document.getElementById("main-screen").classList.toggle("hidden", name !== "main");
  currentScreen = name;
}

// --- Settings: API Key ---
async function initApiKey() {
  try {
    const key = await invoke("load_api_key");
    const input = document.getElementById("api-key-input");
    if (key) {
      input.value = key;
      showApiKeyStatus("API key loaded from keychain", "success");
    }
  } catch (e) {
    showApiKeyStatus("Failed to load API key: " + e, "error");
  }
}

function showApiKeyStatus(msg, type) {
  const el = document.getElementById("api-key-status");
  el.textContent = msg;
  el.className = "status-msg " + (type || "");
}

document.getElementById("api-key-save").addEventListener("click", async () => {
  const key = document.getElementById("api-key-input").value.trim();
  if (!key) {
    showApiKeyStatus("Please enter an API key", "error");
    return;
  }
  try {
    await invoke("save_api_key", { key });
    showApiKeyStatus("API key saved to keychain", "success");
  } catch (e) {
    showApiKeyStatus("Failed to save: " + e, "error");
  }
});

document.getElementById("api-key-delete").addEventListener("click", async () => {
  try {
    await invoke("delete_api_key");
    document.getElementById("api-key-input").value = "";
    showApiKeyStatus("API key deleted", "success");
  } catch (e) {
    showApiKeyStatus("Failed to delete: " + e, "error");
  }
});

document.getElementById("api-key-toggle").addEventListener("click", () => {
  const input = document.getElementById("api-key-input");
  input.type = input.type === "password" ? "text" : "password";
});

// --- Settings: Creator Profiles ---
async function loadProfiles() {
  const store = await loadStore();
  if (!store) return;
  profiles = (await store.get("profiles")) || [];
  renderProfiles();
  renderProfileSelect();
}

async function saveProfiles() {
  const store = await loadStore();
  if (!store) return;
  await store.set("profiles", profiles);
}

function renderProfiles() {
  const list = document.getElementById("profiles-list");
  if (profiles.length === 0) {
    list.innerHTML = '<p class="help-text">No profiles yet.</p>';
    return;
  }
  list.innerHTML = profiles
    .map(
      (p, i) => `
    <div class="profile-item">
      <div class="profile-item-info">
        <span class="profile-item-name">${escapeHtml(p.name)}</span>
        <span class="profile-item-detail">${p.creator_type === "group" ? "Group" : "User"} ID: ${escapeHtml(p.creator_id)}</span>
      </div>
      <button class="btn btn-ghost" onclick="removeProfile(${i})">Remove</button>
    </div>
  `
    )
    .join("");
}

function renderProfileSelect() {
  const select = document.getElementById("profile-select");
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select Profile --</option>';
  profiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.creator_type === "group" ? "Group" : "User"}: ${p.creator_id})`;
    select.appendChild(opt);
  });
  if (currentVal) select.value = currentVal;
}

document.getElementById("profile-add").addEventListener("click", async () => {
  const name = document.getElementById("profile-name").value.trim();
  const type = document.getElementById("profile-type").value;
  const creatorId = document.getElementById("profile-creator-id").value.trim();
  if (!name || !creatorId) return;

  profiles.push({
    id: crypto.randomUUID(),
    name,
    creator_type: type,
    creator_id: creatorId,
  });
  await saveProfiles();
  renderProfiles();
  renderProfileSelect();
  document.getElementById("profile-name").value = "";
  document.getElementById("profile-creator-id").value = "";
});

window.removeProfile = async function (index) {
  profiles.splice(index, 1);
  await saveProfiles();
  renderProfiles();
  renderProfileSelect();
};

// --- Settings: Studio Path ---
async function loadStudioPath() {
  const store = await loadStore();
  if (!store) return;
  const path = await store.get("studioInstancePath");
  if (path) {
    document.getElementById("studio-instance-path").value = path;
  }
}

document.getElementById("studio-instance-path").addEventListener("change", async (e) => {
  const store = await loadStore();
  if (store) {
    await store.set("studioInstancePath", e.target.value);
  }
});

// --- Navigation ---
document.getElementById("settings-btn").addEventListener("click", () => showScreen("settings"));
document.getElementById("settings-back-btn").addEventListener("click", () => showScreen("main"));

// --- Project Folder ---
document.getElementById("project-folder-btn").addEventListener("click", async () => {
  try {
    const Dialog = window.__TAURI__.dialog;
    const selected = await Dialog.open({ directory: true, title: "Select Project Folder" });
    if (selected) {
      projectPath = selected;
      document.getElementById("project-path-display").textContent = projectPath;
    }
  } catch (e) {
    console.error("Failed to open folder dialog:", e);
  }
});

// --- Drag & Drop ---
const dropZone = document.getElementById("drop-zone");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");

  const paths = [];
  if (e.dataTransfer.files) {
    for (const file of e.dataTransfer.files) {
      if (file.path) paths.push(file.path);
    }
  }
  if (paths.length > 0) {
    await scanAndPreview(paths);
  }
});

document.getElementById("select-files-btn").addEventListener("click", async () => {
  try {
    const Dialog = window.__TAURI__.dialog;
    const selected = await Dialog.open({
      multiple: true,
      title: "Select Asset Files",
      filters: [
        {
          name: "Roblox Assets",
          extensions: ["png", "jpeg", "jpg", "mp3", "ogg", "flac", "wav", "fbx"],
        },
      ],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      await scanAndPreview(paths);
    }
  } catch (e) {
    console.error("Failed to open file dialog:", e);
  }
});

document.getElementById("select-folder-btn").addEventListener("click", async () => {
  try {
    const Dialog = window.__TAURI__.dialog;
    const selected = await Dialog.open({ directory: true, title: "Select Asset Folder" });
    if (selected) {
      await scanAndPreview([selected]);
    }
  } catch (e) {
    console.error("Failed to open folder dialog:", e);
  }
});

// --- File Scanning & Preview ---
async function scanAndPreview(paths) {
  try {
    const lockFilePath = projectPath ? projectPath + "/assets.lock.toml" : null;
    const entries = await invoke("scan_files", { paths, lockFilePath });
    fileEntries = entries.map((e) => ({ ...e, excluded: false }));
    renderFileList();
    document.getElementById("drop-zone").classList.add("hidden");
    document.getElementById("file-list-section").classList.remove("hidden");
    document.getElementById("upload-results").classList.add("hidden");
  } catch (e) {
    console.error("Scan failed:", e);
  }
}

function renderFileList() {
  const list = document.getElementById("file-list");
  document.getElementById("file-count").textContent = fileEntries.filter((f) => !f.excluded).length;

  list.innerHTML = fileEntries
    .map((f, i) => {
      const isImage = f.category === "Image";
      const isAudio = f.category === "Audio";
      const typeBadge = `<span class="file-item-badge badge-${f.category.toLowerCase()}">${f.category}</span>`;
      const updateBadge = f.existing_asset_id
        ? '<span class="file-item-badge badge-update">Update</span>'
        : '<span class="file-item-badge badge-new">New</span>';

      const thumb = isImage
        ? `<div class="file-item-thumb"><img src="asset://localhost/${encodeURIComponent(f.path)}" alt="" onerror="this.parentElement.textContent='IMG'" /></div>`
        : `<div class="file-item-thumb">${isAudio ? "♪" : "◇"}</div>`;

      const audioBtn = isAudio
        ? `<button class="audio-play-btn" onclick="toggleAudio('${escapeHtml(f.path)}', this)">▶</button>`
        : "";

      const statusHtml = getStatusHtml(f.status);

      return `
        <div class="file-item ${f.excluded ? "excluded" : ""}" data-index="${i}">
          <div class="file-item-checkbox">
            <input type="checkbox" ${f.excluded ? "" : "checked"} onchange="toggleExclude(${i}, this)" />
          </div>
          ${thumb}
          <div class="file-item-info">
            <div class="file-item-name">${escapeHtml(f.filename)}</div>
            <div class="file-item-meta">
              <span>${formatSize(f.size)}</span>
              ${typeBadge}
              ${updateBadge}
            </div>
          </div>
          ${audioBtn}
          ${statusHtml}
        </div>
      `;
    })
    .join("");

  updateUploadButton();
}

function getStatusHtml(status) {
  if (!status || status === "Pending") return '<div class="file-item-status status-pending">Ready</div>';
  if (status === "Uploading") return '<div class="file-item-status status-uploading">Uploading...</div>';
  if (status === "Processing") return '<div class="file-item-status status-uploading">Processing...</div>';
  if (status.Success) return `<div class="file-item-status status-success">ID: ${status.Success.asset_id}</div>`;
  if (status.Failed) return `<div class="file-item-status status-failed" title="${escapeHtml(status.Failed.error)}">Failed</div>`;
  return "";
}

window.toggleExclude = function (index, checkbox) {
  fileEntries[index].excluded = !checkbox.checked;
  document.getElementById("file-count").textContent = fileEntries.filter((f) => !f.excluded).length;
  updateUploadButton();
};

window.toggleAudio = function (path, btn) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    btn.textContent = "▶";
    return;
  }
  try {
    currentAudio = new Audio("asset://localhost/" + encodeURIComponent(path));
    currentAudio.play();
    btn.textContent = "⏸";
    currentAudio.onended = () => {
      currentAudio = null;
      btn.textContent = "▶";
    };
  } catch (e) {
    console.error("Audio playback failed:", e);
  }
};

function updateUploadButton() {
  const activeFiles = fileEntries.filter((f) => !f.excluded);
  const btn = document.getElementById("upload-btn");
  btn.disabled = activeFiles.length === 0 || !document.getElementById("profile-select").value;
  btn.textContent = `Upload (${activeFiles.length})`;
}

document.getElementById("profile-select").addEventListener("change", updateUploadButton);

document.getElementById("clear-files-btn").addEventListener("click", () => {
  fileEntries = [];
  document.getElementById("file-list-section").classList.add("hidden");
  document.getElementById("drop-zone").classList.remove("hidden");
  document.getElementById("upload-results").classList.add("hidden");
});

// --- Upload ---
document.getElementById("upload-btn").addEventListener("click", startUpload);

async function startUpload() {
  const profileId = document.getElementById("profile-select").value;
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return;

  const apiKey = await invoke("load_api_key");
  if (!apiKey) {
    alert("No API key set. Please configure in Settings.");
    showScreen("settings");
    return;
  }

  if (!projectPath) {
    alert("Please select a project folder first.");
    return;
  }

  const activeEntries = fileEntries.filter((f) => !f.excluded);
  if (activeEntries.length === 0) return;

  document.getElementById("upload-btn").disabled = true;
  document.getElementById("clear-files-btn").disabled = true;

  try {
    const result = await invoke("upload_files", {
      entries: activeEntries,
      apiKey,
      creatorType: profile.creator_type,
      creatorId: profile.creator_id,
      projectPath,
    });

    for (let i = 0; i < result.length; i++) {
      const originalIdx = fileEntries.findIndex(
        (f) => f.path === activeEntries[i].path
      );
      if (originalIdx >= 0) {
        fileEntries[originalIdx].status = result[i].status;
        if (result[i].status.Success) {
          fileEntries[originalIdx].existing_asset_id = result[i].status.Success.asset_id;
        }
      }
    }

    renderFileList();
    await pushToStudio();
  } catch (e) {
    console.error("Upload failed:", e);
  } finally {
    document.getElementById("upload-btn").disabled = false;
    document.getElementById("clear-files-btn").disabled = false;
  }
}

// --- Studio Push ---
async function pushToStudio() {
  const sessionId = document.getElementById("studio-session-select").value;
  if (!sessionId || !projectPath) return;

  const store = await loadStore();
  const instancePath = store ? (await store.get("studioInstancePath")) || "ReplicatedStorage.Assets" : "ReplicatedStorage.Assets";

  try {
    const luaSource = await invoke("generate_assets_lua", {
      projectPath,
      outputPath: null,
    });
    await invoke("push_to_studio", {
      sessionId,
      instancePath,
      source: luaSource,
    });
  } catch (e) {
    console.error("Failed to push to Studio:", e);
  }
}

// --- Studio Session Polling ---
async function pollStudioSessions() {
  try {
    const sessions = await invoke("get_studio_sessions");
    const select = document.getElementById("studio-session-select");
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- No Studio Connected --</option>';
    sessions.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.session_id;
      opt.textContent = s.place_name
        ? `${s.place_name} (${s.place_id || "?"})`
        : `Studio Session (${s.session_id.slice(0, 8)})`;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  } catch (e) {
    // silent
  }
}

// --- Utilities ---
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Init ---
async function init() {
  await loadProfiles();
  await loadStudioPath();

  const hasKey = await invoke("has_api_key");
  if (!hasKey || profiles.length === 0) {
    showScreen("settings");
    await initApiKey();
  }

  setInterval(pollStudioSessions, 3000);
}

init();
