import {
  addTimeline, getTimeline, getTimelines, updateTimeline, deleteTimeline,
  addEvent, getEvents, updateEvent, deleteEvent,
  addEventLink, getEventLinks, updateEventLink, deleteEventLink,
  getTimelineOrder, setTimelineOrder,
} from '../../js/db.js';

// Wipe the test database before each spec so tests don't bleed into each other.
beforeEach((done) => {
  const req = indexedDB.deleteDatabase('waswhen');
  req.onsuccess = () => done();
  req.onerror = () => done.fail('Could not delete test database');
  req.onblocked = () => done.fail('Database deletion blocked');
});

// --- Timelines ---

describe('addTimeline', () => {
  it('returns a numeric id', async () => {
    const id = await addTimeline({ name: 'Test' });
    expect(typeof id).toBe('number');
  });

  it('persists the timeline', async () => {
    const id = await addTimeline({ name: 'Persisted' });
    const timeline = await getTimeline(id);
    expect(timeline.name).toBe('Persisted');
  });

  it('stamps createdAt', async () => {
    const id = await addTimeline({ name: 'Stamped' });
    const timeline = await getTimeline(id);
    expect(timeline.createdAt).toBeDefined();
  });
});

describe('getTimelines', () => {
  it('returns all timelines', async () => {
    await addTimeline({ name: 'A' });
    await addTimeline({ name: 'B' });
    const all = await getTimelines();
    expect(all.length).toBe(2);
  });
});

describe('updateTimeline', () => {
  it('changes the name', async () => {
    const id = await addTimeline({ name: 'Old' });
    const timeline = await getTimeline(id);
    await updateTimeline({ ...timeline, name: 'New' });
    const updated = await getTimeline(id);
    expect(updated.name).toBe('New');
  });
});

describe('deleteTimeline', () => {
  it('removes the timeline', async () => {
    const id = await addTimeline({ name: 'Gone' });
    await deleteTimeline(id);
    const timeline = await getTimeline(id);
    expect(timeline).toBeUndefined();
  });

  it('cascades to events', async () => {
    const timelineId = await addTimeline({ name: 'Parent' });
    await addEvent({ timelineId, title: 'Child', date: new Date().toISOString() });
    await deleteTimeline(timelineId);
    const events = await getEvents(timelineId);
    expect(events.length).toBe(0);
  });

  it('cascades to event links', async () => {
    const timelineId = await addTimeline({ name: 'Parent' });
    const eventIdA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eventIdB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    await addEventLink({ eventIdA, eventIdB, label: 'related' });
    await deleteTimeline(timelineId);
    const links = await getEventLinks(eventIdA);
    expect(links.length).toBe(0);
  });
});

// --- Events ---

describe('addEvent', () => {
  it('returns a numeric id', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const id = await addEvent({ timelineId, title: 'E', date: new Date().toISOString() });
    expect(typeof id).toBe('number');
  });

  it('contentType is optional', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const id = await addEvent({ timelineId, title: 'No content type', date: new Date().toISOString() });
    const [event] = await getEvents(timelineId);
    expect(event.contentType).toBeUndefined();
  });
});

describe('getEvents', () => {
  it('returns only events for the given timeline', async () => {
    const tlA = await addTimeline({ name: 'A' });
    const tlB = await addTimeline({ name: 'B' });
    await addEvent({ timelineId: tlA, title: 'A1', date: new Date().toISOString() });
    await addEvent({ timelineId: tlB, title: 'B1', date: new Date().toISOString() });
    const events = await getEvents(tlA);
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('A1');
  });
});

describe('updateEvent', () => {
  it('changes the title', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const id = await addEvent({ timelineId, title: 'Old', date: new Date().toISOString() });
    const [event] = await getEvents(timelineId);
    await updateEvent({ ...event, title: 'New' });
    const [updated] = await getEvents(timelineId);
    expect(updated.title).toBe('New');
  });
});

describe('deleteEvent', () => {
  it('removes the event', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const id = await addEvent({ timelineId, title: 'Gone', date: new Date().toISOString() });
    await deleteEvent(id);
    const events = await getEvents(timelineId);
    expect(events.length).toBe(0);
  });

  it('cascades to event links', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const eventIdA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eventIdB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    await addEventLink({ eventIdA, eventIdB });
    await deleteEvent(eventIdA);
    const links = await getEventLinks(eventIdB);
    expect(links.length).toBe(0);
  });
});

// --- Event links ---

describe('addEventLink', () => {
  it('returns a numeric id', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const eventIdA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eventIdB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    const id = await addEventLink({ eventIdA, eventIdB });
    expect(typeof id).toBe('number');
  });

  it('label is optional', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const eventIdA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eventIdB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    await addEventLink({ eventIdA, eventIdB });
    const links = await getEventLinks(eventIdA);
    expect(links[0].label).toBeUndefined();
  });
});

describe('getEventLinks', () => {
  it('finds links regardless of which side the event is on', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const eventIdA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eventIdB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    await addEventLink({ eventIdA, eventIdB, label: 'lifespan' });
    const linksFromA = await getEventLinks(eventIdA);
    const linksFromB = await getEventLinks(eventIdB);
    expect(linksFromA.length).toBe(1);
    expect(linksFromB.length).toBe(1);
  });

  it('supports multiple links per event', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const eA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    const eC = await addEvent({ timelineId, title: 'C', date: new Date().toISOString() });
    await addEventLink({ eventIdA: eA, eventIdB: eB });
    await addEventLink({ eventIdA: eA, eventIdB: eC });
    const links = await getEventLinks(eA);
    expect(links.length).toBe(2);
  });
});

describe('updateEventLink', () => {
  it('changes the label', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const eA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    const id = await addEventLink({ eventIdA: eA, eventIdB: eB, label: 'old' });
    await updateEventLink({ id, eventIdA: eA, eventIdB: eB, label: 'new' });
    const links = await getEventLinks(eA);
    expect(links[0].label).toBe('new');
  });
});

describe('deleteEventLink', () => {
  it('removes the link', async () => {
    const timelineId = await addTimeline({ name: 'TL' });
    const eA = await addEvent({ timelineId, title: 'A', date: new Date().toISOString() });
    const eB = await addEvent({ timelineId, title: 'B', date: new Date().toISOString() });
    const id = await addEventLink({ eventIdA: eA, eventIdB: eB });
    await deleteEventLink(id);
    const links = await getEventLinks(eA);
    expect(links.length).toBe(0);
  });
});

// --- Timeline order ---

describe('getTimelineOrder', () => {
  it('returns empty array when no order set', async () => {
    const order = await getTimelineOrder();
    expect(order).toEqual([]);
  });
});

describe('setTimelineOrder', () => {
  it('persists and retrieves the order', async () => {
    const idA = await addTimeline({ name: 'A' });
    const idB = await addTimeline({ name: 'B' });
    await setTimelineOrder([idB, idA]);
    const order = await getTimelineOrder();
    expect(order).toEqual([idB, idA]);
  });

  it('overwrites a previous order', async () => {
    const idA = await addTimeline({ name: 'A' });
    const idB = await addTimeline({ name: 'B' });
    await setTimelineOrder([idA, idB]);
    await setTimelineOrder([idB, idA]);
    const order = await getTimelineOrder();
    expect(order).toEqual([idB, idA]);
  });
});
