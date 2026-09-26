const TYPES = ['Bug', 'Enhancement', 'Task', 'Feature'];
const KNOWN = new Set(TYPES);

const rawType = (bug) => {
  const value = bug && (bug.bugType || bug.bug_type);
  if (value == null) return '';
  return String(value).trim();
};

const emptySplit = () => ({ Bug: 0, Enhancement: 0, Task: 0, Feature: 0 });

const computeQualityTax = (bugs) => {
  const split = emptySplit();
  let untypedCount = 0;

  for (const bug of bugs || []) {
    const type = rawType(bug);
    if (!KNOWN.has(type)) {
      untypedCount += 1;
      continue;
    }
    split[type] += 1;
  }

  const typedCount = TYPES.reduce((sum, type) => sum + split[type], 0);
  const total = typedCount + untypedCount;

  if (typedCount === 0) {
    return {
      percent: null,
      sentence: null,
      split,
      typedCount: 0,
      untypedCount,
      total,
      degraded: {
        metric: 'qualityTax',
        reason: total === 0 ? 'no typed work on this board' : 'bugType not available'
      }
    };
  }

  const percent = Math.round((100 * split.Bug) / typedCount);
  return {
    percent,
    sentence: `This board is ${percent}% firefighting.`,
    split,
    typedCount,
    untypedCount,
    total,
    degraded: null
  };
};

module.exports = { TYPES, computeQualityTax };
