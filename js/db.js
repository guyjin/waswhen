const DB_NAME = "waswhen";
const DB_VERSION = 2;

let db;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains("timelines")) {
        database.createObjectStore("timelines", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!database.objectStoreNames.contains("events")) {
        const eventsStore = database.createObjectStore("events", {
          keyPath: "id",
          autoIncrement: true,
        });
        eventsStore.createIndex("timelineId", "timelineId", { unique: false });
      }

      if (!database.objectStoreNames.contains("timelineOrder")) {
        database.createObjectStore("timelineOrder", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("eventLinks")) {
        const linksStore = database.createObjectStore("eventLinks", {
          keyPath: "id",
          autoIncrement: true,
        });
        linksStore.createIndex("eventIdA", "eventIdA", { unique: false });
        linksStore.createIndex("eventIdB", "eventIdB", { unique: false });
      }
    };

    req.onsuccess = (event) => {
      db = event.target.result;
      // Close and reset cache if another tab or the test suite deletes/upgrades the DB.
      db.onversionchange = () => {
        db.close();
        db = null;
      };
      resolve(db);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

// Wraps a single IDBRequest in a promise.
function wrap(storeName, mode, fn) {
  return openDB().then((database) => {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

// --- Timelines ---

export function getTimelines() {
  return wrap("timelines", "readonly", (store) => store.getAll());
}

export function getTimeline(id) {
  return wrap("timelines", "readonly", (store) => store.get(id));
}

export function addTimeline(timeline) {
  return wrap("timelines", "readwrite", (store) =>
    store.add({ ...timeline, createdAt: new Date().toISOString() }),
  );
}

export function updateTimeline(timeline) {
  return wrap("timelines", "readwrite", (store) => store.put(timeline));
}

// Deletes timeline, its events, all event links, and removes it from the order record.
export function deleteTimeline(id) {
  return openDB().then((database) => {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(
        ["timelines", "events", "eventLinks", "timelineOrder"],
        "readwrite",
      );

      tx.objectStore("timelines").delete(id);

      const eventsStore = tx.objectStore("events");
      const linksStore = tx.objectStore("eventLinks");

      const eventsReq = eventsStore
        .index("timelineId")
        .openCursor(IDBKeyRange.only(id));
      eventsReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;

        const eventId = cursor.value.id;
        for (const indexName of ["eventIdA", "eventIdB"]) {
          const linkCursorReq = linksStore
            .index(indexName)
            .openCursor(IDBKeyRange.only(eventId));
          linkCursorReq.onsuccess = (e) => {
            const linkCursor = e.target.result;
            if (linkCursor) {
              linkCursor.delete();
              linkCursor.continue();
            }
          };
        }

        cursor.delete();
        cursor.continue();
      };

      const orderStore = tx.objectStore("timelineOrder");
      const orderReq = orderStore.get("default");
      orderReq.onsuccess = () => {
        const record = orderReq.result;
        if (record) {
          record.order = record.order.filter((oid) => oid !== id);
          orderStore.put(record);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// --- Events ---

export function getEvents(timelineId) {
  return openDB().then((database) => {
    return new Promise((resolve, reject) => {
      const tx = database.transaction("events", "readonly");
      const req = tx
        .objectStore("events")
        .index("timelineId")
        .getAll(timelineId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

export function addEvent(event) {
  return wrap("events", "readwrite", (store) =>
    store.add({ ...event, createdAt: new Date().toISOString() }),
  );
}

export function updateEvent(event) {
  return wrap("events", "readwrite", (store) => store.put(event));
}

// Deletes event and any links where it appears on either side.
export function deleteEvent(id) {
  return openDB().then((database) => {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(["events", "eventLinks"], "readwrite");

      tx.objectStore("events").delete(id);

      const linksStore = tx.objectStore("eventLinks");

      for (const indexName of ["eventIdA", "eventIdB"]) {
        const cursorReq = linksStore
          .index(indexName)
          .openCursor(IDBKeyRange.only(id));
        cursorReq.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// --- Event links ---

// Returns all links where eventId appears on either side.
export function getEventLinks(eventId) {
  return openDB().then((database) => {
    return new Promise((resolve, reject) => {
      const tx = database.transaction("eventLinks", "readonly");
      const store = tx.objectStore("eventLinks");
      const results = [];

      let pending = 2;
      const done = () => {
        if (--pending === 0) resolve(results);
      };

      for (const indexName of ["eventIdA", "eventIdB"]) {
        const req = store.index(indexName).getAll(eventId);
        req.onsuccess = () => {
          results.push(...req.result);
          done();
        };
        req.onerror = () => reject(req.error);
      }
    });
  });
}

export function addEventLink(link) {
  return wrap("eventLinks", "readwrite", (store) => store.add(link));
}

export function updateEventLink(link) {
  return wrap("eventLinks", "readwrite", (store) => store.put(link));
}

export function deleteEventLink(id) {
  return wrap("eventLinks", "readwrite", (store) => store.delete(id));
}

// --- Timeline order ---

export function getTimelineOrder() {
  return wrap("timelineOrder", "readonly", (store) =>
    store.get("default"),
  ).then((record) => (record ? record.order : []));
}

export function setTimelineOrder(orderedIds) {
  return wrap("timelineOrder", "readwrite", (store) =>
    store.put({ id: "default", order: orderedIds }),
  );
}
