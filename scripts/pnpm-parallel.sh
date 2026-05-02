#!/usr/bin/env bash

# Capture start time (nanoseconds)
start_time=$(date +%s%N)

# Function to report runtime
report_runtime() {
  end_time=$(date +%s%N)
  elapsed_ns=$((end_time - start_time))
  elapsed_s=$((elapsed_ns / 1000000000))
  elapsed_ms=$(((elapsed_ns / 1000000) % 1000))
  echo "⏱️  took ${elapsed_s}.${elapsed_ms}s"
}

# Define tasks
tasks=("$@")

if [ ${#tasks[@]} -eq 0 ]; then
  echo "❌ No tasks provided"
  exit 1
fi

# Track background PIDs and their task names
declare -A pid_to_task
pids=()

for task in "${tasks[@]}"; do
  echo "🚀 starting: $task"
  pnpm "$task" &
  pid=$!
  pids+=($pid)
  pid_to_task[$pid]=$task
done

# Function to kill remaining background jobs
cleanup() {
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null
  done
  report_runtime
}
trap cleanup EXIT

exit_code=0
failed_task=""

# Wait for jobs one by one
while [ ${#pid_to_task[@]} -gt 0 ]; do
  wait -n -p finished_pid
  status=$?
  
  if [ $status -ne 0 ]; then
    failed_task=${pid_to_task[$finished_pid]}
    echo "❌ task '$failed_task' failed (status $status)"
    exit_code=$status
    break
  else
    echo "✅ task '${pid_to_task[$finished_pid]}' passed"
  fi
  unset "pid_to_task[$finished_pid]"
done

if [ $exit_code -eq 0 ]; then
  tasks_str=$(printf ", %s" "${tasks[@]}")
  tasks_str="${tasks_str:2}"
  echo "✅ all tasks passed: $tasks_str"
fi

exit $exit_code
