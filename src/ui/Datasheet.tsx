import type { UnitSheet, WeaponProfile } from '../roster/summary';
import { Rich } from './common';

function WeaponTable({ weapons, kind }: { weapons: WeaponProfile[]; kind: 'ranged' | 'melee' }) {
  const list = weapons.filter((w) => w.kind === kind);
  if (!list.length) return null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{kind === 'ranged' ? 'Ranged weapons' : 'Melee weapons'}</th>
            <th>Range</th>
            <th>A</th>
            <th>{kind === 'ranged' ? 'BS' : 'WS'}</th>
            <th>S</th>
            <th>AP</th>
            <th>D</th>
          </tr>
        </thead>
        <tbody>
          {list.map((w) => (
            <tr key={w.name}>
              <td>
                {w.count > 1 && <span className="muted">{w.count}× </span>}
                {w.name}
                {!!w.keywords.length && <span className="kw">[{w.keywords.join(', ')}]</span>}
              </td>
              <td>{w.range}</td>
              <td>{w.attacks}</td>
              <td>{w.skill}</td>
              <td>{w.strength}</td>
              <td>{w.ap}</td>
              <td>{w.damage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Datasheet({ sheet, compact }: { sheet: UnitSheet; compact?: boolean }) {
  return (
    <div className="sheet">
      {!!sheet.stats.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>M</th>
                <th>T</th>
                <th>Sv</th>
                <th>W</th>
                <th>Ld</th>
                <th>OC</th>
                <th>Inv</th>
              </tr>
            </thead>
            <tbody>
              {sheet.stats.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.M}</td>
                  <td>{s.T}</td>
                  <td>{s.Sv}</td>
                  <td>{s.W}</td>
                  <td>{s.Ld}</td>
                  <td>{s.OC}</td>
                  <td>{s.InSv || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WeaponTable weapons={sheet.weapons} kind="ranged" />
      <WeaponTable weapons={sheet.weapons} kind="melee" />
      {!!sheet.upgrades.length && (
        <p className="small">
          <b>Upgrades:</b> {sheet.upgrades.join(', ')}
        </p>
      )}
      {sheet.abilities.map((a) => (
        <details key={a.name} open={!compact}>
          <summary>
            <b>{a.name}</b>
          </summary>
          <div className="rule-text">
            <Rich text={a.text} />
          </div>
        </details>
      ))}
      {!!sheet.rules.length && (
        <details>
          <summary className="small">
            <b>Rules:</b> {sheet.rules.map((r) => r.name).join(', ')}
          </summary>
          {sheet.rules.map((r) => (
            <div key={r.name} style={{ marginBottom: 8 }}>
              <b className="small">{r.name}</b>
              <div className="rule-text muted">
                <Rich text={r.text} />
              </div>
            </div>
          ))}
        </details>
      )}
      {sheet.otherProfiles.map((p, i) => (
        <p key={i} className="small">
          <b>
            {p.type}: {p.name}
          </b>{' '}
          {Object.entries(p.values)
            .map(([k, v]) => (k === 'Description' ? v : `${k} ${v}`))
            .join(' · ')}
        </p>
      ))}
      {!!(sheet.keywords.length || sheet.factionKeywords.length) && (
        <p className="tiny muted">
          <b>Keywords:</b> {sheet.keywords.join(', ')}
          {!!sheet.factionKeywords.length && (
            <>
              {' '}
              · <b>Faction:</b> {sheet.factionKeywords.join(', ')}
            </>
          )}
        </p>
      )}
    </div>
  );
}
