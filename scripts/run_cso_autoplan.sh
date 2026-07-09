#!/usr/bin/env bash
set -euo pipefail
# Run the cso skill and capture report
cso_output=$(gstack cso --output json)
mkdir -p security-reports
echo "$cso_output" > security-reports/autoplan_security_report.json
echo "Security report saved to security-reports/autoplan_security_report.json"
