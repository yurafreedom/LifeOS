#!/bin/bash
# Sequential browser QA of the integrated app (scratchpad only). Each step logs
# to ../logs/int-qa/<name>.log and a line to summary.txt.
cd "$(dirname "$0")"
LOG=../logs/int-qa
mkdir -p $LOG
: > $LOG/summary.txt
run() { local name=$1; shift; local t0=$(date +%s); "$@" > $LOG/$name.log 2>&1; echo "$name exit $? $(( $(date +%s) - t0 ))s" >> $LOG/summary.txt; }
seedq() { node seed.mjs > /dev/null 2>&1; }

seedq; run combined-matrix node combined-matrix.mjs
seedq; run glyph-check node glyph-check.mjs
seedq; run font-persist node font-persist-check.mjs
seedq; run focus-check node focus-check.mjs
seedq; run logo-focus node logo-focus-probe.mjs
seedq; run tile-clip node tile-clip-check.mjs 320,340,360,375,390,412,480,768,1024,1440
for cfg in "1440 dark '' ru no current" "1440 light '' uk no dejavu" "1024 paradise day ru no dejavu" "768 paradise night uk no current" \
           "390 dark '' uk no dejavu" "320 light '' ru no current" "1440 paradise night ru yes dejavu" "390 paradise day uk yes current"; do
  eval set -- $cfg
  seedq; run "calendar-check-$1-$2${3:+-$3}-$4-reduced-$5-$6" node calendar-check.mjs "$1" "$2" "$3" "$4" "$5" "$6"
done
for f in current dejavu; do
  seedq; run calendar-flows-$f env QA_FONT=$f node calendar-flows.mjs
  seedq; run tasks-flows-$f env QA_FONT=$f node tasks-flows.mjs
  seedq; run concurrency-$f env QA_FONT=$f node concurrency-check.mjs $f
done
seedq; run rollover-dejavu env QA_FONT=dejavu node rollover-check.mjs
seedq; run review-fixes-dejavu env QA_FONT=dejavu node review-fixes-check.mjs
seedq; run spin-dejavu env QA_FONT=dejavu node spin-check.mjs
for cfg in "1440 dark '' ru dejavu" "390 paradise day uk dejavu" "320 light '' ru current" "1024 paradise night uk current"; do
  eval set -- $cfg
  seedq; run "tasks-filter-$1-$2${3:+-$3}-$4-$5" env QA_FONT=$5 node tasks-filter-check.mjs "$1" "$2" "$3" "$4"
done
seedq; run int-shots node int-shots.mjs
echo DONE >> $LOG/summary.txt
