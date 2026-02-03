#!/usr/bin/env bash
set -u

task_i=0
task_limit=100   # set to 0 for infinite
attempt=0
outdir="./claude_runs"
summary_file="$outdir/summary.md"
mkdir -p "$outdir"

# Initialize summary file with header if it doesn't exist
if [[ ! -f "$summary_file" ]]; then
  cat > "$summary_file" << 'EOF'
# Claude Loop Results

Summary of automated website improvement tasks.

---

EOF
fi

trap 'echo; echo "Stopped. task=$task_i attempt=$attempt"; exit 0' INT

while :; do
  task_i=$((task_i+1))
  attempt=0
  echo "=== TASK $task_i ==="

  # Inner loop: retry until Claude reports SUCCESS
  while :; do
    attempt=$((attempt+1))
    outfile="$outdir/task_$(printf "%03d" "$task_i")_attempt_$(printf "%03d" "$attempt").txt"

    prompt='You are a pedantic CLI product engineer and maintainer. Your job is to continuously improve a banking CLI application by making small, high-impact changes that improve usability, reliability, correctness, performance, and developer ergonomics—without bloating the codebase.

You have access to the full project files and can make direct edits (code, tests, docs, config, scripts). You must think like a user and like an engineer.

Your main goal is to make this better for users. Think about what would make a user say that this is cool.

⸻

Goals (in priority order)
	1.	Correctness & Safety
	•	Prevent destructive actions by default.
	•	Validate inputs, handle edge cases, avoid silent failure.
	•	Make outputs trustworthy (clear units, dates, rounding, currency, timezone).
	2.	CLI UX that feels “pro”
	•	Clear, consistent command structure and help text.
	•	Predictable flags, good defaults, sensible errors.
	•	Fast feedback loops, minimal friction, great “happy path.”
	3.	Performance & Stability
	•	Avoid unnecessary network calls.
	•	Cache where appropriate.
	•	Reduce latency, improve startup time if relevant.
	•	Make failures actionable (retry/backoff where appropriate).
	4.	Developer Experience
	•	Tests that lock in behavior.
	•	Lint/format/build are easy and consistent.
	•	Code is readable and modular, with clear boundaries.
	•	Docs stay accurate.
	5.	No Bloat
	•	Prefer refactors, simplification, and leverage existing patterns.
	•	Ship improvements that earn their complexity.
	•	Delete redundant code/features when they don’t pull their weight.

⸻

Constraints
	•	Make small, reviewable changes per iteration.
	•	Don’t introduce new dependencies unless there’s a strong, explicit payoff.
	•	Keep behavior backwards-compatible unless you provide a migration path and explain why breaking is worth it.

Process:
1. Inspect current site files.
2. Make edits directly to the project files.
3. Run project checks (use what exists: npm test / npm run build / npm run lint).
4. If ALL checks pass and the site is updated, print EXACTLY:
SUCCESS
as the final line.

If not successful, print EXACTLY:
RETRY
as the final line, and above it say what failed.'

    # NOTE: the `--` is required so --allowedTools doesn't swallow the prompt
    output="$(claude -p --dangerously-skip-permissions --allowedTools "Bash,Edit,Read,Write,Glob,Grep" -- "$prompt" 2>&1)"
    printf "%s\n" "$output" | tee "$outfile"

    if [[ "$(printf "%s\n" "$output" | tail -n 1)" == "SUCCESS" ]]; then
      echo "✅ Task $task_i succeeded after $attempt attempt(s)."

      # Append summary to markdown file
      timestamp=$(date "+%Y-%m-%d %H:%M:%S")
      {
        echo "## Task $task_i"
        echo ""
        echo "**Completed:** $timestamp  "
        echo "**Attempts:** $attempt  "
        echo "**Log file:** \`$(basename "$outfile")\`"
        echo ""
        echo "<details>"
        echo "<summary>Click to expand output</summary>"
        echo ""
        echo '```'
        printf "%s\n" "$output" | head -n 200
        if [[ $(printf "%s\n" "$output" | wc -l) -gt 200 ]]; then
          echo "... (truncated, see full log file)"
        fi
        echo '```'
        echo ""
        echo "</details>"
        echo ""
        echo "---"
        echo ""
      } >> "$summary_file"

      break
    fi

    echo "↩️  Retrying task $task_i..."
    sleep 1
  done

  if (( task_limit > 0 && task_i >= task_limit )); then
    echo "Done: completed $task_i tasks."
    echo "📝 Summary saved to: $summary_file"
    break
  fi
done

echo "📝 Summary saved to: $summary_file"
read -r -p "Press Enter to close…"
