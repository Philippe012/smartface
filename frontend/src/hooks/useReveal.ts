import { useEffect } from 'react'

/** Fade-up every `.reveal` element on the page once it scrolls into view. */
export function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('.reveal:not([data-visible="true"])')
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => (el.dataset.visible = 'true'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.visible = 'true'
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}
