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
      className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}
