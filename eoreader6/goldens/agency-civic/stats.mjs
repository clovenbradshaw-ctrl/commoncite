// eoreader6 · goldens/agency-civic/stats — small, dependency-free
// statistics helpers for the agency-in-civic-text golden's analysis. This
// repo carries no npm dependencies anywhere; these are declared and
// verifiable in ~120 lines rather than pulled in from an unaudited package.

export const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

export const pearson = (xs, ys) => {
  const n = xs.length;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
};

// Solve a 3x3 linear system via Gaussian elimination with partial pivoting.
const solve3 = (A, b) => {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) continue; // singular direction — leave coefficient at 0
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [0, 1, 2].map((i) => (Math.abs(M[i][i]) < 1e-12 ? 0 : M[i][3] / M[i][i]));
};

/** OLS residuals of y ~ 1 + x1 + x2, via the normal equations (X'X beta = X'y). */
export const residualsOf = (y, x1, x2) => {
  const n = y.length;
  const X = Array.from({ length: n }, (_, i) => [1, x1[i], x2[i]]);
  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const Xty = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < 3; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const beta = solve3(XtX, Xty);
  return y.map((yi, i) => yi - (beta[0] + beta[1] * x1[i] + beta[2] * x2[i]));
};

/** Partial correlation of x and y controlling for z1, z2 — residualize both on the controls, then correlate the residuals. */
export const partialCorrelation = (x, y, z1, z2) => pearson(residualsOf(x, z1, z2), residualsOf(y, z1, z2));

/** Fleiss' kappa for N items x n raters x k categories, given a matrix `counts[i][categoryIndex] = number of raters who chose it`. */
export const fleissKappa = (counts, n) => {
  const N = counts.length;
  const k = counts[0].length;
  const Pi = counts.map((row) => {
    const sumSq = row.reduce((s, nij) => s + nij * (nij - 1), 0);
    return sumSq / (n * (n - 1));
  });
  const Pbar = mean(Pi);
  const pj = Array.from({ length: k }, (_, j) => counts.reduce((s, row) => s + row[j], 0) / (N * n));
  const PeBar = pj.reduce((s, p) => s + p * p, 0);
  return PeBar === 1 ? 1 : (Pbar - PeBar) / (1 - PeBar);
};

/** Plain pairwise percent agreement across all rater pairs, per item, averaged. */
export const percentAgreement = (verdictMatrix) => {
  // verdictMatrix: array of arrays, one row per item, one column per rater.
  let agree = 0, total = 0;
  for (const row of verdictMatrix) {
    for (let i = 0; i < row.length; i++) {
      for (let j = i + 1; j < row.length; j++) {
        total++;
        if (row[i] === row[j]) agree++;
      }
    }
  }
  return total === 0 ? 0 : agree / total;
};

/** 2x2 chi-square test (no continuity correction — cell counts here are large enough not to need one; Fisher's exact would be the stricter choice for any cell < 5). */
export const chiSquare2x2 = (a, b, c, d) => {
  const n = a + b + c + d;
  const expected = (row, col) => ((row === 0 ? a + b : c + d) * (col === 0 ? a + c : b + d)) / n;
  const cells = [[a, b], [c, d]];
  let chi2 = 0;
  for (let r = 0; r < 2; r++) for (let col = 0; col < 2; col++) {
    const e = expected(r, col);
    if (e > 0) chi2 += (cells[r][col] - e) ** 2 / e;
  }
  return chi2; // df=1; chi2 > 3.841 -> p<0.05, > 6.635 -> p<0.01, > 10.828 -> p<0.001
};

export const phiCoefficient = (a, b, c, d) => {
  const denom = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  return denom === 0 ? 0 : (a * d - b * c) / denom;
};
