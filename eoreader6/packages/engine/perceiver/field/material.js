// eoreader6 · perceiver/field — a sampled n-dimensional field (a DNS velocity
// cube, an MRI volume, a raster stack) reduced to the 1-D material `nul`
// requires.
//
// Contract shared by every perceiver in this directory: load(path) does I/O
// once; reduce(units, {fraction}) is pure and answers "what would the material
// look like having read only this much of the real thing so far."
//
// THE AXIS IS RECEIVED, NEVER DERIVED. This is the whole of the perceiver's
// discipline and it is SEED.md Amendment III applied one modality over. A cube
// has no privileged direction to read it in; picking one is a claim about the
// material that the material does not make. So `axis` and `component` are
// required, and asking for a series without saying along what is a type error
// here rather than a gap later — SEED.md #7, refusal has two tiers.
//
// The same refusal is why there is no "flatten the cube" path. Raveling a 3-D
// field into one long series manufactures a discontinuity at every row end,
// and a statistic over the result would be reading the raster order — the
// perceiver's own scanning convention — as though it were structure in the
// flow. Lines are returned separately and grounded separately.

import fs from "node:fs";

const DTYPES = {
  "<f4": { bytes: 4, read: (v, o) => v.getFloat32(o, true) },
  "<f8": { bytes: 8, read: (v, o) => v.getFloat64(o, true) },
  "<i4": { bytes: 4, read: (v, o) => v.getInt32(o, true) },
  "<i8": { bytes: 8, read: (v, o) => Number(v.getBigInt64(o, true)) },
};

/**
 * NPY is parsed here rather than converted upstream on purpose: a conversion
 * step outside the engine is a place for material to be silently reshaped,
 * rescaled, or truncated with no record, and the provenance of a ground is
 * only as good as the weakest hand the material passed through.
 */
const parseNPY = (buf) => {
  if (buf.subarray(0, 6).toString("latin1") !== "\x93NUMPY")
    throw new Error("not an NPY file — a type error, not a gap: nothing here is field material");
  const major = buf[6];
  const headerLen = major === 1 ? buf.readUInt16LE(8) : buf.readUInt32LE(8);
  const headerStart = major === 1 ? 10 : 12;
  const header = buf.subarray(headerStart, headerStart + headerLen).toString("latin1");

  const descr = /'descr'\s*:\s*'([^']+)'/.exec(header)?.[1];
  const fortran = /'fortran_order'\s*:\s*(True|False)/.exec(header)?.[1] === "True";
  const shape = [...(/'shape'\s*:\s*\(([^)]*)\)/.exec(header)?.[1] ?? "").matchAll(/\d+/g)].map((m) => Number(m[0]));

  const dt = DTYPES[descr];
  if (!dt) throw new Error(`unsupported NPY dtype ${descr} — supported: ${Object.keys(DTYPES).join(", ")}`);
  if (fortran) throw new Error("fortran-order NPY not supported — re-save C-order rather than transposing silently here");

  const dataStart = headerStart + headerLen;
  const view = new DataView(buf.buffer, buf.byteOffset + dataStart, buf.length - dataStart);
  const count = shape.reduce((a, b) => a * b, 1);
  const data = new Float64Array(count);
  for (let i = 0; i < count; i++) data[i] = dt.read(view, i * dt.bytes);
  return { data, shape, dtype: descr };
};

export const load = async (path) => parseNPY(fs.readFileSync(path));

/** C-order strides, so a line along any axis is a fixed stride walk. */
const strides = (shape) => {
  const s = new Array(shape.length).fill(1);
  for (let i = shape.length - 2; i >= 0; i--) s[i] = s[i + 1] * shape[i + 1];
  return s;
};

/**
 * One 1-D line through the field: fix every index but `axis`, walk that one.
 *
 * `at` names the fixed indices for the other axes, in axis order, omitting
 * `axis` itself. Nothing is defaulted — a line nobody located is not a line.
 */
export const line = (field, { axis, at, component }) => {
  const { data, shape } = field;
  const rank = shape.length;
  if (!Number.isInteger(axis) || axis < 0 || axis >= rank)
    throw new Error(`axis must be an integer in [0,${rank - 1}] — the direction to read a field in is received, never derived`);
  const st = strides(shape);
  const idx = new Array(rank).fill(0);
  const others = [...Array(rank).keys()].filter((d) => d !== axis);
  if (!Array.isArray(at) || at.length !== others.length)
    throw new Error(`\`at\` must fix the ${others.length} axes other than ${axis}, in order`);
  others.forEach((d, k) => {
    if (!Number.isInteger(at[k]) || at[k] < 0 || at[k] >= shape[d])
      throw new Error(`at[${k}] = ${at[k]} is outside axis ${d} (extent ${shape[d]})`);
    idx[d] = at[k];
  });
  if (component != null) idx[rank - 1] = component;

  let base = 0;
  for (let d = 0; d < rank; d++) if (d !== axis) base += idx[d] * st[d];
  const out = new Array(shape[axis]);
  for (let i = 0; i < shape[axis]; i++) out[i] = data[base + i * st[axis]];
  return out;
};

/**
 * The shared reduce contract: `fraction` is how much of the line has been read
 * so far, and it truncates the SERIES, never the field. A ground built over a
 * prefix is a ground over a smaller extent, which `pattern` already knows how
 * to refuse comparing to a larger one (`incommensurate_extent`).
 */
export const reduce = (field, { fraction = 1, axis, at, component } = {}) => {
  const full = line(field, { axis, at, component });
  const readLen = Math.max(2, Math.floor(full.length * fraction));
  return full.slice(0, readLen);
};

/**
 * Every line along one axis, as separate material. The plural return is the
 * point: these are independent draws from the same flow, and averaging them
 * into one series before grounding would destroy exactly the variability a
 * null is supposed to be built out of.
 */
export const lines = (field, { axis, component, limit = Infinity }) => {
  const { shape } = field;
  const rank = shape.length;
  const others = [...Array(rank).keys()].filter((d) => d !== axis && !(component != null && d === rank - 1));
  const out = [];
  const walk = (k, at) => {
    if (out.length >= limit) return;
    if (k === others.length) {
      const full = new Array(rank - 1).fill(0);
      let c = 0;
      for (const d of [...Array(rank).keys()].filter((d) => d !== axis)) {
        const j = others.indexOf(d);
        full[c++] = j === -1 ? component : at[j];
      }
      out.push(line(field, { axis, at: full, component }));
      return;
    }
    for (let i = 0; i < shape[others[k]] && out.length < limit; i++) walk(k + 1, [...at, i]);
  };
  walk(0, []);
  return out;
};
