import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { formatCurrency, formatCurrencyCompact } from '../utils/format'
import { useStore } from '../store'

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Filler
)

ChartJS.defaults.font.family =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif'

const CHART_COLORS = {
  primary: '#6366F1',
  teal:    '#14B8A6',
  amber:   '#EAB308',
  success: '#22C55E',
  danger:  '#F87171',
}

function chartTooltipStyle(isLight: boolean) {
  return {
    backgroundColor: isLight ? 'rgba(15, 23, 42, 0.94)' : 'rgba(2, 6, 23, 0.92)',
    titleColor: '#f8fafc',
    bodyColor: '#e2e8f0',
    borderColor: isLight ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.22)',
    borderWidth: 1,
    padding: 10,
  } as const
}

function useChartTheme() {
  const theme = useStore(s => s.ui?.theme ?? 'dark')
  const isLight = theme === 'light'
  return {
    themeKey: theme,
    isLight,
    /* Contraste forte no claro; no escuro ticks claros sobre fundo escuro */
    textColor:   isLight ? '#111827' : '#cbd5e1',
    gridColor:   isLight ? 'rgba(0,0,0,0.08)' : 'rgba(148,163,184,0.12)',
    borderColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(148,163,184,0.14)',
    donutBorder: isLight ? '#ffffff' : '#070b14',
    tooltip: chartTooltipStyle(isLight),
  }
}

export function MonthlySpendingBarChart({
  labels, values, onBarClick,
}: {
  labels: string[]
  values: number[]
  onBarClick?: (index: number) => void
}) {
  const { themeKey, textColor, gridColor, borderColor, tooltip } = useChartTheme()

  const data = {
    labels,
    datasets: [{
      label: 'Gastos considerados',
      data: values,
      backgroundColor: CHART_COLORS.primary + 'cc',
      borderColor: CHART_COLORS.primary,
      borderWidth: 1,
      borderRadius: 6,
      maxBarThickness: 48,
    }],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      const i = elements[0]?.index
      if (typeof i === 'number') onBarClick?.(i)
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
        callbacks: {
          label: ctx => {
            const y = ctx.parsed.y
            return formatCurrency(typeof y === 'number' ? y : 0)
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: borderColor },
        ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 }, color: textColor },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        border: { color: borderColor },
        ticks: {
          font: { size: 10 },
          color: textColor,
          callback: v => (typeof v === 'number' ? formatCurrencyCompact(v) : ''),
        },
      },
    },
  }

  return (
    <div className="h-[240px] w-full sm:h-[280px]">
      <Bar key={themeKey} data={data} options={options} />
    </div>
  )
}

export function CategoryDoughnutChart({ labels, values }: { labels: string[]; values: number[] }) {
  const { themeKey, textColor, donutBorder, tooltip } = useChartTheme()

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [
        CHART_COLORS.primary + 'e6',
        CHART_COLORS.teal    + 'e6',
        CHART_COLORS.amber   + 'e6',
      ],
      borderColor: donutBorder,
      borderWidth: 2,
      hoverOffset: 6,
    }],
  }

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, padding: 12, font: { size: 11 }, color: textColor },
      },
      tooltip: {
        ...tooltip,
        callbacks: {
          label: ctx => {
            const n = typeof ctx.raw === 'number' ? ctx.raw : 0
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0)
            const pct = total > 0 ? ((n / total) * 100).toFixed(1) : '0'
            return `${formatCurrency(n)} (${pct}%)`
          },
        },
      },
    },
  }

  return (
    <div className="mx-auto h-[220px] max-w-xs sm:h-[260px]">
      <Doughnut key={themeKey} data={data} options={options} />
    </div>
  )
}

export function CurrentMonthCategoryBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const { themeKey, textColor, gridColor, borderColor, tooltip } = useChartTheme()

  const data = {
    labels,
    datasets: [{
      label: 'Gastos',
      data: values,
      backgroundColor: [CHART_COLORS.primary + 'dd', CHART_COLORS.teal + 'dd', CHART_COLORS.amber + 'dd'],
      borderColor:     [CHART_COLORS.primary,          CHART_COLORS.teal,          CHART_COLORS.amber],
      borderWidth: 1,
      borderRadius: 4,
    }],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
        callbacks: {
          label: ctx => {
            const x = ctx.parsed.x
            return formatCurrency(typeof x === 'number' ? x : 0)
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: gridColor },
        border: { color: borderColor },
        ticks: { font: { size: 10 }, color: textColor, callback: v => (typeof v === 'number' ? formatCurrencyCompact(v) : '') },
      },
      y: {
        grid: { display: false },
        border: { color: borderColor },
        ticks: { font: { size: 11 }, color: textColor },
      },
    },
  }

  return (
    <div className="h-[160px] w-full">
      <Bar key={themeKey} data={data} options={options} />
    </div>
  )
}

export function IncomeVsSpendingLineChart({ labels, incomeValues, spendingValues }: {
  labels: string[]
  incomeValues: number[]
  spendingValues: number[]
}) {
  const { themeKey, textColor, gridColor, borderColor, tooltip } = useChartTheme()

  const data = {
    labels,
    datasets: [
      {
        label: 'Renda',
        data: incomeValues,
        borderColor: CHART_COLORS.success,
        backgroundColor: CHART_COLORS.success + '22',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: 'Gastos considerados',
        data: spendingValues,
        borderColor: CHART_COLORS.danger,
        backgroundColor: CHART_COLORS.danger + '18',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, padding: 14, font: { size: 11 }, color: textColor },
      },
      tooltip: {
        ...tooltip,
        callbacks: {
          label: ctx => {
            const y = ctx.parsed.y
            return `${ctx.dataset.label ?? ''}: ${formatCurrency(typeof y === 'number' ? y : 0)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: borderColor },
        ticks: { font: { size: 11 }, color: textColor },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        border: { color: borderColor },
        ticks: {
          font: { size: 10 },
          color: textColor,
          callback: v => (typeof v === 'number' ? formatCurrencyCompact(v) : ''),
        },
      },
    },
  }

  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <Line key={themeKey} data={data} options={options} />
    </div>
  )
}
