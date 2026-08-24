'use client'

export default function SelectorMes({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  )
}
