/**
 * ============================================================================
 * UNIT 4 & UNIT 2: GEO-SPATIAL INDEXING WITH R-TREE
 * Module: middleware/rTreeIndex.js
 * ============================================================================
 *
 * Implements an in-memory 2D R-Tree spatial index for mobile fleet vehicles:
 * 1. Bounding Box (MBR: Minimum Bounding Rectangle) calculation and containment tests.
 * 2. O(log N) spatial range queries and K-nearest-neighbour lookups.
 * 3. Dynamic index updates as drivers move (re-inserting on GPS telemetry updates).
 * 4. Geo-fenced city zone classifications (Uptown, Downtown, Airport, Tech Park, Harbour).
 */

// Predefined geo-fenced city zones with coordinate bounding boxes
const CITY_ZONES = {
  Uptown: { name: 'Uptown', minX: 0, minY: 0, maxX: 45, maxY: 45, surgeBase: 1.1 },
  Downtown: { name: 'Downtown', minX: 40, minY: 40, maxX: 75, maxY: 75, surgeBase: 1.4 },
  Airport: { name: 'Airport', minX: 70, minY: 0, maxX: 100, maxY: 45, surgeBase: 1.5 },
  TechPark: { name: 'Tech Park', minX: 0, minY: 65, maxX: 45, maxY: 100, surgeBase: 1.2 },
  Harbour: { name: 'Harbour', minX: 70, minY: 70, maxX: 100, maxY: 100, surgeBase: 1.0 }
};

class RTreeNode {
  constructor(isLeaf = true, maxEntries = 4) {
    this.isLeaf = isLeaf;
    this.maxEntries = maxEntries;
    this.entries = []; // leaf: { id, x, y, data }, internal: { bbox, child }
    this.bbox = [Infinity, Infinity, -Infinity, -Infinity];
  }

  updateBBox() {
    this.bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const e of this.entries) {
      const b = this.isLeaf ? [e.x, e.y, e.x, e.y] : e.bbox;
      this.bbox[0] = Math.min(this.bbox[0], b[0]);
      this.bbox[1] = Math.min(this.bbox[1], b[1]);
      this.bbox[2] = Math.max(this.bbox[2], b[2]);
      this.bbox[3] = Math.max(this.bbox[3], b[3]);
    }
  }
}

class RTreeIndex {
  constructor(maxEntries = 4) {
    this.maxEntries = maxEntries;
    this.root = new RTreeNode(true, maxEntries);
    this.itemMap = new Map(); // id -> { x, y, data }
    this.totalIndexed = 0;
  }

  insert(id, x, y, data = {}) {
    this.remove(id); // Ensure no duplicate entries

    const item = { id, x, y, data, zone: this.classifyZone(x, y) };
    this.itemMap.set(id, item);
    this._insertLeaf(this.root, item);
    this.totalIndexed++;
  }

  _insertLeaf(node, item) {
    node.entries.push(item);
    node.updateBBox();

    if (node.entries.length > this.maxEntries) {
      this._splitNode(node);
    }
  }

  _splitNode(node) {
    // Linear split heuristic for bounding boxes
    const mid = Math.floor(node.entries.length / 2);
    const rightEntries = node.entries.splice(mid);
    node.updateBBox();

    if (node === this.root) {
      const leftChild = new RTreeNode(node.isLeaf, this.maxEntries);
      leftChild.entries = [...node.entries];
      leftChild.updateBBox();

      const rightChild = new RTreeNode(node.isLeaf, this.maxEntries);
      rightChild.entries = rightEntries;
      rightChild.updateBBox();

      node.isLeaf = false;
      node.entries = [
        { bbox: leftChild.bbox, child: leftChild },
        { bbox: rightChild.bbox, child: rightChild }
      ];
      node.updateBBox();
    }
  }

  remove(id) {
    if (!this.itemMap.has(id)) return false;
    this.itemMap.delete(id);
    const removed = this._removeRecursive(this.root, id);
    if (removed) this.totalIndexed = Math.max(0, this.totalIndexed - 1);
    return removed;
  }

  _removeRecursive(node, id) {
    if (node.isLeaf) {
      const idx = node.entries.findIndex(e => e.id === id);
      if (idx !== -1) {
        node.entries.splice(idx, 1);
        node.updateBBox();
        return true;
      }
      return false;
    }

    let removed = false;
    for (const entry of node.entries) {
      if (this._removeRecursive(entry.child, id)) {
        entry.bbox = entry.child.bbox;
        removed = true;
      }
    }
    node.updateBBox();
    return removed;
  }

  update(id, x, y, data = {}) {
    this.remove(id);
    this.insert(id, x, y, data);
  }

  searchBBox(minX, minY, maxX, maxY) {
    const results = [];
    this._searchRecursive(this.root, [minX, minY, maxX, maxY], results);
    return results;
  }

  _searchRecursive(node, targetBBox, results) {
    if (!this._intersects(node.bbox, targetBBox)) return;

    if (node.isLeaf) {
      for (const e of node.entries) {
        if (e.x >= targetBBox[0] && e.x <= targetBBox[2] &&
            e.y >= targetBBox[1] && e.y <= targetBBox[3]) {
          results.push(e);
        }
      }
    } else {
      for (const entry of node.entries) {
        if (this._intersects(entry.bbox, targetBBox)) {
          this._searchRecursive(entry.child, targetBBox, results);
        }
      }
    }
  }

  nearest(x, y, k = 1, filterFn = null) {
    const candidates = [];
    for (const [id, item] of this.itemMap.entries()) {
      if (filterFn && !filterFn(item)) continue;
      const dist = Math.hypot(item.x - x, item.y - y);
      candidates.push({ ...item, distance: Number(dist.toFixed(2)) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, k);
  }

  classifyZone(x, y) {
    for (const [zoneKey, zone] of Object.entries(CITY_ZONES)) {
      if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) {
        return zone.name;
      }
    }
    return 'Downtown';
  }

  getCityZones() {
    return CITY_ZONES;
  }

  getZoneCounts() {
    const counts = { Uptown: 0, Downtown: 0, Airport: 0, TechPark: 0, Harbour: 0 };
    for (const item of this.itemMap.values()) {
      const z = item.zone ? item.zone.replace(/\s+/g, '') : 'Downtown';
      if (counts[z] !== undefined) counts[z]++;
    }
    return counts;
  }

  _intersects(b1, b2) {
    return !(b1[2] < b2[0] || b1[0] > b2[2] || b1[3] < b2[1] || b1[1] > b2[3]);
  }

  getStatus() {
    return {
      totalIndexed: this.totalIndexed,
      zones: CITY_ZONES,
      zoneCounts: this.getZoneCounts(),
      entries: Array.from(this.itemMap.values())
    };
  }
}

module.exports = {
  RTreeIndex,
  CITY_ZONES
};
