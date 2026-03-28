export default function ProfileSetupModal({
  profileNameInput,
  setProfileNameInput,
  completeProfileSetup,
  deviceCode
}) {
  return (
    <div className="modal-overlay" onClick={e => e.stopPropagation()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Welcome</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 0 }}>
          Enter your name for this device. A unique device code is generated automatically.
        </p>
        <input
          className="modal-input"
          placeholder="Your Name"
          value={profileNameInput}
          onChange={e => setProfileNameInput(e.target.value)}
        />
        {!!profileNameInput && <button className="text-clear-btn inline-clear-btn" onClick={() => setProfileNameInput('')}>Clear</button>}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Device Code: {deviceCode}
        </p>
        <div className="modal-actions">
          <button className="btn-save" onClick={completeProfileSetup}>Continue</button>
        </div>
      </div>
    </div>
  );
}
