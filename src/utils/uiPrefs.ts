import { DEFAULT_UI_PREFERENCES, type FontSize, type UiPreferences } from '../types'

/** Garante objeto `ui` válido após persist/sync legado. */
export function coerceUiPreferences(raw: Record<string, unknown>): UiPreferences {
  const u = raw
  let personLabels: string[] = []
  if (Array.isArray(u.personLabels) && u.personLabels.length > 0) {
    personLabels = u.personLabels.map(x => String(x))
  } else {
    personLabels = [
      typeof u.person1Label === 'string' ? u.person1Label : 'Pessoa 1',
      typeof u.person2Label === 'string' ? u.person2Label : 'Pessoa 2',
    ]
  }

  let incomeSlotCount =
    typeof u.incomeSlotCount === 'number' && u.incomeSlotCount >= 1 && u.incomeSlotCount <= 6
      ? u.incomeSlotCount
      : Math.min(6, Math.max(1, personLabels.length))

  while (personLabels.length < incomeSlotCount) {
    personLabels.push(`Pessoa ${personLabels.length + 1}`)
  }
  if (personLabels.length > incomeSlotCount) {
    personLabels = personLabels.slice(0, incomeSlotCount)
  }

  const fontSize: FontSize =
    u.fontSize === 'sm' || u.fontSize === 'md' || u.fontSize === 'lg' ? u.fontSize : DEFAULT_UI_PREFERENCES.fontSize
  const theme = u.theme === 'light' || u.theme === 'dark' ? u.theme : DEFAULT_UI_PREFERENCES.theme

  const onboardingDone =
    typeof u.onboardingDone === 'boolean' ? u.onboardingDone : true

  return {
    workspaceTitle: typeof u.workspaceTitle === 'string' ? u.workspaceTitle : '',
    personLabels,
    incomeSlotCount,
    onboardingDone,
    fontSize,
    theme,
  }
}
