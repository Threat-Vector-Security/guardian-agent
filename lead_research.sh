#!/usr/bin/env bash
set -euo pipefail

INPUT="./companies.csv"
OUTPUT="./lead-research-output.csv"
SUMMARY="./lead-research-summary.md"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: $INPUT not found" >&2
  exit 1
fi

# Write header
printf "Company,Score\n" > "$OUTPUT"

# Process each company (skip header if present)
while IFS= read -r company; do
  # Simple placeholder scoring logic: default 3
  printf "%s,3\n" "$company" >> "$OUTPUT"
done < <(tail -n +2 "$INPUT")

# Generate markdown summary
printf "# Lead Research Summary\n\n" > "$SUMMARY"
printf "Generated at %s\n\n" "$(date)" >> "$SUMMARY"
printf "## Companies\n\n" >> "$SUMMARY"
while IFS= read -r company; do
  printf "- %s\n" "$company" >> "$SUMMARY"
  done < <(head -n -1 "$INPUT")
printf "\n## Scores\n\n" >> "$SUMMARY"
while IFS=, read -r name score; do
  printf "- %s: %s\n" "$name" "$score" >> "$SUMMARY"
  done < <(tail -n +2 "$OUTPUT")

printf "Lead research completed.\n"
