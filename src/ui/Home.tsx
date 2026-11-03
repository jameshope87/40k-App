import { deleteGame, deleteRoster, gamesStore, rostersStore, saveRoster, useStore } from '../store';
import { navigate } from '../router';
import { timeAgo } from './common';
import { vp } from '../play/game';
import type { Roster } from '../roster/model';
import { uid } from '../roster/model';

function importRosterFile(file: File) {
  file.text().then((t) => {
    try {
      const r = JSON.parse(t) as Roster;
      if (!r.forces || !r.catalogueFile) throw new Error('Not a roster file');
      saveRoster({ ...r, uid: uid(), name: `${r.name} (imported)` });
    } catch (e) {
      alert(`Could not import: ${String(e)}`);
    }
  });
}

export default function Home() {
  const rosters = useStore(rostersStore);
  const games = useStore(gamesStore);
  return (
    <>
      <div className="topbar">
        <img src="./icon.svg" width={28} height={28} alt="" />
        <div className="title">Muster &amp; Battle</div>
        <button className="small" onClick={() => navigate('/data')}>
          Data sources
        </button>
      </div>
      <div className="page">
        <div className="grid2">
          <section>
            <div className="spread">
              <h2>Army lists</h2>
              <div className="row">
                <label className="btn small">
                  Import
                  <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importRosterFile(e.target.files[0])} />
                </label>
                <button className="primary" onClick={() => navigate('/new')}>
                  + New list
                </button>
              </div>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {!rosters.length && (
                <p className="muted" style={{ padding: 14, margin: 0 }}>
                  No army lists yet. Create one from any faction in the BSData catalogues.
                </p>
              )}
              {rosters.map((r) => (
                <div key={r.uid} className="list-item" onClick={() => navigate(`/roster/${r.uid}`)}>
                  <div className="grow">
                    <div className="ellipsis">
                      <b>{r.name}</b>
                    </div>
                    <div className="small muted ellipsis">
                      {r.catalogueName} · edited {timeAgo(r.updatedAt)}
                    </div>
                  </div>
                  <button
                    className="small ghost danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${r.name}"?`)) deleteRoster(r.uid);
                    }}
                    aria-label="Delete list"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="spread">
              <h2>Games</h2>
              <button className="primary" onClick={() => navigate('/play')}>
                ▶ Play a game
              </button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {!games.length && (
                <p className="muted" style={{ padding: 14, margin: 0 }}>
                  Start a game to be walked through each phase step by step, with rules reminders, dice rolls and an attack calculator.
                </p>
              )}
              {games.map((g) => (
                <div key={g.uid} className="list-item" onClick={() => navigate(`/play/${g.uid}`)}>
                  <div className="grow">
                    <div className="ellipsis">
                      <b>{g.name}</b>
                    </div>
                    <div className="small muted">
                      {g.stage === 'ended' ? 'Finished' : g.stage === 'prebattle' ? 'Pre-battle' : `Round ${g.round}`} · {vp(g.players[0])}–{vp(g.players[1])} VP · {timeAgo(g.updatedAt)}
                    </div>
                  </div>
                  <button
                    className="small ghost danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete game "${g.name}"?`)) deleteGame(g.uid);
                    }}
                    aria-label="Delete game"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
        <p className="banner" style={{ marginTop: 24 }}>
          Unofficial fan-made tool. Army data comes from the community-maintained{' '}
          <a href="https://github.com/BSData" target="_blank" rel="noreferrer">
            BSData
          </a>{' '}
          catalogues. Warhammer 40,000 is a trademark of Games Workshop. This app is not affiliated with or endorsed by Games Workshop.
        </p>
      </div>
    </>
  );
}
