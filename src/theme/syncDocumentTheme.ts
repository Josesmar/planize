import type { AppTheme } from '../types'

const BG_HEX = { dark: '#070b14', light: '#ebf0f8' } as const

/** Alinha `<html>`, `data-theme`, fundo (hex força a viewport inteira no iOS/PWA) e meta. */
export function syncDocumentTheme(theme: AppTheme) {
  const root = document.documentElement
  const isLight = theme === 'light'
  root.classList.toggle('light', isLight)
  root.dataset.theme = isLight ? 'light' : 'dark'
  root.style.colorScheme = isLight ? 'light' : 'dark'
  root.style.backgroundColor = isLight ? BG_HEX.light : BG_HEX.dark
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', isLight ? '#EBF0F8' : '#070B14')
}
