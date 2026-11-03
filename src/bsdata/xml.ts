/**
 * Minimal XML → BSData-JSON converter.
 *
 * BattleScribe XML files (.gst / .cat) are converted into the same object
 * shape that BSData publishes as JSON (e.g. wh40k-11e), so the engine only has
 * to understand one format. Written without DOMParser so it also runs in Node
 * (tests, scripts) and in any WebView.
 */

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export function parseXml(src: string): XmlNode {
  let i = 0;
  const root: XmlNode = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  const attrRe = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) stack[stack.length - 1].text += decode(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      i = src.indexOf('-->', lt) + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt);
      stack[stack.length - 1].text += src.slice(lt + 9, end);
      i = end + 3;
      continue;
    }
    if (src.startsWith('<?', lt) || src.startsWith('<!', lt)) {
      i = src.indexOf('>', lt) + 1;
      continue;
    }
    const gt = src.indexOf('>', lt);
    const raw = src.slice(lt + 1, gt);
    i = gt + 1;
    if (raw[0] === '/') {
      stack.pop();
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const m = /^([\w:.-]+)/.exec(body);
    const node: XmlNode = { tag: m ? m[1] : body, attrs: {}, children: [], text: '' };
    attrRe.lastIndex = 0;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(body))) node.attrs[a[1]] = decode(a[3] ?? a[4] ?? '');
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

const NUMERIC_ATTRS = new Set([
  'value',
  'repeats',
  'revision',
  'battleScribeVersion',
  'defaultCostLimit',
  'sortIndex',
  'page',
  'gameSystemRevision',
]);

function coerce(name: string, v: string): string | number | boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (NUMERIC_ATTRS.has(name) && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

function convert(node: XmlNode): unknown {
  const hasAttrs = Object.keys(node.attrs).length > 0;
  const text = node.text.trim();
  if (!hasAttrs && node.children.length === 0) {
    // Text-only element (description, comment, readme...) or empty container.
    return text;
  }
  if (!hasAttrs && node.children.length > 0 && !text) {
    // Container element such as <selectionEntries>: becomes an array.
    return node.children.map(convert);
  }
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.attrs)) obj[k] = coerce(k, v);
  for (const child of node.children) {
    const converted = convert(child);
    if (converted === '' && child.children.length === 0) {
      // <costs/> style empty container → skip; an empty description is also fine to skip
      continue;
    }
    obj[child.tag] = converted;
  }
  if (text) obj.$text = text;
  return obj;
}

/** Convert a .gst / .cat XML string to `{ gameSystem: {...} }` or `{ catalogue: {...} }`. */
export function xmlToBsJson(src: string): Record<string, unknown> {
  const root = parseXml(src);
  const top = root.children.find((c) => c.tag === 'gameSystem' || c.tag === 'catalogue');
  if (!top) throw new Error('Not a BattleScribe game system or catalogue file');
  const obj = convert(top) as Record<string, unknown>;
  obj.type = top.tag;
  return { [top.tag]: obj };
}
