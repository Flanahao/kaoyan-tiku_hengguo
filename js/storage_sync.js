/**
 * 考研题库 · 本地文件直连与实时自动同步引擎 (File System Access API)
 * 支持：
 * 1. 关联本地硬盘 JSON 文件 (如 data/kaoyan_data.json)
 * 2. 做题、打标、笔记、图片标注时后台自动静默防抖落盘
 * 3. 刷新/重新打开页面时自动从本地文件还原进度
 * 4. 离线备份导出与一键恢复兜底
 */

(function () {
  'use strict';

  const DB_NAME = 'KaoyanTikuStorageDB';
  const STORE_NAME = 'file_handles';
  const HANDLE_KEY = 'local_progress_file';

  // 状态变量
  let currentFileHandle = null;
  let syncStatus = 'unlinked'; // 'unlinked' | 'linked' | 'prompt' | 'saving' | 'error'
  let lastSavedTime = null;
  let saveDebounceTimer = null;
  let isApplyingData = false; // 防止导入/加载数据时触发反向保存

  // ===== 1. IndexedDB 存储文件句柄 =====
  function openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSaveHandle(handle) {
    try {
      const db = await openIDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[StorageSync] 保存句柄到 IDB 失败', e);
    }
  }

  async function idbGetHandle() {
    try {
      const db = await openIDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[StorageSync] 从 IDB 读取句柄失败', e);
      return null;
    }
  }

  async function idbRemoveHandle() {
    try {
      const db = await openIDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {}
  }

  // ===== 2. 权限校验 =====
  async function verifyPermission(handle, readWrite = true) {
    if (!handle) return false;
    const opts = { mode: readWrite ? 'readwrite' : 'read' };
    try {
      if ((await handle.queryPermission(opts)) === 'granted') {
        return true;
      }
      if ((await handle.requestPermission(opts)) === 'granted') {
        return true;
      }
    } catch (e) {
      console.warn('[StorageSync] 请求文件权限异常', e);
    }
    return false;
  }

  // ===== 3. 全量数据采集与应用（纯净 V3 SSOT） =====
  // 采集所有与题库相关的 localStorage 数据与内存标注
  function collectAllData() {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      // 纯净 SSOT 采集：采集 kaoyan.*、annot_* 以及英语数据
      if (
        /^kaoyan\.(?:q|g|ui)\./.test(k) ||
        /^annot_/.test(k) ||
        /^ky_english_/.test(k)
      ) {
        dump[k] = localStorage.getItem(k);
      }
    }

    // 确保 kaoyan.g.* 核心全局键与 UI 偏好在采集时处于最新状态并统一格式
    if (typeof window !== 'undefined' && window.StorageEngine) {
      if (window.StorageEngine.GlobalStore) {
        ['topics', 'affinity', 'study_log', 'theme', 'dark_img_filter', 'filters', 'resume', 'subject', 'sub_mode', 'english_mode', 'cognitive_state', 'mindmap_sync_blocks'].forEach(name => {
          const val = window.StorageEngine.GlobalStore.get(name);
          if (val !== null && val !== undefined) {
            dump['kaoyan.g.' + name] = JSON.stringify(val);
          }
        });
      }
      if (window.StorageEngine.UiStore) {
        ['math', '822', 'english'].forEach(sid => {
          const val = window.StorageEngine.UiStore.get(sid);
          if (val !== null && val !== undefined) {
            dump['kaoyan.ui.' + sid] = JSON.stringify(val);
          }
        });
      }
    }

    return {
      version: 3,
      appName: '考研题库 (Math + 822 + English)',
      storageEngine: 'StorageEngine-SSOT',
      lastSaved: new Date().toISOString(),
      timestamp: Date.now(),
      data: dump
    };
  }

  // 还原数据并通知各模块刷新
  function applyAllData(payload) {
    if (!payload || !payload.data) return false;
    isApplyingData = true;
    try {
      const dump = payload.data;

      for (const k in dump) {
        if (Object.prototype.hasOwnProperty.call(dump, k)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
          if (dump[k] !== null && dump[k] !== undefined) {
            try {
              localStorage.setItem(k, dump[k]);
            } catch (e) {}
          }
        }
      }

      triggerAppRefresh();

      return true;
    } finally {
      setTimeout(() => {
        isApplyingData = false;
      }, 500);
    }
  }

  // 通知主程序重新载入数据
  function triggerAppRefresh() {
    // 重新载入数学 / 822 状态
    if (typeof window.loadStatuses === 'function') window.loadStatuses();
    if (typeof window.loadQBad === 'function') window.loadQBad();
    if (typeof window.loadSBad === 'function') window.loadSBad();
    if (typeof window.loadNotes === 'function') window.loadNotes();
    if (typeof window.loadAnnotations === 'function') window.loadAnnotations();
    if (typeof window.loadSm2 === 'function') window.loadSm2();
    if (typeof window.loadGlobalFilters === 'function') window.loadGlobalFilters();
    if (typeof window.loadSolutionPref === 'function') window.loadSolutionPref();
    if (typeof window.renderStats === 'function') window.renderStats();
    if (typeof window.renderNav === 'function') window.renderNav();
    if (typeof window.renderNotes === 'function') window.renderNotes();
    if (typeof window.switchTo === 'function' && typeof window.current !== 'undefined') {
      window.switchTo(window.current);
    } else if (typeof window.switchTo === 'function') {
      window.switchTo(0);
    }
    if (typeof window.updateFilterCounts === 'function') window.updateFilterCounts();
    if (typeof window.renderSm2InfoBar === 'function') window.renderSm2InfoBar();
    if (typeof window.renderCountdown === 'function') window.renderCountdown();
    if (typeof window.loadRelatedTopics === 'function') window.loadRelatedTopics();
    if (typeof window.renderRelatedQuestions === 'function') window.renderRelatedQuestions();
    if (window.CognitiveViewController && typeof window.CognitiveViewController.onStorageRefresh === 'function') {
      window.CognitiveViewController.onStorageRefresh();
    }
    if (typeof window.applyTheme === 'function') {
      const curT = (window.StorageEngine && window.StorageEngine.GlobalStore && window.StorageEngine.GlobalStore.get('theme')) || 'light';
      window.applyTheme(curT);
    }
    if (typeof window.renderDashboardOverview === 'function' && window.dashboardOpen) {
      window.renderDashboardOverview();
    }

    // 重新载入英语状态
    if (window.englishApp && typeof window.englishApp.activate === 'function') {
      window.englishApp.activate();
    }
  }

  // ===== 4. 文件写入与读取 =====
  async function writeToFile(data) {
    if (!currentFileHandle) return false;
    try {
      updateUI('saving');
      const writable = await currentFileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      lastSavedTime = new Date();
      updateUI('linked');
      return true;
    } catch (e) {
      console.warn('[StorageSync] 写入文件失败', e);
      updateUI('prompt');
      return false;
    }
  }

  async function readFromFile(handle) {
    if (!handle) return null;
    try {
      const file = await handle.getFile();
      const text = await file.text();
      if (!text || text.trim() === '') return null;
      return JSON.parse(text);
    } catch (e) {
      console.warn('[StorageSync] 读取文件失败', e);
      return null;
    }
  }

  // ===== 5. 自动同步调度器 (防抖与即时落盘) =====
  async function flushSave() {
    if (isApplyingData || !currentFileHandle) return;
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    const data = collectAllData();
    return await writeToFile(data);
  }

  function scheduleSave() {
    if (isApplyingData) return; // 正在应用导入数据时不反向写
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(async () => {
      saveDebounceTimer = null;
      if (!currentFileHandle) return;
      const data = collectAllData();
      await writeToFile(data);
    }, 800);
  }

  // ===== 6. 用户交互：选择/关联本地文件 =====
  async function linkLocalFile() {
    if (!('showOpenFilePicker' in window)) {
      showToast('当前浏览器不支持文件直连 API，请使用 Edge 或 Chrome 浏览器。已为您提供手动导出/导入功能。', 'warning');
      return;
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: '考研题库数据文件 (*.json)',
            accept: { 'application/json': ['.json'] }
          }
        ],
        multiple: false
      });

      if (!handle) return;

      const hasPerm = await verifyPermission(handle, true);
      if (!hasPerm) {
        showToast('未获得文件读写权限，关联取消', 'error');
        return;
      }

      currentFileHandle = handle;
      await idbSaveHandle(handle);

      // 读取文件并合并
      const existingData = await readFromFile(handle);
      if (existingData && existingData.data && Object.keys(existingData.data).length > 0) {
        applyAllData(existingData);
        showToast(`已成功关联文件「${handle.name}」并同步最新数据！`, 'success');
      } else {
        // 文件为空或新文件，把当前页面的数据立即初始化写入
        const initialData = collectAllData();
        await writeToFile(initialData);
        showToast(`已成功关联文件「${handle.name}」，已保存当前学习进度！`, 'success');
      }

      updateUI('linked');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[StorageSync] 关联文件失败', err);
        showToast('关联文件失败: ' + err.message, 'error');
      }
    }
  }

  // 创建并关联新文件
  async function createAndLinkNewFile() {
    if (!('showSaveFilePicker' in window)) {
      exportManualJson();
      return;
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'kaoyan_tiku_data.json',
        types: [
          {
            description: '考研题库数据文件 (*.json)',
            accept: { 'application/json': ['.json'] }
          }
        ]
      });

      if (!handle) return;

      const hasPerm = await verifyPermission(handle, true);
      if (!hasPerm) return;

      currentFileHandle = handle;
      await idbSaveHandle(handle);

      const initialData = collectAllData();
      await writeToFile(initialData);

      showToast(`已创建并关联数据文件「${handle.name}」！`, 'success');
      updateUI('linked');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[StorageSync] 创建文件失败', err);
      }
    }
  }

  // 解除关联
  async function unlinkLocalFile() {
    currentFileHandle = null;
    await idbRemoveHandle();
    updateUI('unlinked');
    showToast('已断开本地文件关联（本地数据已保留在浏览器中）', 'info');
  }

  // 手动导出 JSON 备份
  function exportManualJson() {
    try {
      const data = collectAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `考研题库_备份_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已导出备份 JSON 文件', 'success');
    } catch (e) {
      showToast('导出备份失败: ' + e.message, 'error');
    }
  }

  // 手动从文件选择器恢复 JSON
  function importManualJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (applyAllData(payload)) {
          showToast(`已成功从「${file.name}」恢复数据！`, 'success');
          scheduleSave(); // 若已关联文件，同步写入
        } else {
          showToast('文件格式不正确，恢复失败', 'error');
        }
      } catch (err) {
        showToast('解析备份文件失败: ' + err.message, 'error');
      }
    };
    input.click();
  }

  // ===== 6.5 双向手动控制（明确清晰处理本地文件与浏览器 Storage） =====
  // 按钮 1：将本地 JSON 数据写入浏览器（覆盖浏览器 Storage 并刷新视图）
  async function syncLocalToBrowser() {
    try {
      let fileData = null;
      let fileName = 'kaoyan_tiku_data.json';

      // 1. 若已有句柄，尝试从句柄读取
      if (currentFileHandle) {
        const hasPerm = await verifyPermission(currentFileHandle, false);
        if (hasPerm) {
          fileData = await readFromFile(currentFileHandle);
          fileName = currentFileHandle.name;
        }
      }

      // 2. 若无句柄或权限受阻，调出文件选择器选取本地 kaoyan_tiku_data.json
      if (!fileData) {
        if ('showOpenFilePicker' in window) {
          const [handle] = await window.showOpenFilePicker({
            types: [
              {
                description: '考研题库数据文件 (kaoyan_tiku_data.json)',
                accept: { 'application/json': ['.json'] }
              }
            ],
            multiple: false
          });
          if (!handle) return;
          currentFileHandle = handle;
          await idbSaveHandle(handle);
          fileData = await readFromFile(handle);
          fileName = handle.name;
          updateUI('linked');
        } else {
          // 降级使用普通文件选择框
          importManualJson();
          return;
        }
      }

      if (fileData && fileData.data && Object.keys(fileData.data).length > 0) {
        applyAllData(fileData);
        const count = Object.keys(fileData.data).length;
        showToast(`已成功将本地「${fileName}」数据全量写入浏览器（共 ${count} 项）！`, 'success');
      } else {
        showToast('未能从本地文件中解析出有效的题库数据', 'warning');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[StorageSync] 本地写入浏览器失败', err);
        showToast('本地写入浏览器失败: ' + err.message, 'error');
      }
    }
  }

  // 按钮 2：将浏览器当前数据直接写入本地文件（覆盖本地 kaoyan_tiku_data.json 文件）
  async function syncBrowserToLocal() {
    try {
      const data = collectAllData();
      const qCount = Object.keys(data.data || {}).filter(k => k.startsWith('kaoyan.q.')).length;
      if (qCount === 0) {
        if (typeof window.showConfirmModal === 'function') {
          const confirmed = await window.showConfirmModal({
            title: '覆盖警告',
            message: '警告：检测到浏览器当前没有题目学习进度数据（0 题）。继续写入将清空覆盖本地文件中的全部题目！是否确定覆盖？',
            danger: true,
            confirmText: '确定覆盖',
            cancelText: '取消'
          });
          if (!confirmed) return;
        }
      }
      // 1. 若已有句柄，尝试直接写入
      if (currentFileHandle) {
        const hasPerm = await verifyPermission(currentFileHandle, true);
        if (hasPerm) {
          const ok = await writeToFile(data);
          if (ok) {
            showToast(`已成功将浏览器全部学习进度写入「${currentFileHandle.name}」！`, 'success');
            return;
          }
        }
      }

      // 2. 若无句柄或权限失败，调出保存文件选择器
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'kaoyan_tiku_data.json',
          types: [
            {
              description: '考研题库数据文件 (*.json)',
              accept: { 'application/json': ['.json'] }
            }
          ]
        });
        if (!handle) return;
        currentFileHandle = handle;
        await idbSaveHandle(handle);
        const data = collectAllData();
        await writeToFile(data);
        showToast(`已成功将浏览器进度写入「${handle.name}」！`, 'success');
        updateUI('linked');
      } else {
        // 降级导出并下载
        exportManualJson();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[StorageSync] 浏览器写入本地失败', err);
        showToast('浏览器写入本地失败: ' + err.message, 'error');
      }
    }
  }

  // ===== 7. UI 与状态更新 =====
  function updateUI(status) {
    syncStatus = status;
    const dot = document.getElementById('syncStatusDot');
    const text = document.getElementById('syncStatusText');
    const fileNameEl = document.getElementById('syncFileName');
    const btnLink = document.getElementById('btnLinkLocalFile');

    if (status === 'linked') {
      if (dot) dot.className = 'sync-dot dot-online';
      if (text) text.textContent = '本地文件已连接';
      if (fileNameEl) fileNameEl.textContent = currentFileHandle ? currentFileHandle.name : 'kaoyan_tiku_data.json';
      if (btnLink) btnLink.textContent = '重新关联本地文件';
    } else if (status === 'saving') {
      if (dot) dot.className = 'sync-dot dot-saving';
      if (text) text.textContent = '正在写入本地...';
    } else if (status === 'prompt') {
      if (dot) dot.className = 'sync-dot dot-prompt';
      if (text) text.textContent = '待激活文件权限';
      if (fileNameEl) fileNameEl.textContent = currentFileHandle ? currentFileHandle.name : 'kaoyan_tiku_data.json';
      if (btnLink) btnLink.textContent = '激活读写权限';
    } else {
      if (dot) dot.className = 'sync-dot dot-offline';
      if (text) text.textContent = '本地未连接';
      if (fileNameEl) fileNameEl.textContent = 'kaoyan_tiku_data.json';
      if (btnLink) btnLink.textContent = '关联本地文件';
    }
  }

  // 简易轻提示 (Toast)
  function showToast(message, type = 'info') {
    let toast = document.getElementById('storageSyncToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'storageSyncToast';
      toast.className = 'sync-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `sync-toast show toast-${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // 点击激活权限
  async function activatePermission() {
    if (!currentFileHandle) {
      linkLocalFile();
      return;
    }
    const hasPerm = await verifyPermission(currentFileHandle, true);
    if (hasPerm) {
      updateUI('linked');
      const fileData = await readFromFile(currentFileHandle);
      if (fileData) applyAllData(fileData);
      showToast('已激活本地文件读写权限！', 'success');
    } else {
      showToast('激活权限未通过，请重新关联', 'warning');
    }
  }

  // ===== 8. 初始化与自启动恢复 =====
  async function init() {
    // 绑定保留按钮 1：关联本地文件
    const btnLink = document.getElementById('btnLinkLocalFile');
    if (btnLink) {
      btnLink.onclick = () => {
        if (syncStatus === 'prompt') activatePermission();
        else linkLocalFile();
      };
    }

    // 绑定双向写入按钮事件
    const btnSyncLocalToBrowser = document.getElementById('btnSyncLocalToBrowser');
    if (btnSyncLocalToBrowser) btnSyncLocalToBrowser.onclick = syncLocalToBrowser;

    const btnSyncBrowserToLocal = document.getElementById('btnSyncBrowserToLocal');
    if (btnSyncBrowserToLocal) btnSyncBrowserToLocal.onclick = syncBrowserToLocal;

    // 绑定保留按钮 2 & 3：导入与导出
    const btnImp = document.getElementById('btnSyncImport');
    if (btnImp) btnImp.onclick = importManualJson;

    const btnExp = document.getElementById('btnSyncExport');
    if (btnExp) btnExp.onclick = exportManualJson;

    // 检查 IDB 是否有上次记忆的文件句柄
    const savedHandle = await idbGetHandle();
    if (savedHandle) {
      currentFileHandle = savedHandle;
      try {
        const perm = await savedHandle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          updateUI('linked');
          const fileData = await readFromFile(savedHandle);
          if (fileData) applyAllData(fileData);
        } else {
          updateUI('prompt');
        }
      } catch (e) {
        updateUI('prompt');
      }
    } else {
      updateUI('unlinked');
    }
  }

  // 暴露全局 API
  window.storageSync = {
    init,
    scheduleSave,
    flushSave,
    syncLocalToBrowser,
    syncBrowserToLocal,
    linkLocalFile,
    createAndLinkNewFile,
    unlinkLocalFile,
    exportManualJson,
    importManualJson,
    collectAllData,
    applyAllData,
    showToast,
    get status() {
      return syncStatus;
    },
    get isLinked() {
      return syncStatus === 'linked' || syncStatus === 'saving';
    }
  };

  // 页面关闭或切换后台时，立即刷盘未完成的防抖写任务
  window.addEventListener('beforeunload', () => {
    if (saveDebounceTimer && currentFileHandle) {
      flushSave();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && saveDebounceTimer && currentFileHandle) {
      flushSave();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
})();
