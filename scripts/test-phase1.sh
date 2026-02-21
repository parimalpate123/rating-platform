#!/bin/bash
# Phase 1 smoke tests — verifies all services and key endpoints are working
set -e
cd "$(dirname "$0")/.."

BASE_PORTS=(
  "core-rating:4000"
  "line-rating:4001"
  "product-config:4010"
  "transform-service:4011"
  "rules-service:4012"
  "status-service:4013"
)

PASS=0
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local method="${3:-GET}"
  local body="$4"
  local expected_field="$5"

  if [ "$method" = "POST" ]; then
    result=$(curl -s -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$body" 2>/dev/null)
  else
    result=$(curl -s "$url" 2>/dev/null)
  fi

  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
    ${body:+-H "Content-Type: application/json"} \
    ${body:+-d "$body"} \
    "$url" 2>/dev/null)

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label (HTTP $http_code)"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══════════════════════════════════════"
echo "  Phase 1 Smoke Tests — Rating Platform"
echo "═══════════════════════════════════════"
echo ""

# ── Health checks ────────────────────────────────────────────────────────────
echo "[ Health Endpoints ]"
for entry in "${BASE_PORTS[@]}"; do
  svc="${entry%%:*}"
  port="${entry##*:}"
  check "$svc health" "http://localhost:$port/api/v1/health"
done
echo ""

# ── Step Handler Registry ────────────────────────────────────────────────────
echo "[ Core Rating — Registry ]"
check "list handlers" "http://localhost:4000/api/v1/registry/handlers"
check "handlers health" "http://localhost:4000/api/v1/registry/handlers/health"
echo ""

# ── Execution Engine ─────────────────────────────────────────────────────────
echo "[ Core Rating — Execution (no-op, no handlers registered) ]"
check "execute empty flow" "http://localhost:4000/api/v1/execute" "POST" \
  '{"correlationId":"test-001","productLineCode":"TEST","payload":{"insured":"ACME Corp"},"steps":[]}'
echo ""

# ── Product Config — Systems ─────────────────────────────────────────────────
echo "[ Product Config — Systems ]"
check "list systems" "http://localhost:4010/api/v1/systems"
echo ""

# ── Product Config — Products ────────────────────────────────────────────────
echo "[ Product Config — Products ]"
check "list products (empty)" "http://localhost:4010/api/v1/product-lines"
check "create product GL" "http://localhost:4010/api/v1/product-lines" "POST" \
  '{"code":"GL","name":"General Liability","config":{"sourceSystem":"gw-policycenter","targetSystem":"earnix"}}'
check "get product GL" "http://localhost:4010/api/v1/product-lines/GL"
echo ""

# ── Product Config — Mappings ─────────────────────────────────────────────────
echo "[ Product Config — Mappings ]"
MAPPING=$(curl -s -X POST "http://localhost:4010/api/v1/mappings" \
  -H "Content-Type: application/json" \
  -d '{"name":"GL Request Mapping","productLineCode":"GL","direction":"request"}' 2>/dev/null)
MAPPING_ID=$(echo "$MAPPING" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$MAPPING_ID" ]; then
  echo "  ✓ create mapping (id: $MAPPING_ID)"
  PASS=$((PASS + 1))
  check "list mappings" "http://localhost:4010/api/v1/mappings?productLineCode=GL"
  check "add field mapping" "http://localhost:4010/api/v1/mappings/$MAPPING_ID/fields" "POST" \
    '{"sourcePath":"$.policy.insuredName","targetPath":"$.risk.insuredName","transformationType":"direct","isRequired":true}'
  check "list field mappings" "http://localhost:4010/api/v1/mappings/$MAPPING_ID/fields"
else
  echo "  ✗ create mapping (could not parse id)"
  FAIL=$((FAIL + 1))
fi
echo ""

# ── Rules Service ─────────────────────────────────────────────────────────────
echo "[ Rules Service ]"
check "list rules (empty)" "http://localhost:4012/api/v1/rules?productLineCode=GL"
check "create rule" "http://localhost:4012/api/v1/rules" "POST" \
  '{"name":"NY Surcharge","productLineCode":"GL","priority":10,"conditions":[{"field":"scope.state","operator":"equals","value":"NY"}],"actions":[{"actionType":"multiply","targetField":"premium","value":1.05}]}'
check "evaluate rules" "http://localhost:4012/api/v1/rules/evaluate" "POST" \
  '{"productLineCode":"GL","scope":{"state":"NY","coverage":"BOP"},"phase":"pre_rating","context":{"premium":1000}}'
echo ""

# ── Transform Service ─────────────────────────────────────────────────────────
echo "[ Transform Service ]"
check "json to xml" "http://localhost:4011/api/v1/transform" "POST" \
  '{"input":{"insured":"ACME","premium":1000},"direction":"json_to_xml"}'
echo ""

# ── Status Service ─────────────────────────────────────────────────────────────
echo "[ Status Service ]"
check "create transaction" "http://localhost:4013/api/v1/transactions" "POST" \
  '{"correlationId":"test-001","productLineCode":"GL","requestPayload":{"insured":"ACME"},"scope":{"state":"NY"}}'
check "list transactions" "http://localhost:4013/api/v1/transactions?productLineCode=GL"
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

[ $FAIL -eq 0 ] && exit 0 || exit 1
