"use client"

import { useCallback } from "react"
import { useReportWebVitals } from "next/web-vitals"
import { registrarWebVital } from "@/lib/ux-telemetry"

export function WebVitals() {
  const reportar = useCallback(
    (metric: Parameters<Parameters<typeof useReportWebVitals>[0]>[0]) => {
      void registrarWebVital(metric)
    },
    []
  )

  useReportWebVitals(reportar)
  return null
}

