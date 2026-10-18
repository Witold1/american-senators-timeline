/**
 * When two people overlap on one line, decide who shares the row and who gets a second lane.
 */
(function () {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function dayNumber(year, month = 1, day = 1) {
    return Date.UTC(Number(year), (Number(month) || 1) - 1, Number(day) || 1);
  }

  function fromDayNumber(ms) {
    const date = new Date(ms);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  function spanBounds(ruler) {
    return {
      start: dayNumber(ruler.start, ruler.startMonth, ruler.startDay),
      end: dayNumber(
        ruler.end,
        ruler.endMonth || 12,
        ruler.endDay || 15
      ),
    };
  }

  function personKey(ruler) {
    return String(ruler?.name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /** True when two spans share at least one full calendar day. */
  function rangesOverlap(a, b) {
    const sharedStart = Math.max(a.start, b.start);
    const sharedEnd = Math.min(a.end, b.end);
    return sharedEnd - sharedStart >= MS_PER_DAY;
  }

  function coversDay(bounds, day) {
    return bounds.start <= day && bounds.end >= day;
  }

  function densifyLane(lane, usedLanes) {
    const ordered = [...usedLanes].sort((a, b) => a - b);
    const index = ordered.indexOf(lane);
    return {
      lane: Math.max(0, index),
      localLanes: Math.max(1, ordered.length),
    };
  }

  function applySegmentDates(ruler, startMs, endMs, layout) {
    const start = fromDayNumber(startMs);
    const end = fromDayNumber(endMs);
    return {
      ...ruler,
      start: start.year,
      startMonth: start.month,
      startDay: start.day,
      end: end.year,
      endMonth: end.month,
      endDay: end.day,
      lane: layout.lane,
      localLanes: layout.localLanes,
      reign: ruler.reign || {
        start: ruler.start,
        startMonth: ruler.startMonth,
        startDay: ruler.startDay,
        end: ruler.end,
        endMonth: ruler.endMonth,
        endDay: ruler.endDay,
      },
    };
  }

  function mergeAdjacentSegments(segments) {
    if (!segments.length) return segments;
    const merged = [segments[0]];
    for (let i = 1; i < segments.length; i++) {
      const prev = merged[merged.length - 1];
      const next = segments[i];
      const prevBounds = spanBounds(prev);
      const nextBounds = spanBounds(next);
      const contiguous = nextBounds.start - prevBounds.end === MS_PER_DAY;
      const sameLayout =
        prev.lane === next.lane && prev.localLanes === next.localLanes;
      if (contiguous && sameLayout) {
        merged[merged.length - 1] = applySegmentDates(
          prev,
          prevBounds.start,
          nextBounds.end,
          { lane: prev.lane, localLanes: prev.localLanes }
        );
      } else {
        merged.push(next);
      }
    }
    return merged;
  }

  function segmentRuler(ruler, withLanes) {
    const bounds = spanBounds(ruler);
    const peers = withLanes.filter((other) => {
      if (other === ruler) return false;
      if (personKey(other) === personKey(ruler)) return false;
      return rangesOverlap(bounds, spanBounds(other));
    });

    if (!peers.length) {
      return [applySegmentDates(ruler, bounds.start, bounds.end, { lane: 0, localLanes: 1 })];
    }

    const cuts = new Set([bounds.start, bounds.end + MS_PER_DAY]);
    for (const peer of peers) {
      const peerBounds = spanBounds(peer);
      const lo = Math.max(bounds.start, peerBounds.start);
      const hiExclusive = Math.min(bounds.end, peerBounds.end) + MS_PER_DAY;
      if (hiExclusive > lo) {
        cuts.add(lo);
        cuts.add(hiExclusive);
      }
    }

    const sortedCuts = [...cuts].sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i < sortedCuts.length - 1; i++) {
      const segStart = sortedCuts[i];
      const segEnd = sortedCuts[i + 1] - MS_PER_DAY;
      if (segEnd < segStart) continue;
      if (segStart < bounds.start || segEnd > bounds.end) continue;

      const active = [ruler, ...peers].filter((candidate) => {
        const candidateBounds = spanBounds(candidate);
        return (
          coversDay(candidateBounds, segStart) &&
          coversDay(candidateBounds, segEnd)
        );
      });

      const people = [];
      const seen = new Set();
      for (const candidate of active) {
        const key = personKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        people.push(candidate);
      }

      let layout = { lane: 0, localLanes: 1 };
      if (people.length > 1) {
        layout = densifyLane(
          ruler.lane,
          people.map((person) => person.lane)
        );
      }

      segments.push(applySegmentDates(ruler, segStart, segEnd, layout));
    }

    return mergeAdjacentSegments(segments);
  }

  /**
   * Greedy interval coloring, then time-slice so splits only cover contests.
   * Returns { laneCount, rulers } — rulers may be expanded into segments.
   */
  function assignLanes(rulers, { exclusive = true } = {}) {
    const list = Array.isArray(rulers) ? rulers : [];
    if (!list.length) return { laneCount: 1, rulers: [] };

    if (exclusive) {
      return {
        laneCount: 1,
        rulers: list.map((ruler) => ({ ...ruler, lane: 0, localLanes: 1 })),
      };
    }

    const items = list.map((ruler, index) => {
      const bounds = spanBounds(ruler);
      return {
        index,
        start: bounds.start,
        end: bounds.end,
        person: personKey(ruler),
      };
    });
    items.sort((a, b) => a.start - b.start || a.end - b.end);

    const laneOccupancy = [];
    const laneByIndex = new Array(list.length).fill(0);

    for (const item of items) {
      let placed = false;
      for (let lane = 0; lane < laneOccupancy.length; lane++) {
        const conflict = laneOccupancy[lane].some(
          (other) =>
            other.person !== item.person && rangesOverlap(item, other)
        );
        if (!conflict) {
          laneOccupancy[lane].push(item);
          laneByIndex[item.index] = lane;
          placed = true;
          break;
        }
      }
      if (!placed) {
        laneByIndex[item.index] = laneOccupancy.length;
        laneOccupancy.push([item]);
      }
    }

    const withLanes = list.map((ruler, index) => ({
      ...ruler,
      lane: laneByIndex[index],
    }));

    const segmented = withLanes.flatMap((ruler) =>
      segmentRuler(ruler, withLanes)
    );

    return {
      laneCount: Math.max(
        1,
        ...segmented.map((ruler) => Number(ruler.localLanes) || 1)
      ),
      rulers: segmented,
    };
  }

  function annotateSeats(seats, { exclusive = true } = {}) {
    return (seats || []).map((seat) => {
      const assigned = assignLanes(seat.rulers, { exclusive });
      return {
        ...seat,
        laneCount: assigned.laneCount,
        rulers: assigned.rulers,
      };
    });
  }

  window.TimelineLanes = {
    assignLanes,
    annotateSeats,
    rangesOverlap,
    spanBounds,
    personKey,
  };
})();
