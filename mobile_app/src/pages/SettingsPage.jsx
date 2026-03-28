import { FaArrowLeft, FaDownload, FaShareAlt, FaTrash } from 'react-icons/fa';

export default function SettingsPage({
  closeSettingsPage,
  userName,
  setUserName,
  deviceCode,
  roomCode,
  setRoomCode,
  copiedLink,
  handleShareLink,
  presentRoutingMode,
  setPresentRoutingMode,
  nativeOfflineServer,
  offlineTvUrlSimple,
  autoDetectingLan,
  serverHost,
  setServerHost,
  serverPort,
  setServerPort,
  useLanApi,
  setUseLanApi,
  apiBase,
  WS_URL,
  detectedLanHost,
  offlineTvUrl,
  checkOfflineServer,
  offlineServerStatus,
  pendingSyncQueue,
  syncState,
  runPendingSync,
  downloadAllSongsForOffline,
  offlineDownloadState,
  storageState,
  nativeFileStorageEnabled,
  OFFLINE_STORAGE_FOLDER,
  storageUsageSummary,
  formatBytes,
  localSnapshotSavedAt,
  NATIVE_FILE_STORAGE_ENABLED_IN_BUILD,
  clearLocalSearchCache
}) {
  return (
    <div className="app-container">
      <div className="app-header presentation-header">
        <button className="back-btn" onClick={closeSettingsPage}>
          <FaArrowLeft />
        </button>
        <h1 style={{ flex: 1, textAlign: 'left', fontSize: '1.1rem', margin: 0 }}>Settings</h1>
      </div>

      <div className="content-area">
        <div className="stanza-card">
          <h3 style={{ margin: 0 }}>Presenter Identity</h3>
          <input
            className="modal-input"
            placeholder="Your Name"
            value={userName}
            onChange={e => setUserName(e.target.value)}
          />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Device: {deviceCode}</div>
        </div>

        <div className="stanza-card">
          <h3 style={{ margin: 0 }}>TV Room</h3>
          <div className="room-control settings-room-control">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Room Code:</label>
            <input type="text" className="room-input" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} />
            <button className={`share-btn ${copiedLink ? 'copied' : ''}`} onClick={handleShareLink} title="Copy TV Link">
              <FaShareAlt /> {copiedLink ? '✓' : ''}
            </button>
          </div>
        </div>

        <div className="stanza-card">
          <h3 style={{ margin: 0 }}>Offline Present</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 8 }}>
            Open TV/browser on same hotspot or Wi-Fi network.
          </p>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 8 }}>
            Cast Route
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn-save ${presentRoutingMode === 'mirror' ? 'active' : ''}`}
              onClick={() => setPresentRoutingMode('mirror')}
              style={{ marginTop: 0 }}
            >
              Mirror (Online + Offline)
            </button>
            <button
              className={`btn-save ${presentRoutingMode === 'offline' ? 'active' : ''}`}
              onClick={() => setPresentRoutingMode('offline')}
              style={{ marginTop: 0 }}
            >
              Offline Only
            </button>
            <button
              className={`btn-save ${presentRoutingMode === 'online' ? 'active' : ''}`}
              onClick={() => setPresentRoutingMode('online')}
              style={{ marginTop: 0 }}
            >
              Online Only
            </button>
          </div>
          {presentRoutingMode === 'offline' && !nativeOfflineServer.running && (
            <div style={{ color: '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
              Offline only is selected. Start offline presenter to cast locally.
            </div>
          )}
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
            Simple link: {offlineTvUrlSimple || 'Auto-detecting...'}
          </div>
          {autoDetectingLan && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 6 }}>
              Auto-detecting local server...
            </div>
          )}
        </div>

        <div className="stanza-card">
          <h3 style={{ margin: 0 }}>LAN / Hotspot Server</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 8 }}>
            Use server device IP so browser and mobile can connect on the same Wi-Fi or hotspot.
          </p>
          <input
            className="modal-input"
            placeholder="Server IP (e.g., 192.168.1.35)"
            value={serverHost}
            onChange={e => setServerHost(e.target.value)}
          />
          <input
            className="modal-input"
            placeholder="Port (default 3000)"
            value={serverPort}
            onChange={e => setServerPort(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={useLanApi}
              onChange={e => setUseLanApi(e.target.checked)}
            />
            Use LAN host for online API calls
          </label>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
            API: {apiBase}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            WebSocket: {WS_URL}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Offline LAN IP: {detectedLanHost || 'Not set'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4, wordBreak: 'break-all' }}>
            Offline TV URL: {offlineTvUrl || 'Set LAN Server IP to generate link'}
          </div>
          <button
            className="btn-save"
            style={{ marginTop: 10 }}
            onClick={checkOfflineServer}
            disabled={offlineServerStatus.checking}
          >
            {offlineServerStatus.checking ? 'Checking...' : 'Check Offline Server'}
          </button>
          {offlineServerStatus.message && (
            <div style={{ color: offlineServerStatus.ok ? '#29a36a' : '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
              {offlineServerStatus.message}
            </div>
          )}
        </div>

        <div className="stanza-card">
          <h3 style={{ margin: 0 }}>Offline Sync</h3>
          <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Pending items: {pendingSyncQueue.length}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Status: {syncState.syncing ? 'Syncing...' : 'Idle'}
          </div>
          {syncState.lastRun && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              Last run: {new Date(syncState.lastRun).toLocaleString()}
            </div>
          )}
          {syncState.lastError && (
            <div style={{ color: '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
              Last error: {syncState.lastError}
            </div>
          )}
          <button
            className="btn-save"
            style={{ marginTop: 10 }}
            onClick={runPendingSync}
            disabled={syncState.syncing || pendingSyncQueue.length === 0}
          >
            {syncState.syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            className="btn-save"
            style={{ marginTop: 10 }}
            onClick={downloadAllSongsForOffline}
            disabled={offlineDownloadState.downloading}
          >
            <FaDownload style={{ marginRight: 6 }} />
            {offlineDownloadState.downloading ? `Downloading... ${offlineDownloadState.downloaded}` : 'Download All Songs Offline'}
          </button>
          {offlineDownloadState.lastError && (
            <div style={{ color: '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
              Download error: {offlineDownloadState.lastError}
            </div>
          )}
        </div>

        <div className="stanza-card">
          <h3 style={{ margin: 0 }}>Device File Storage</h3>
          <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Permission: {storageState.permission}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Enabled: {nativeFileStorageEnabled ? 'Yes' : 'No'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Loaded: {storageState.loaded ? 'Yes' : 'No'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Folder: {OFFLINE_STORAGE_FOLDER} ({storageState.directory})
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Cached songs: {storageUsageSummary.offlineSongCount}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Pending sync: {storageUsageSummary.pendingCount}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Cache size est.: {formatBytes(storageUsageSummary.offlineBytes)} + {formatBytes(storageUsageSummary.queueBytes)} = {formatBytes(storageUsageSummary.totalBytes)}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
            Large data target: {storageUsageSummary.target}
          </div>
          {localSnapshotSavedAt && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              Local data saved: {new Date(localSnapshotSavedAt).toLocaleString()}
            </div>
          )}
          {storageState.lastSavedAt && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              Last saved: {new Date(storageState.lastSavedAt).toLocaleString()}
            </div>
          )}
          {storageState.lastError && (
            <div style={{ color: '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
              Storage error: {storageState.lastError}
            </div>
          )}
          {!NATIVE_FILE_STORAGE_ENABLED_IN_BUILD && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 6 }}>
              Native file storage is disabled in this build for crash safety.
            </div>
          )}
        </div>

        <div className="stanza-card">
          <h3 style={{ margin: 0 }}>Storage</h3>
          <button className="clear-btn" onClick={clearLocalSearchCache}>
            <FaTrash style={{ marginRight: 8 }} /> Clear Saved Search Text
          </button>
        </div>
      </div>
    </div>
  );
}
