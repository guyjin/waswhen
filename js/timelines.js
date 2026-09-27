export function renderTimelines(container) {
  container.innerHTML = ''
}

export function createTimeline(name) {
  const article = document.createElement('article')
  article.className = 'timeline'

  if (name) {
    const header = document.createElement('header')
    header.className = 'timeline-header'
    header.textContent = name
    article.appendChild(header)
  }

  const events = document.createElement('div')
  events.className = 'timeline-events'
  article.appendChild(events)

  return article
}
