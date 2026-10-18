#!/usr/bin/env bash
# Dump every probe in its own Unity process (human decision 2026-10-18, plan section 27-2).
#
# Under the Standard text generator a text's layout width depends on what the same Unity
# process drew before (0-2px). A probe dumped alone is deterministic, and that is the
# reference value. So each probe (a .uxml and its same-name .uss) is copied alone into
# Assets/_Solo/ and dumped by a fresh Unity process; nothing else is drawn first.
#
# usage: dump-solo.sh <unity.exe> <project> <dumper> <probe dir> <output dir> [dumper args...]
#   dumper: panel  -> UxmlPreview.Probe.PanelDump.Run   (-probeFolder / -probeOutput)
#           editor -> UxmlPreview.Probe.ProbeDump.Run   (-probeFolder / -probeOutput, -probeTheme editor)
#           golden -> UxmlPreview.Golden.UxmlLayoutDumpWindow.RunFromCommandLine (-goldenCaseFolder / -goldenOutput)
#   probe dir: a folder of .uxml probes on disk (copied in, one at a time, with a same-name .uss and
#   folder). Absolute project:// paths still resolve against the project. Set ONLY to dump a subset:
#   ONLY="c-textfield c07-RadioButton" dump-solo.sh ...   SKIP_EXISTING=1 resumes an interrupted run.
# Effects: replaces <project>/Assets/_Solo each run; writes <output dir>/<probe>.json; logs to <output dir>/logs/.
set -u
unity=$1; project=$2; dumper=$3; probes=$4; out=$5; shift 5
solo="$project/Assets/_Solo"
mkdir -p "$out/logs"
for uxml in "$probes"/*.uxml; do
  name=$(basename "$uxml" .uxml)
  if [ -n "${ONLY:-}" ] && ! [[ " $ONLY " == *" $name "* ]]; then continue; fi
  # SKIP_EXISTING=1 resumes an interrupted run.
  if [ -n "${SKIP_EXISTING:-}" ] && [ -f "$out/$name.json" ]; then continue; fi
  rm -rf "$solo" "$solo.meta"; mkdir -p "$solo"
  cp "$uxml" "$solo/"; [ -f "$probes/$name.uss" ] && cp "$probes/$name.uss" "$solo/"
  # A golden case may import from a same-name folder beside it (relative @import).
  [ -d "$probes/$name" ] && cp -r "$probes/$name" "$solo/"
  case $dumper in
    panel)  args=(-executeMethod UxmlPreview.Probe.PanelDump.Run -probeFolder Assets/_Solo -probeOutput "$out") ;;
    editor) args=(-executeMethod UxmlPreview.Probe.ProbeDump.Run -probeFolder Assets/_Solo -probeOutput "$out" -probeTheme editor) ;;
    golden) args=(-executeMethod UxmlPreview.Golden.UxmlLayoutDumpWindow.RunFromCommandLine -goldenCaseFolder Assets/_Solo -goldenOutput "$out") ;;
    *) echo "unknown dumper $dumper" >&2; exit 2 ;;
  esac
  "$unity" -batchmode -projectPath "$project" "${args[@]}" "$@" -logFile "$out/logs/$name.log"
  code=$?
  [ -f "$out/$name.json" ] || { echo "$name: no dump (exit $code)" >&2; continue; }
  echo "$name ok"
done
rm -rf "$solo" "$solo.meta"
