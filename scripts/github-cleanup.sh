#!/usr/bin/env bash
# GitHub profile cleanup — run once from the repo root (Git Bash):
#   bash scripts/github-cleanup.sh
#
# Uses the token already stored in Git Credential Manager (repo scope).
# Everything here is reversible from github.com repo settings.
#
# What it does:
#   1. Creates the profile-README repo (harveyhoulahan/harveyhoulahan) and
#      uploads docs/PROFILE_README.md as its README — this becomes your
#      GitHub profile landing content.
#   2. Makes the noise/client repos private (JobHunter, old portfolios,
#      client theme code, half-finished experiments). None are linked from
#      the site. Privatizing JobHunter also removes its profile pin.
#   3. Pins harvey-portfolio + Web-Page-Navigation + ModaicsApp-iOS.
#
# NOTE: repo descriptions for harvey-portfolio and Web-Page-Navigation were
# already set via the API. Your profile BIO cannot be set with a repo-scope
# token — set it by hand: github.com/settings/profile →
#   "Spatial · Simulation · ML — geospatial ML, GPU simulation and neural
#    surrogates for climate, carbon & nature tech · hjhportfolio.com"

set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | grep '^password=' | cut -d= -f2)
api() { curl -s -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" "$@"; }

echo "== 1. Profile README repo =="
api -X POST https://api.github.com/user/repos \
  -d '{"name":"harveyhoulahan","description":"Spatial - Simulation - ML: geospatial ML, GPU simulation and neural surrogates for climate tech","private":false}' \
  | grep -E '"full_name"|"message"' | head -2

B64=$(base64 -w0 docs/PROFILE_README.md)
printf '{"message":"Add profile README","content":"%s"}' "$B64" > /tmp/readme_payload.json
api -X PUT https://api.github.com/repos/harveyhoulahan/harveyhoulahan/contents/README.md \
  --data-binary @/tmp/readme_payload.json | grep -E '"path"|"message"' | head -2

echo "== 2. Privatize noise repos =="
for r in JobHunter eve-portfolio find-this-fit iou-electron synaptech-studios \
         auto-annotated-portfolio Portfolio AI_trendInsights stepone-theme \
         modaics-server Damped-Harmonic-Oscillator-Analysis; do
  code=$(api -o /dev/null -w "%{http_code}" -X PATCH "https://api.github.com/repos/harveyhoulahan/$r" -d '{"private":true}')
  echo "  $r -> $code"
done
# Deliberately left PUBLIC: harvey-portfolio, Web-Page-Navigation-Model-with-
# AI-ML-Extensions, ModaicsApp-iOS, Modaics, modaics-v3 (site references the
# Modaics project; keep whichever is canonical and privatize the rest).

echo "== 3. Pin the three showcase repos =="
IDS=""
for r in harvey-portfolio Web-Page-Navigation-Model-with-AI-ML-Extensions ModaicsApp-iOS harveyhoulahan; do
  id=$(api "https://api.github.com/repos/harveyhoulahan/$r" | grep -m1 '"node_id"' | sed 's/.*: "\(.*\)".*/\1/')
  IDS="$IDS\"$id\","
done
IDS=${IDS%,}
printf '{"query":"mutation($ids:[ID!]!){changeUserPinnedItems(input:{itemIds:$ids}){user{login}}}","variables":{"ids":[%s]}}' "$IDS" > /tmp/pin_payload.json
api -X POST https://api.github.com/graphql --data-binary @/tmp/pin_payload.json
echo
echo "Done. Check https://github.com/harveyhoulahan"
