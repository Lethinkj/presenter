import { useState, useEffect } from 'react';
import { FaArrowLeft, FaDownload, FaShareAlt, FaTrash, FaChevronRight,
         FaUser, FaTv, FaWifi, FaDatabase, FaHdd } from 'react-icons/fa';
import { Capacitor } from '@capacitor/core';

const SECTIONS = [
  {
    key: 'presenter',
    icon: <FaUser />,
    title: 'Presenter',
    sub: 'Name, device & TV room',
  },
  {
    key: 'network',
    icon: <FaWifi />,
    title: 'Network & Casting',
    sub: 'Cast route, LAN / hotspot server',
  },
  {
    key: 'sync',
    icon: <FaDatabase />,
    title: 'Offline & Sync',
    sub: 'Sync songs, download for offline',
  },
  {
    key: 'storage',
    icon: <FaHdd />,
    title: 'Storage',
    sub: 'Local database, clear cache',
  },
];

export default function SettingsPage({
  closeSettingsPage,
  registerSettingsBackHandler,
  userName, setUserName,
  deviceCode,
  roomCode, setRoomCode,
  copiedLink, handleShareLink,
  presentRoutingMode, setPresentRoutingMode,
  nativeOfflineServer,
  offlineTvUrlSimple,
  autoDetectingLan,
  serverHost, setServerHost,
  serverPort, setServerPort,
  useLanApi, setUseLanApi,
  apiBase, WS_URL,
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
  storageUsageSummary,
  formatBytes,
  syncProgress,
  clearLocalSearchCache,
}) {
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    registerSettingsBackHandler?.(() => {
      if (activeSection) { setActiveSection(null); return true; }
      return false;
    });
  }, [activeSection, registerSettingsBackHandler]);

  const section = SECTIONS.find(s => s.key === activeSection);

  return (
    <div className="app-container has-header">
      <div className="app-header presentation-header">
        <button className="back-btn" onClick={activeSection ? () => setActiveSection(null) : closeSettingsPage}>
          <FaArrowLeft />
        </button>
        <h1 style={{ flex: 1, textAlign: 'left', fontSize: '1.1rem', margin: 0 }}>
          {section ? section.title : 'Settings'}
        </h1>
      </div>

      <div className="content-area">
        {!activeSection ? (
          <div className="settings-nav-list">
            {SECTIONS.map(s => (
              <button key={s.key} className="settings-nav-item" onClick={() => setActiveSection(s.key)}>
                <span className="settings-nav-icon">{s.icon}</span>
                <span className="settings-nav-text">
                  <span className="settings-nav-title">{s.title}</span>
                  <span className="settings-nav-sub">{s.sub}</span>
                </span>
                <FaChevronRight className="settings-nav-chevron" />
              </button>
            ))}
          </div>
        ) : activeSection === 'presenter' ? (
          <PresenterSection
            userName={userName} setUserName={setUserName}
            deviceCode={deviceCode}
            roomCode={roomCode} setRoomCode={setRoomCode}
            copiedLink={copiedLink} handleShareLink={handleShareLink}
          />
        ) : activeSection === 'network' ? (
          <NetworkSection
            presentRoutingMode={presentRoutingMode} setPresentRoutingMode={setPresentRoutingMode}
            nativeOfflineServer={nativeOfflineServer}
            offlineTvUrlSimple={offlineTvUrlSimple}
            autoDetectingLan={autoDetectingLan}
            serverHost={serverHost} setServerHost={setServerHost}
            serverPort={serverPort} setServerPort={setServerPort}
            useLanApi={useLanApi} setUseLanApi={setUseLanApi}
            apiBase={apiBase} WS_URL={WS_URL}
            detectedLanHost={detectedLanHost}
            offlineTvUrl={offlineTvUrl}
            checkOfflineServer={checkOfflineServer}
            offlineServerStatus={offlineServerStatus}
          />
        ) : activeSection === 'sync' ? (
          <SyncSection
            syncState={syncState}
            syncProgress={syncProgress}
            runPendingSync={runPendingSync}
            downloadAllSongsForOffline={downloadAllSongsForOffline}
            offlineDownloadState={offlineDownloadState}
            pendingSyncQueue={pendingSyncQueue}
          />
        ) : activeSection === 'storage' ? (
          <StorageSection
            storageState={storageState}
            storageUsageSummary={storageUsageSummary}
            formatBytes={formatBytes}
            syncState={syncState}
            pendingSyncQueue={pendingSyncQueue}
            clearLocalSearchCache={clearLocalSearchCache}
          />
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      {value !== undefined && <span className="settings-row-value">{value}</span>}
    </div>
  );
}

function PresenterSection({ userName, setUserName, deviceCode, roomCode, setRoomCode, copiedLink, handleShareLink }) {
  return (
    <div className="settings-section">
      <p className="settings-section-hint">Your display name and the TV room others join to follow your presentation.</p>

      <div className="settings-group">
        <div className="settings-group-label">Identity</div>
        <div className="settings-group-body">
          <input
            className="settings-input"
            placeholder="Your Name"
            value={userName}
            onChange={e => setUserName(e.target.value)}
          />
          <Row label="Device Code" value={deviceCode} />
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-label">TV Room</div>
        <div className="settings-group-body">
          <div className="settings-room-row">
            <input
              type="text"
              className="settings-input"
              placeholder="Room Code"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24))}
            />
            <button className={`settings-share-btn ${copiedLink ? 'copied' : ''}`} onClick={handleShareLink}>
              <FaShareAlt /> {copiedLink ? '✓ Copied' : 'Share Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkSection({
  presentRoutingMode, setPresentRoutingMode, nativeOfflineServer,
  offlineTvUrlSimple, autoDetectingLan, serverHost, setServerHost,
  serverPort, setServerPort, useLanApi, setUseLanApi,
  apiBase, WS_URL, detectedLanHost, offlineTvUrl,
  checkOfflineServer, offlineServerStatus,
}) {
  return (
    <div className="settings-section">
      <p className="settings-section-hint">Configure how slides are cast to the TV and set up your local network server.</p>

      <div className="settings-group">
        <div className="settings-group-label">Cast Route</div>
        <div className="settings-group-body">
          {[
            { value: 'mirror',  label: 'Mirror', desc: 'Online + Offline' },
            { value: 'offline', label: 'Offline Only', desc: 'LAN / hotspot only' },
            { value: 'online',  label: 'Online Only', desc: 'Internet required' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`settings-option-row ${presentRoutingMode === opt.value ? 'active' : ''}`}
              onClick={() => setPresentRoutingMode(opt.value)}
            >
              <span className="settings-option-dot" />
              <span className="settings-option-text">
                <span>{opt.label}</span>
                <span className="settings-option-desc">{opt.desc}</span>
              </span>
              {presentRoutingMode === opt.value && <span className="settings-option-check">✓</span>}
            </button>
          ))}
          {presentRoutingMode === 'offline' && !nativeOfflineServer?.running && (
            <div className="settings-warn">Offline only selected — start the offline presenter to cast locally.</div>
          )}
          <Row label="Simple link" value={offlineTvUrlSimple || (autoDetectingLan ? 'Detecting…' : '—')} />
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-label">LAN / Hotspot Server</div>
        <div className="settings-group-body">
          <p className="settings-group-hint">Enter the IP of the device running the server so browser and mobile can connect on the same Wi-Fi or hotspot.</p>
          <input
            className="settings-input"
            placeholder="Server IP (e.g. 192.168.1.35)"
            value={serverHost}
            onChange={e => setServerHost(e.target.value)}
          />
          <input
            className="settings-input"
            placeholder="Port (default 8901)"
            value={serverPort}
            onChange={e => setServerPort(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <label className="settings-toggle-row">
            <input type="checkbox" checked={useLanApi} onChange={e => setUseLanApi(e.target.checked)} />
            <span>Use LAN host for online API calls</span>
          </label>
          <Row label="API" value={apiBase} />
          <Row label="WebSocket" value={WS_URL} />
          <Row label="Detected LAN IP" value={detectedLanHost || '—'} />
          <Row label="Offline TV URL" value={offlineTvUrl || 'Set LAN Server IP to generate'} />
          <button className="settings-action-btn" onClick={checkOfflineServer} disabled={offlineServerStatus.checking}>
            <FaTv style={{ marginRight: 7 }} />
            {offlineServerStatus.checking ? 'Checking…' : 'Check Offline Server'}
          </button>
          {offlineServerStatus.message && (
            <div className={offlineServerStatus.ok ? 'settings-ok' : 'settings-error'}>{offlineServerStatus.message}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SyncSection({ syncState, syncProgress, runPendingSync, downloadAllSongsForOffline, offlineDownloadState, pendingSyncQueue }) {
  return (
    <div className="settings-section">
      <p className="settings-section-hint">Sync song changes and download the full library for offline use.</p>

      {!Capacitor.isNativePlatform() ? (
        <div className="settings-info-box">
          Offline sync requires the native mobile app. On web, songs are fetched directly from the server on each search.
        </div>
      ) : (
        <>
          <div className="settings-group">
            <div className="settings-group-label">Sync</div>
            <div className="settings-group-body">
              <Row label="Status" value={syncState.syncing ? 'Syncing…' : 'Idle'} />
              {syncState.lastRun && <Row label="Last sync" value={new Date(syncState.lastRun).toLocaleString()} />}
              {pendingSyncQueue.length > 0 && <Row label="Pending uploads" value={pendingSyncQueue.length} />}
              {syncState.lastError && <div className="settings-error">{syncState.lastError}</div>}
              {syncState.syncing && syncProgress?.message && (
                <div style={{ marginTop: 8 }}>
                  <div className="settings-progress-label">{syncProgress.message}</div>
                  <div className="sync-settings-progress-track">
                    <div
                      className="sync-settings-progress-fill"
                      style={{
                        width: syncProgress.total ? `${Math.min(100, Math.round((syncProgress.downloaded / syncProgress.total) * 100))}%` : '100%',
                        animation: syncProgress.total ? 'none' : 'sync-indeterminate 1.4s ease-in-out infinite',
                      }}
                    />
                  </div>
                  {syncProgress.total > 0 && (
                    <div className="settings-progress-count">{syncProgress.downloaded} / {syncProgress.total}</div>
                  )}
                </div>
              )}
              <button className="settings-action-btn" onClick={runPendingSync} disabled={syncState.syncing}>
                {syncState.syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            </div>
          </div>

          <div className="settings-group">
            <div className="settings-group-label">Download</div>
            <div className="settings-group-body">
              <p className="settings-group-hint">Download all songs to the device so the app works fully without internet.</p>
              <button className="settings-action-btn" onClick={downloadAllSongsForOffline} disabled={offlineDownloadState.downloading}>
                <FaDownload style={{ marginRight: 7 }} />
                {offlineDownloadState.downloading
                  ? (offlineDownloadState.phase === 'saving'
                    ? 'Saving offline data…'
                    : `Downloading… ${offlineDownloadState.downloaded}${offlineDownloadState.total ? ` / ${offlineDownloadState.total}` : ''}`)
                  : 'Download All Songs Offline'}
              </button>
              {offlineDownloadState.downloading && (
                <div className="settings-info-label">
                  {offlineDownloadState.phase === 'saving'
                    ? 'Finalising local cache…'
                    : `Downloaded: ${offlineDownloadState.downloaded}${offlineDownloadState.total ? ` / ${offlineDownloadState.total}` : ''}`}
                </div>
              )}
              {offlineDownloadState.lastError && (
                <div className="settings-error">Download error: {offlineDownloadState.lastError}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StorageSection({ storageState, storageUsageSummary, formatBytes, syncState, pendingSyncQueue, clearLocalSearchCache }) {
  return (
    <div className="settings-section">
      <p className="settings-section-hint">Local storage details and maintenance tools.</p>

      <div className="settings-group">
        <div className="settings-group-label">Local Database</div>
        <div className="settings-group-body">
          <Row label="Songs stored" value={storageUsageSummary.offlineSongCount} />
          <Row label="Directory" value={storageState.directory} />
          <Row label="Used space" value={formatBytes(storageUsageSummary.totalBytes)} />
          <Row label="Ready" value={storageState.loaded ? 'Yes' : 'No'} />
          {syncState.lastRun && <Row label="Last synced" value={new Date(syncState.lastRun).toLocaleString()} />}
          {pendingSyncQueue.length > 0 && <Row label="Pending uploads" value={pendingSyncQueue.length} />}
          {storageState.lastError && <div className="settings-error">{storageState.lastError}</div>}
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-label">Cache</div>
        <div className="settings-group-body">
          <button className="settings-action-btn settings-action-btn--danger" onClick={clearLocalSearchCache}>
            <FaTrash style={{ marginRight: 7 }} /> Clear Saved Search Text
          </button>
        </div>
      </div>
    </div>
  );
}
