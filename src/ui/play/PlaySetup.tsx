import { useState } from 'react';
import { rostersStore, saveGame, useStore } from '../../store';
import { navigate, queryParam } from '../../router';
import { getIndex } from '../../useCatalogue';
import { Evaluator } from '../../bsdata/engine';
import { describeUnit } from '../../roster/summary';
import { makeUnitState, newGame, newPlayer, type PlayerState } from '../../play/game';
import { KNOWN_SOURCES } from '../../bsdata/loader';
import type { Roster } from '../../roster/model';
import { ErrorBox, Loading } from '../common';
import { DISCLAIMER, RULES_EDITION } from '../../play/rules';

async function buildPlayer(name: string, roster: Roster | undefined, onProgress: (m: string) => void): Promise<PlayerState> {
  const p = newPlayer(name);
  if (!roster) return p;
  const source = KNOWN_SOURCES.find((s) => s.repo === roster.source.repo && s.branch === roster.source.branch) ?? { ...roster.source, label: roster.source.repo };
  const index = await getIndex(source, roster.catalogueFile, onProgress);
  const ev = new Evaluator(index, roster);
  p.rosterUid = roster.uid;
  p.armyName = roster.name;
  p.faction = roster.catalogueName;
  for (const r of ev.roots) {
    if (r.node.type !== 'unit' && r.node.type !== 'model') continue;
    p.units.push(makeUnitState(describeUnit(ev, r)));
  }
  return p;
}

export default function PlaySetup() {
  const rosters = useStore(rostersStore);
  const preselect = queryParam('roster') ?? '';
  const [names, setNames] = useState(['Player 1', 'Player 2']);
  const [lists, setLists] = useState<string[]>([preselect, '']);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const start = async () => {
    setError('');
    try {
      const players = await Promise.all(
        [0, 1].map((i) =>
          buildPlayer(
            names[i] || `Player ${i + 1}`,
            rosters.find((r) => r.uid === lists[i]),
            setBusy,
          ),
        ),
      );
      const g = newGame(players[0], players[1]);
      saveGame(g);
      navigate(`/play/${g.uid}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setBusy('');
    }
  };

  return (
    <>
      <div className="topbar">
        <button className="icon ghost" onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div className="title">New game</div>
      </div>
      <div className="page stack">
        <div className="grid2">
          {[0, 1].map((i) => (
            <div key={i} className="card">
              <h3>Player {i + 1}</h3>
              <label className="field">
                <span>Name</span>
                <input value={names[i]} onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))} />
              </label>
              <label className="field">
                <span>Army list</span>
                <select value={lists[i]} onChange={(e) => setLists(lists.map((l, k) => (k === i ? e.target.value : l)))}>
                  <option value="">No list (track score and dice only)</option>
                  {rosters.map((r) => (
                    <option key={r.uid} value={r.uid}>
                      {r.name} — {r.catalogueName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
        <p className="small muted">
          Tip: add your opponent’s list too. The attack helper then fills in their Toughness, saves and wounds automatically and tracks casualties.
        </p>
        {busy && <Loading text={busy} />}
        {error && <ErrorBox error={error} />}
        <button className="primary" onClick={start} disabled={!!busy} style={{ width: '100%' }}>
          Start game
        </button>
        <p className="banner">
          Rules reminders follow the {RULES_EDITION} turn structure. {DISCLAIMER}
        </p>
      </div>
    </>
  );
}
